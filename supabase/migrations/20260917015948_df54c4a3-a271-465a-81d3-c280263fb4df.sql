-- Local preparation only; apply after the existing financial and receipts migrations.
begin;
alter table public.service_orders
  add column discount_amount numeric not null default 0
    check (discount_amount >= 0 and discount_amount < 'Infinity'::numeric and discount_amount = round(discount_amount,2)),
  add column discount_reason text not null default '' check (length(discount_reason) <= 1000);

create function pitgarage_private.protect_order_discount() returns trigger
language plpgsql set search_path='' as $$
declare subtotal numeric; previous_history jsonb; next_history jsonb;
begin
  if current_user in ('authenticated','anon') then
    if tg_op='INSERT' then
      if new.discount_amount<>0 or new.discount_reason<>'' then
        raise exception 'Use a operação de desconto comercial da OS.';
      end if;
      if exists(select 1 from jsonb_array_elements(coalesce(new.activities,'[]')) a where a->>'action'='commercial_discount') then
        raise exception 'Não é permitido alterar o histórico de desconto.';
      end if;
    else
      if new.discount_amount is distinct from old.discount_amount or new.discount_reason is distinct from old.discount_reason then
        raise exception 'Use a operação de desconto comercial da OS.';
      end if;
      select coalesce(jsonb_agg(a order by n),'[]') into previous_history
        from jsonb_array_elements(coalesce(old.activities,'[]')) with ordinality e(a,n) where a->>'action'='commercial_discount';
      select coalesce(jsonb_agg(a order by n),'[]') into next_history
        from jsonb_array_elements(coalesce(new.activities,'[]')) with ordinality e(a,n) where a->>'action'='commercial_discount';
      if previous_history is distinct from next_history then raise exception 'Não é permitido alterar o histórico de desconto.'; end if;
    end if;
  end if;
  if new.discount_amount>0 then
    select coalesce(sum((i->>'price')::numeric),0) into subtotal
      from jsonb_array_elements(new.budget) i where i->>'approval'='Aprovado';
    if new.discount_amount>subtotal then
      raise exception 'O desconto não pode ser maior que o subtotal aprovado. Remova ou ajuste o desconto antes de alterar as aprovações.';
    end if;
  end if;
  return new;
end $$;
revoke all on function pitgarage_private.protect_order_discount() from public,anon,authenticated;
create trigger protect_order_discount before insert or update on public.service_orders
for each row execute function pitgarage_private.protect_order_discount();

create function public.set_order_discount(order_id uuid, expected_version timestamptz,
  request_id uuid, amount numeric, reason text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare target public.service_orders; subtotal numeric; paid numeric; saved jsonb; note text := coalesce(reason,'');
begin
  if not coalesce(pitgarage_private.is_team_member() and
    (pitgarage_private.current_access_level() in ('owner','admin') or public.can_view_financial()),false) then
    raise exception using errcode='42501',message='Você não tem permissão para alterar o desconto comercial.';
  end if;
  if request_id is null or amount is null or amount<0 or amount>='Infinity'::numeric
    or amount<>round(amount,2) or length(note)>1000 then
    raise exception 'Informe um desconto não negativo, em reais e centavos, e motivo de até 1000 caracteres.';
  end if;
  select * into target from public.service_orders where id=order_id for update;
  if not found then raise exception 'OS não encontrada.'; end if;
  -- A retry returns current state, even after closure, without writing anything.
  select a into saved from jsonb_array_elements(coalesce(target.activities,'[]')) a
    where a->>'action'='commercial_discount' and a->>'requestId'=request_id::text;
  if saved is not null then
    if (saved->>'newAmount')::numeric is distinct from amount or saved->>'reason' is distinct from note
      or saved->>'recordedBy' is distinct from auth.uid()::text then
      raise exception 'Identificador de desconto já utilizado.';
    end if;
    return to_jsonb(target);
  end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode='40001',message='Order version conflict';
  end if;
  if target.deleted_at is not null or target.cancelled_at is not null or target.completed_at is not null
    or target.status in ('Serviço concluído','Aguardando retirada','Entregue') then
    raise exception 'Esta OS é somente leitura: desconto indisponível após conclusão, entrega ou cancelamento.';
  end if;
  select coalesce(sum((i->>'price')::numeric),0) into subtotal
    from jsonb_array_elements(target.budget) i where i->>'approval'='Aprovado';
  if amount>subtotal then raise exception 'O desconto não pode ser maior que o subtotal aprovado.'; end if;
  paid := pitgarage_private.received_amount(target.payment);
  if subtotal-amount<paid then
    raise exception 'O desconto deixaria o valor final abaixo do valor já recebido. Trate o crédito/estorno antes.';
  end if;
  update public.service_orders set discount_amount=amount,discount_reason=note,
    activities=coalesce(target.activities,'[]')||jsonb_build_array(jsonb_build_object(
      'id','a-'||request_id,'type','payment','action','commercial_discount','requestId',request_id,
      'previousAmount',target.discount_amount,'newAmount',amount,'previousReason',target.discount_reason,
      'reason',note,'recordedBy',auth.uid(),'at',clock_timestamp(),
      'description',case when amount=0 then 'Desconto comercial removido'
        when target.discount_amount=0 then 'Desconto comercial aplicado: R$ '||replace(round(amount,2)::text,'.',',')
        else 'Desconto comercial alterado de R$ '||replace(round(target.discount_amount,2)::text,'.',',')||' para R$ '||replace(round(amount,2)::text,'.',',') end
        ||case when note<>'' then ' — '||note else '' end)),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond')
    where id=order_id returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.set_order_discount(uuid,timestamptz,uuid,numeric,text) from public,anon;
grant execute on function public.set_order_discount(uuid,timestamptz,uuid,numeric,text) to authenticated;

-- Only extend the accepted payment methods; preserve authorization, concurrency and receipts.
create or replace function public.record_order_payment(order_id uuid, expected_version timestamptz, receipt jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.service_orders; entries jsonb; saved jsonb; paid numeric; total numeric; amount numeric; stamp timestamptz; receipt_id uuid; result_payment jsonb;
begin
  if not pitgarage_private.is_team_member() then raise exception using errcode='42501',message='Workshop access required'; end if;
  receipt_id := (receipt->>'id')::uuid;
  amount := (receipt->>'amount')::numeric; stamp := (receipt->>'date')::timestamptz;
  if receipt_id is null or amount is null or amount not between 0.01 and 100000000 or amount<>round(amount,2)
    or stamp is null or not isfinite(stamp) or coalesce(receipt->>'method','') not in ('PIX','Cartão','Dinheiro')
    or length(coalesce(receipt->>'note',''))>1000 then raise exception 'Invalid receipt'; end if;
  select * into target from public.service_orders where id=$1 for update;
  if not found then raise exception 'Order not found'; end if;
  entries := coalesce(target.payment->'receipts','[]'::jsonb);
  select r into saved from jsonb_array_elements(entries) r where r->>'id'=receipt_id::text;
  if saved is not null then
    if (saved->>'amount')::numeric<>amount or saved->>'method'<>receipt->>'method' or (saved->>'date')::timestamptz<>stamp or coalesce(saved->>'note','')<>coalesce(receipt->>'note','') then
      raise exception 'Receipt id already used';
    end if;
    return to_jsonb(target);
  end if;
  if target.updated_at is distinct from expected_version then raise exception using errcode='40001',message='Order version conflict'; end if;
  if target.deleted_at is not null then raise exception 'Order is deleted'; end if;
  -- Current cancellation is encoded by the operational schema; check JSON for compatibility.
  if to_jsonb(target)->>'cancelled_at' is not null then raise exception 'Order is cancelled'; end if;
  select coalesce(sum((i->>'price')::numeric),0) into total from jsonb_array_elements(target.budget) i where i->>'approval'='Aprovado';
  total := total - target.discount_amount;
  paid := pitgarage_private.received_amount(target.payment);
  if amount>greatest(total-paid,0) then raise exception 'Payment exceeds outstanding balance'; end if;
  if target.payment is not null and not (target.payment ? 'receipts') and paid>0 then
    entries := jsonb_build_array(jsonb_build_object('id','legacy','amount',paid,'method',target.payment->>'method',
      'date',target.payment->>'date','note','Pagamento anterior preservado','recordedBy',''));
  end if;
  entries := entries || jsonb_build_array(jsonb_build_object('id',receipt_id,'amount',amount,'date',stamp,
    'method',receipt->>'method','note',coalesce(receipt->>'note',''),'recordedBy',auth.uid()));
  paid := paid+amount;
  result_payment := coalesce(target.payment,'{}'::jsonb) || jsonb_build_object('receipts',entries,'amount',paid,
    'method',receipt->>'method','date',stamp,'status',case when paid>=total then 'Pago' else 'Parcial' end);
  if target.payment is not null and not (target.payment ? 'receipts') then result_payment := result_payment || jsonb_build_object('legacy',target.payment); end if;
  update public.service_orders set payment=result_payment,
    activities=coalesce(target.activities,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('id','a-'||gen_random_uuid(),'type','payment',
      'description','Recebimento registrado: '||amount::text||' por '||(receipt->>'method'),'at',clock_timestamp())),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond')
  where id=$1 returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.record_order_payment(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.record_order_payment(uuid,timestamptz,jsonb) to authenticated;

create or replace function public.order_receivables() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'number',s.order_number,'customerId',s.customer_id,
   'kind',v.kind,'date',coalesce(s.completed_at,s.opened_at),'subtotal',tot.total,'discountAmount',s.discount_amount,'total',tot.total-s.discount_amount,'paid',pitgarage_private.received_amount(s.payment),
   'balance',greatest(tot.total-s.discount_amount-pitgarage_private.received_amount(s.payment),0),'payment',s.payment))
 from public.service_orders s join public.vehicles v on v.id=s.vehicle_id
 cross join lateral (select coalesce(sum((i->>'price')::numeric),0) total from jsonb_array_elements(s.budget) i where i->>'approval'='Aprovado') tot
 where s.deleted_at is null and s.cancelled_at is null),'[]'::jsonb);
end $$;
revoke all on function public.order_receivables() from public,anon;
grant execute on function public.order_receivables() to authenticated;

create or replace function public.financial_order_report() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_financial() then
    raise exception using errcode='42501',message='Financial access required';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'orderId',s.id,'orderNumber','OS-'||s.order_number,
      'vehicle',nullif(concat_ws(' ',v.brand,v.model,v.plate),''),
      'customer',c.name,'kind',v.kind,'completedAt',s.completed_at,
      'discountAmount',s.discount_amount,
      'items',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'type',b->>'type',
          'name',case when jsonb_typeof(b->'name')='string' then b->>'name' end,
          'quantity',case when not (b ? 'quantity') then 1
            when jsonb_typeof(b->'quantity')='number' then
              case when (b->>'quantity')::numeric>=1 and trunc((b->>'quantity')::numeric)=(b->>'quantity')::numeric
                then (b->>'quantity')::numeric end end,
          'revenue',case when jsonb_typeof(b->'price')='number' then
            case when (b->>'price')::numeric>=0 then (b->>'price')::numeric end end,
          'unitCost',case when b->>'type'='Peça' then f.unit_cost end
        ) order by n),'[]'::jsonb)
        from jsonb_array_elements(s.budget) with ordinality e(b,n)
        left join public.order_part_financials f on f.order_id=s.id and f.item_id=b->>'id'
        where b->>'type' in ('Peça','Serviço') and b->>'approval'='Aprovado' and b->>'executed'='true'
      )
    ) order by s.completed_at desc nulls last,s.order_number desc),'[]'::jsonb)
    from public.service_orders s
    left join public.vehicles v on v.id=s.vehicle_id
    left join public.customers c on c.id=s.customer_id
    where s.status in ('Serviço concluído','Aguardando retirada','Entregue')
  );
end $$;

commit;
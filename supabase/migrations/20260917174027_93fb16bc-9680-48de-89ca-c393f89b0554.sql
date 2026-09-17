-- Local preparation only. Apply after 20260917030000_quick_service_orders.sql.
begin;

create or replace function public.can_view_financial() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(pitgarage_private.current_access_level() in ('owner','admin') or (
    pitgarage_private.current_access_level()='staff' and exists(
      select 1 from public.financial_permissions where user_id=auth.uid()
    )),false)
$$;
revoke all on function public.can_view_financial() from public,anon;
grant execute on function public.can_view_financial() to authenticated;

create or replace function pitgarage_private.receipt_fee(receipt jsonb) returns numeric
language sql immutable set search_path='' as $$
  select case when jsonb_typeof(receipt->'feeAmount')='number' then (receipt->>'feeAmount')::numeric else 0 end
$$;
revoke all on function pitgarage_private.receipt_fee(jsonb) from public,anon,authenticated;

create or replace function pitgarage_private.payment_fees(payment jsonb) returns numeric
language sql immutable set search_path='' as $$
  select coalesce((select sum(pitgarage_private.receipt_fee(r))
    from jsonb_array_elements(coalesce(payment->'receipts','[]')) r),0)
$$;
create or replace function pitgarage_private.net_received(payment jsonb) returns numeric
language sql immutable set search_path='' as $$
  select pitgarage_private.received_amount(payment)-pitgarage_private.payment_fees(payment)
$$;
revoke all on function pitgarage_private.payment_fees(jsonb),pitgarage_private.net_received(jsonb)
  from public,anon,authenticated;

create table public.financial_correction_audit(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id),
  request_id uuid not null unique,
  target_type text not null check(target_type in ('receipt','discount','cost')),
  target_id text,
  request_payload jsonb not null,
  previous_value jsonb not null,
  new_value jsonb not null,
  reason text not null check(length(btrim(reason)) between 1 and 1000),
  recorded_by uuid not null,
  actor_name text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.financial_correction_audit enable row level security;
revoke all on public.financial_correction_audit from public,anon,authenticated;
grant select on public.financial_correction_audit to authenticated;
create policy financial_correction_read on public.financial_correction_audit for select to authenticated
  using ((select public.can_view_financial()));

create or replace function public.record_order_payment(order_id uuid,expected_version timestamptz,receipt jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.service_orders; entries jsonb; saved jsonb; paid numeric; total numeric;
  amount numeric; fee numeric; net numeric; stamp timestamptz; receipt_id uuid; result_payment jsonb; actor_name text;
begin
  if not pitgarage_private.is_team_member() then raise exception using errcode='42501',message='Workshop access required'; end if;
  receipt_id:=(receipt->>'id')::uuid; amount:=(receipt->>'amount')::numeric;
  fee:=coalesce((receipt->>'feeAmount')::numeric,0); stamp:=(receipt->>'date')::timestamptz;
  if receipt_id is null or amount is null or amount not between 0.01 and 100000000 or amount<>round(amount,2)
    or fee<0 or fee>amount or fee<>round(fee,2) or stamp is null or not isfinite(stamp)
    or coalesce(receipt->>'method','') not in ('PIX','Cartão','Dinheiro')
    or (receipt->>'method' in ('PIX','Dinheiro') and fee<>0)
    or length(coalesce(receipt->>'note',''))>1000 then raise exception 'Invalid receipt or fee'; end if;
  if fee>0 and not public.can_view_financial() then
    raise exception using errcode='42501',message='Financial access required'; end if;
  net:=amount-fee;
  select * into target from public.service_orders where id=$1 for update;
  if not found then raise exception 'Order not found'; end if;
  entries:=coalesce(target.payment->'receipts','[]'::jsonb);
  select r into saved from jsonb_array_elements(entries) r where r->>'id'=receipt_id::text;
  if saved is not null then
    if (saved->>'amount')::numeric<>amount or saved->>'method'<>receipt->>'method'
      or pitgarage_private.receipt_fee(saved)<>fee or (saved->>'date')::timestamptz<>stamp
      or coalesce(saved->>'note','')<>coalesce(receipt->>'note','') then raise exception 'Receipt id already used'; end if;
    return to_jsonb(target);
  end if;
  if target.updated_at is distinct from expected_version then raise exception using errcode='40001',message='Order version conflict'; end if;
  if target.deleted_at is not null or target.cancelled_at is not null then raise exception 'Order is unavailable'; end if;
  select coalesce(sum((i->>'price')::numeric),0)-target.discount_amount into total
    from jsonb_array_elements(target.budget) i where i->>'approval'='Aprovado';
  paid:=pitgarage_private.received_amount(target.payment);
  if amount>greatest(total-paid,0) then raise exception 'Payment exceeds outstanding balance'; end if;
  if target.payment is not null and not(target.payment?'receipts') and paid>0 then
    entries:=jsonb_build_array(jsonb_build_object('id','legacy','amount',paid,'feeAmount',0,'netAmount',paid,
      'method',target.payment->>'method','date',target.payment->>'date','note','Pagamento anterior preservado','recordedBy',''));
  end if;
  select coalesce(nullif(btrim(full_name),''),'Usuário interno') into actor_name from public.user_profiles where user_id=auth.uid();
  actor_name:=coalesce(actor_name,'Usuário interno');
  entries:=entries||jsonb_build_array(jsonb_build_object('id',receipt_id,'amount',amount,'feeAmount',fee,
    'netAmount',net,'date',stamp,'method',receipt->>'method','note',coalesce(receipt->>'note',''),
    'recordedBy',auth.uid(),'actorName',actor_name));
  paid:=paid+amount;
  result_payment:=coalesce(target.payment,'{}')||jsonb_build_object('receipts',entries,'amount',paid,
    'method',receipt->>'method','date',stamp,'status',case when paid>=total then 'Pago' else 'Parcial' end);
  update public.service_orders set payment=result_payment,
    activities=coalesce(target.activities,'[]')||jsonb_build_array(jsonb_build_object('id','a-'||gen_random_uuid(),
      'type','payment','description','Recebimento registrado: '||amount::text||' por '||(receipt->>'method'),
      'recordedBy',auth.uid(),'actorName',actor_name,'at',clock_timestamp())),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond') where id=$1 returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.record_order_payment(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.record_order_payment(uuid,timestamptz,jsonb) to authenticated;

alter function public.create_quick_service_order(uuid,uuid,jsonb,uuid,text,text,integer,text,numeric,numeric,text,numeric,text,jsonb)
  rename to create_quick_service_order_before_financial_result;
revoke all on function public.create_quick_service_order_before_financial_result(uuid,uuid,jsonb,uuid,text,text,integer,text,numeric,numeric,text,numeric,text,jsonb)
  from public,anon,authenticated;

create function public.create_quick_service_order(request_id uuid,existing_customer_id uuid,new_customer jsonb,
  existing_vehicle_id uuid,vehicle_brand text,vehicle_model text,vehicle_year integer,service_name text,
  service_amount numeric,discount_amount numeric,discount_reason text,received_amount numeric,
  payment_method text,workshop_snapshot jsonb,internal_cost numeric default null,card_fee numeric default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target jsonb; created_order_id uuid; created_item_id text; existing_cost numeric; current_receipt jsonb;
begin
  if internal_cost is not null and (internal_cost<0 or internal_cost>100000000 or internal_cost<>round(internal_cost,2))
    then raise exception 'Informe um custo interno válido.'; end if;
  if coalesce(card_fee,0)<0 or card_fee>received_amount or card_fee<>round(card_fee,2) then raise exception 'Informe uma taxa válida.'; end if;
  if payment_method in ('PIX','Dinheiro') and coalesce(card_fee,0)<>0 then raise exception 'PIX e Dinheiro exigem taxa zero.'; end if;
  if coalesce(card_fee,0)>0 and payment_method is distinct from 'Cartão' then raise exception 'Taxa financeira disponível somente para Cartão.'; end if;
  if (internal_cost is not null or coalesce(card_fee,0)>0) and not public.can_view_financial() then
    raise exception using errcode='42501',message='Financial access required'; end if;
  target:=public.create_quick_service_order_before_financial_result(request_id,existing_customer_id,new_customer,
    existing_vehicle_id,vehicle_brand,vehicle_model,vehicle_year,service_name,service_amount,discount_amount,
    discount_reason,received_amount,payment_method,workshop_snapshot);
  created_order_id:=(target->>'id')::uuid; created_item_id:='quick-'||request_id;
  if internal_cost is not null then
    select f.unit_cost into existing_cost from public.order_part_financials f
      where f.order_id=created_order_id and f.item_id=created_item_id;
    if found and existing_cost is distinct from internal_cost then raise exception 'Identificador de criação já utilizado com outro custo.'; end if;
    insert into public.order_part_financials(order_id,item_id,unit_cost,markup)
      values(created_order_id,created_item_id,internal_cost,null)
      on conflict on constraint order_part_financials_pkey do nothing;
  end if;
  if received_amount>0 then
    select r into current_receipt from jsonb_array_elements(coalesce(target->'payment'->'receipts','[]')) r
      where r->>'id'=request_id::text;
    if current_receipt?'feeAmount' and pitgarage_private.receipt_fee(current_receipt) is distinct from card_fee then
      raise exception 'Identificador de criação já utilizado com outra taxa.'; end if;
    update public.service_orders s set payment=jsonb_set(s.payment,'{receipts}',(
      select jsonb_agg(case when r->>'id'=request_id::text then r||jsonb_build_object(
        'feeAmount',card_fee,'netAmount',received_amount-card_fee) else r end)
      from jsonb_array_elements(s.payment->'receipts') r)) where s.id=created_order_id returning to_jsonb(s.*) into target;
  end if;
  return target;
end $$;
revoke all on function public.create_quick_service_order(uuid,uuid,jsonb,uuid,text,text,integer,text,numeric,numeric,text,numeric,text,jsonb,numeric,numeric) from public,anon;
grant execute on function public.create_quick_service_order(uuid,uuid,jsonb,uuid,text,text,integer,text,numeric,numeric,text,numeric,text,jsonb,numeric,numeric) to authenticated;

alter function public.create_service_order_atomic(uuid,jsonb,uuid,jsonb,jsonb)
  rename to create_service_order_atomic_before_financial_result;
revoke all on function public.create_service_order_atomic_before_financial_result(uuid,jsonb,uuid,jsonb,jsonb)
  from public,anon,authenticated;
create function public.create_service_order_atomic(existing_customer_id uuid,new_customer jsonb,
  existing_vehicle_id uuid,new_vehicle jsonb,order_data jsonb) returns public.service_orders
language plpgsql security definer set search_path='' as $$
declare target public.service_orders; internal_cost numeric:=nullif(order_data->>'internalCost','')::numeric;
  card_fee numeric:=coalesce((order_data->>'cardFee')::numeric,0); method text:=order_data->>'paymentMethod';
  request_id uuid:=nullif(order_data->>'creationRequestId','')::uuid; receipt_id text;
begin
  if internal_cost is not null and (internal_cost<0 or internal_cost>100000000 or internal_cost<>round(internal_cost,2)) then raise exception 'Informe um custo interno válido.'; end if;
  if card_fee<0 or card_fee>coalesce((order_data->>'receivedAmount')::numeric,0) or card_fee<>round(card_fee,2) then raise exception 'Informe uma taxa válida.'; end if;
  if method in ('PIX','Dinheiro') and card_fee<>0 then raise exception 'PIX e Dinheiro exigem taxa zero.'; end if;
  if card_fee>0 and method is distinct from 'Cartão' then raise exception 'Taxa financeira disponível somente para Cartão.'; end if;
  if (internal_cost is not null or card_fee>0) and not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
  target:=public.create_service_order_atomic_before_financial_result(existing_customer_id,new_customer,existing_vehicle_id,new_vehicle,order_data);
  if request_id is not null and internal_cost is not null then
    insert into public.order_part_financials(order_id,item_id,unit_cost,markup)
      values(target.id,'quick-'||request_id,internal_cost,null) on conflict on constraint order_part_financials_pkey do nothing;
  end if;
  if request_id is not null and target.payment is not null then
    receipt_id:=request_id::text;
    update public.service_orders s set payment=jsonb_set(s.payment,'{receipts}',(
      select jsonb_agg(case when r->>'id'=receipt_id then r||jsonb_build_object('feeAmount',card_fee,
        'netAmount',(r->>'amount')::numeric-card_fee) else r end) from jsonb_array_elements(s.payment->'receipts')r))
      where s.id=target.id returning * into target;
  end if;
  return target;
end $$;
revoke all on function public.create_service_order_atomic(uuid,jsonb,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.create_service_order_atomic(uuid,jsonb,uuid,jsonb,jsonb) to authenticated;

create or replace function public.save_part_financial(order_id uuid,expected_version timestamptz,
  item_id text,unit_cost numeric,markup numeric,quantity integer,unit_price numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.service_orders; item jsonb; replacement jsonb; next_budget jsonb; sale_changed boolean;
begin
  if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
  if quantity is null or quantity not between 1 and 100000 or unit_price is null or unit_price not between 0 and 100000000
    or (unit_cost is not null and unit_cost not between 0 and 100000000) or (markup is not null and markup not between 0 and 100000)
    then raise exception 'Invalid item values'; end if;
  select * into target from public.service_orders where id=$1 for update;
  if not found then raise exception 'Order not found'; end if;
  if target.updated_at is distinct from expected_version then raise exception using errcode='40001',message='Order version conflict'; end if;
  if (select count(*) from jsonb_array_elements(target.budget)b where b->>'id'=item_id and b->>'type' in ('Peça','Serviço'))<>1
    then raise exception 'Budget item not found or duplicated'; end if;
  select b into item from jsonb_array_elements(target.budget)b where b->>'id'=item_id;
  sale_changed:=quantity::numeric is distinct from coalesce((item->>'quantity')::numeric,1)
    or unit_price is distinct from coalesce((item->>'unitPrice')::numeric,(item->>'price')::numeric/coalesce((item->>'quantity')::numeric,1));
  if (item->>'approval' is distinct from 'Aguardando aprovação' or item->>'executed'='true'
    or target.status in ('Serviço concluído','Aguardando retirada','Entregue')) and sale_changed
    then raise exception 'Reopen approval through the existing workflow before changing quantity or sale price'; end if;
  replacement:=case when sale_changed then item||jsonb_build_object('quantity',quantity,'unitPrice',unit_price,'price',round(unit_price*quantity,2)) else item end;
  select jsonb_agg(case when b->>'id'=item_id then replacement else b end order by n) into next_budget
    from jsonb_array_elements(target.budget) with ordinality e(b,n);
  insert into public.order_part_financials(order_id,item_id,unit_cost,markup) values($1,$3,$4,$5)
    on conflict on constraint order_part_financials_pkey do update set unit_cost=excluded.unit_cost,markup=excluded.markup,updated_at=clock_timestamp();
  update public.service_orders set budget=next_budget,
    activities=activities||jsonb_build_array(jsonb_build_object('id','a-'||gen_random_uuid(),'type','budget',
      'description','Dados financeiros do item atualizados','at',clock_timestamp())),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond') where id=$1 returning * into target;
  return to_jsonb(target);
end $$;

create function public.correct_order_financial(order_id uuid,expected_version timestamptz,request_id uuid,
  correction_type text,payload jsonb,reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target public.service_orders; saved public.financial_correction_audit; before_value jsonb; after_value jsonb;
  actor_name text; entries jsonb; receipt_id text; amount numeric; fee numeric; paid numeric; subtotal numeric;
  corrected_item_id text; unit_cost numeric; method text;
begin
  if not pitgarage_private.is_team_member() or not public.can_view_financial() then
    raise exception using errcode='42501',message='Financial access required'; end if;
  if request_id is null or length(btrim(coalesce(reason,''))) not between 1 and 1000 then raise exception 'Motivo obrigatório.'; end if;
  select * into saved from public.financial_correction_audit where financial_correction_audit.request_id=$3;
  if found then
    if saved.order_id is distinct from $1 or saved.target_type is distinct from correction_type
      or saved.request_payload is distinct from payload or saved.reason is distinct from btrim(reason)
      or saved.recorded_by is distinct from auth.uid() then raise exception 'Correction request id already used'; end if;
    return to_jsonb((select s from public.service_orders s where s.id=saved.order_id));
  end if;
  select * into target from public.service_orders where id=$1 for update;
  if not found then raise exception 'Order not found'; end if;
  if target.updated_at is distinct from expected_version then raise exception using errcode='40001',message='Order version conflict'; end if;
  if target.deleted_at is not null or target.cancelled_at is not null then raise exception 'Order is unavailable'; end if;
  if correction_type='receipt' then
    receipt_id:=payload->>'receiptId'; amount:=(payload->>'amount')::numeric; fee:=coalesce((payload->>'feeAmount')::numeric,0); method:=payload->>'method';
    if amount<=0 or amount>100000000 or amount<>round(amount,2) or fee<0 or fee>amount or fee<>round(fee,2)
      or method not in ('PIX','Cartão','Dinheiro') or (method in ('PIX','Dinheiro') and fee<>0) then raise exception 'Invalid receipt or fee'; end if;
    entries:=coalesce(target.payment->'receipts','[]');
    select r into before_value from jsonb_array_elements(entries) r where r->>'id'=receipt_id;
    if before_value is null then raise exception 'Receipt not found'; end if;
    after_value:=before_value||jsonb_build_object('amount',amount,'method',method,'feeAmount',fee,'netAmount',amount-fee);
    select jsonb_agg(case when r->>'id'=receipt_id then after_value else r end) into entries from jsonb_array_elements(entries) r;
    select coalesce(sum((r->>'amount')::numeric),0) into paid from jsonb_array_elements(entries) r;
    select coalesce(sum((i->>'price')::numeric),0)-target.discount_amount into subtotal from jsonb_array_elements(target.budget) i where i->>'approval'='Aprovado';
    if paid>subtotal then raise exception 'Payments exceed final total'; end if;
    target.payment:=coalesce(target.payment,'{}')||jsonb_build_object('receipts',entries,'amount',paid,
      'status',case when paid>=subtotal then 'Pago' when paid>0 then 'Parcial' else 'Em aberto' end);
  elsif correction_type='discount' then
    amount:=(payload->>'amount')::numeric; before_value:=jsonb_build_object('amount',target.discount_amount,'reason',target.discount_reason);
    select coalesce(sum((i->>'price')::numeric),0) into subtotal from jsonb_array_elements(target.budget) i where i->>'approval'='Aprovado';
    paid:=pitgarage_private.received_amount(target.payment);
    if amount<0 or amount>subtotal or amount<>round(amount,2) or subtotal-amount<paid then raise exception 'Invalid discount correction'; end if;
    target.discount_amount:=amount; target.discount_reason:=coalesce(payload->>'discountReason','');
    after_value:=jsonb_build_object('amount',amount,'reason',target.discount_reason);
  elsif correction_type='cost' then
    corrected_item_id:=payload->>'itemId'; unit_cost:=nullif(payload->>'unitCost','')::numeric;
    if not exists(select 1 from jsonb_array_elements(target.budget) b where b->>'id'=corrected_item_id and b->>'type' in ('Peça','Serviço'))
      then raise exception 'Budget item not found'; end if;
    if unit_cost is not null and (unit_cost<0 or unit_cost>100000000 or unit_cost<>round(unit_cost,2)) then raise exception 'Invalid cost'; end if;
    select jsonb_build_object('unitCost',unit_cost) into after_value;
    select jsonb_build_object('unitCost',f.unit_cost) into before_value from public.order_part_financials f where f.order_id=$1 and f.item_id=corrected_item_id;
    before_value:=coalesce(before_value,jsonb_build_object('unitCost',null));
    insert into public.order_part_financials(order_id,item_id,unit_cost,markup) values($1,corrected_item_id,unit_cost,null)
      on conflict on constraint order_part_financials_pkey do update set unit_cost=excluded.unit_cost,updated_at=clock_timestamp();
  else raise exception 'Invalid correction type'; end if;
  select coalesce(nullif(btrim(full_name),''),'Usuário interno') into actor_name from public.user_profiles where user_id=auth.uid();
  actor_name:=coalesce(actor_name,'Usuário interno');
  update public.service_orders set payment=target.payment,discount_amount=target.discount_amount,
    discount_reason=target.discount_reason,activities=coalesce(target.activities,'[]')||jsonb_build_array(jsonb_build_object(
      'id','a-'||request_id,'type','payment','action','financial_correction','requestId',request_id,
      'description','Correção financeira registrada','recordedBy',auth.uid(),'actorName',actor_name,'at',clock_timestamp())),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond') where id=$1 returning * into target;
  insert into public.financial_correction_audit(order_id,request_id,target_type,target_id,request_payload,previous_value,new_value,reason,recorded_by,actor_name)
    values($1,$3,correction_type,coalesce(receipt_id,corrected_item_id),payload,before_value,after_value,btrim(reason),auth.uid(),actor_name);
  return to_jsonb(target);
end $$;
revoke all on function public.correct_order_financial(uuid,timestamptz,uuid,text,jsonb,text) from public,anon;
grant execute on function public.correct_order_financial(uuid,timestamptz,uuid,text,jsonb,text) to authenticated;

create function public.get_financial_corrections(order_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.financial_correction_audit a where a.order_id=$1),'[]');
end $$;
revoke all on function public.get_financial_corrections(uuid) from public,anon;
grant execute on function public.get_financial_corrections(uuid) to authenticated;

create or replace function public.order_receivables() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'number',s.order_number,'customerId',s.customer_id,
   'kind',v.kind,'vehicle',coalesce(nullif(concat_ws(' ',v.brand,v.model,v.plate),''),nullif(concat_ws(' ',s.quick_vehicle_brand,s.quick_vehicle_model,s.quick_vehicle_year::text),'')),
   'date',coalesce(s.completed_at,s.opened_at),'subtotal',tot.total,'discountAmount',s.discount_amount,
   'total',tot.total-s.discount_amount,'paid',pitgarage_private.received_amount(s.payment),
   'balance',greatest(tot.total-s.discount_amount-pitgarage_private.received_amount(s.payment),0),'payment',s.payment))
 from public.service_orders s left join public.vehicles v on v.id=s.vehicle_id
 cross join lateral(select coalesce(sum((i->>'price')::numeric),0) total from jsonb_array_elements(s.budget)i where i->>'approval'='Aprovado')tot
 where s.deleted_at is null and s.cancelled_at is null),'[]');
end $$;

create or replace function public.financial_order_report() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('orderId',s.id,'orderNumber','OS-'||s.order_number,
   'vehicle',coalesce(nullif(concat_ws(' ',v.brand,v.model,v.plate),''),nullif(concat_ws(' ',s.quick_vehicle_brand,s.quick_vehicle_model,s.quick_vehicle_year::text),'')),
   'customer',c.name,'kind',v.kind,'completedAt',s.completed_at,'discountAmount',s.discount_amount,
   'paid',pitgarage_private.received_amount(s.payment),'fees',pitgarage_private.payment_fees(s.payment),
   'netReceived',pitgarage_private.net_received(s.payment),'items',(select coalesce(jsonb_agg(jsonb_build_object(
     'type',b->>'type','name',b->>'name','quantity',case when not(b?'quantity') then 1 else (b->>'quantity')::numeric end,
     'revenue',case when jsonb_typeof(b->'price')='number' then (b->>'price')::numeric end,'unitCost',f.unit_cost) order by n),'[]')
     from jsonb_array_elements(s.budget) with ordinality e(b,n) left join public.order_part_financials f on f.order_id=s.id and f.item_id=b->>'id'
     where b->>'type' in ('Peça','Serviço') and b->>'approval'='Aprovado' and b->>'executed'='true'))
   order by s.completed_at desc nulls last,s.order_number desc),'[]') from public.service_orders s
   left join public.vehicles v on v.id=s.vehicle_id left join public.customers c on c.id=s.customer_id
   where s.status in ('Serviço concluído','Aguardando retirada','Entregue'));
end $$;

create or replace function pitgarage_private.create_structured_backup() returns uuid
language plpgsql security definer set search_path='' as $$
declare backup_id uuid; snapshot jsonb;
begin
 if not pg_try_advisory_xact_lock(1740293101) then return null; end if;
 if exists(select 1 from pitgarage_private.structured_backups where created_at>clock_timestamp()-interval '72 hours') then return null; end if;
 select jsonb_build_object('format','pitgarage-local-backup','formatVersion',1,'exportedAt',clock_timestamp(),
  'workshop',(select jsonb_build_object('name',w.name,'legalName',w.legal_name,'cnpj',w.cnpj,'phone',w.phone,
    'address',w.address,'postalCode',w.postal_code,'hours',w.hours) from public.workshop_settings w),
  'data',jsonb_build_object(
   'customers',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'authUserId',auth_user_id,
     'name',name,'phone',phone,'email',email,'cpf',cpf,'since',since,'deletedAt',deleted_at))),'[]') from public.customers),
   'vehicles',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'customerId',customer_id,
     'kind',kind,'brand',brand,'model',model,'year',year,'plate',plate,'mileage',mileage,'color',color,'deletedAt',deleted_at))),'[]') from public.vehicles),
   'orders',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id','OS-'||s.order_number,
     'databaseId',s.id,'customerId',s.customer_id,'vehicleId',s.vehicle_id,'flowType',s.flow_type,
     'quickVehicleBrand',s.quick_vehicle_brand,'quickVehicleModel',s.quick_vehicle_model,
     'quickVehicleYear',s.quick_vehicle_year,'creationRequestId',s.creation_request_id,
     'status',s.status,'openedAt',s.opened_at,'completedAt',s.completed_at,'entryMileage',s.entry_mileage,
     'complaint',s.complaint,'diagnosis',s.diagnosis,'findings',s.findings,'notes',s.notes,'team',s.team,
     'budget',s.budget,'evidence',s.evidence,'payment',s.payment,'discountAmount',s.discount_amount,
     'discountReason',s.discount_reason,'warrantyDays',s.warranty_days,'statusHistory',s.status_history,
     'activities',s.activities,'workshopSnapshot',s.workshop_snapshot,'updatedAt',s.updated_at))),'[]')
     from public.service_orders s)),
  'cloud',jsonb_build_object('version',1,'mediaIncluded',false,'workshopSettingsAvailable',true,
   'tables',jsonb_build_object(
    'revenue_categories',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.revenue_categories t),
    'extra_revenues',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.extra_revenues t),
    'quotes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.quotes t),
    'quote_item_financials',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.quote_item_financials t),
    'customers',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.customers t),
    'vehicles',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.vehicles t),
    'service_orders',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.service_orders t),
    'user_profiles',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.user_profiles t),
    'financial_permissions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.financial_permissions t),
    'order_part_financials',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.order_part_financials t),
    'financial_correction_audit',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.financial_correction_audit t),
    'legacy_financial_budgets',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from pitgarage_private.legacy_financial_budgets t),
    'calendar_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.calendar_events t),
    'notifications',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.notifications t),
    'conversations',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.conversations t),
    'conversation_members',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.conversation_members t),
    'messages',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.messages t),
    'workshop_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.workshop_settings t)))) into snapshot;
 insert into pitgarage_private.structured_backups(payload) values(snapshot) returning id into backup_id;
 return backup_id;
end $$;
revoke all on function pitgarage_private.create_structured_backup() from public,anon,authenticated;

commit;
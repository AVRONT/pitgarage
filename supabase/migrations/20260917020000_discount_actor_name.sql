-- Local preparation only. Preserve UUID, financial rules, grants and historical events.
-- Requires 20260917010000_order_commercial_discount.sql; no historical backfill.
begin;
create or replace function public.set_order_discount(order_id uuid, expected_version timestamptz,
  request_id uuid, amount numeric, reason text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare target public.service_orders; subtotal numeric; paid numeric; saved jsonb; note text := coalesce(reason,''); actor_name text;
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
  -- The display snapshot comes only from the authenticated internal profile.
  select nullif(btrim(p.full_name),'') into actor_name
    from public.user_profiles p where p.user_id=auth.uid();
  update public.service_orders set discount_amount=amount,discount_reason=note,
    activities=coalesce(target.activities,'[]')||jsonb_build_array(jsonb_build_object(
      'id','a-'||request_id,'type','payment','action','commercial_discount','requestId',request_id,
      'previousAmount',target.discount_amount,'newAmount',amount,'previousReason',target.discount_reason,
      'reason',note,'recordedBy',auth.uid(),'actorName',coalesce(actor_name,'Usuário interno'),'at',clock_timestamp(),
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
commit;

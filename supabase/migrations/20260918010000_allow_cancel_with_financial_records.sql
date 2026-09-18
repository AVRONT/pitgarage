begin;

create or replace function public.cancel_service_order(
  order_id uuid,
  expected_version timestamptz,
  reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.service_orders;
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin'), true) then
    raise exception using errcode = '42501', message = 'Somente proprietário ou administrador pode cancelar uma OS';
  end if;
  if btrim(coalesce(reason, '')) = '' then
    raise exception using errcode = '22023', message = 'Informe o motivo do cancelamento';
  end if;

  select * into target from public.service_orders where id = $1 for update;
  if not found then
    raise exception using errcode = '40001', message = 'OS não encontrada; recarregue a lista';
  end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode = '40001', message = 'Order version conflict';
  end if;
  if target.cancelled_at is not null then
    raise exception using errcode = '42501', message = 'Esta OS já está cancelada';
  end if;

  update public.service_orders set
    cancelled_at = clock_timestamp(),
    cancelled_by = auth.uid(),
    cancel_reason = btrim(reason),
    activities = coalesce(target.activities, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'a-' || gen_random_uuid(),
      'type', 'status',
      'description', 'OS cancelada: ' || btrim(reason),
      'at', clock_timestamp()
    )),
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
  where id = $1
  returning * into target;

  return to_jsonb(target);
end
$$;

revoke all on function public.cancel_service_order(uuid, timestamptz, text) from public, anon;
grant execute on function public.cancel_service_order(uuid, timestamptz, text) to authenticated;

create or replace function public.financial_order_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_view_financial() then
    raise exception using errcode = '42501', message = 'Financial access required';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'orderId', s.id,
      'orderNumber', 'OS-' || s.order_number,
      'vehicle', coalesce(
        nullif(concat_ws(' ', v.brand, v.model, v.plate), ''),
        nullif(concat_ws(' ', s.quick_vehicle_brand, s.quick_vehicle_model, s.quick_vehicle_year::text), '')
      ),
      'customer', c.name,
      'kind', v.kind,
      'completedAt', s.completed_at,
      'discountAmount', s.discount_amount,
      'paid', pitgarage_private.received_amount(s.payment),
      'fees', pitgarage_private.payment_fees(s.payment),
      'netReceived', pitgarage_private.net_received(s.payment),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'type', b->>'type',
          'name', b->>'name',
          'quantity', case when not (b ? 'quantity') then 1 else (b->>'quantity')::numeric end,
          'revenue', case when jsonb_typeof(b->'price') = 'number' then (b->>'price')::numeric end,
          'unitCost', f.unit_cost
        ) order by n), '[]')
        from jsonb_array_elements(s.budget) with ordinality e(b, n)
        left join public.order_part_financials f on f.order_id = s.id and f.item_id = b->>'id'
        where b->>'type' in ('Peça','Serviço')
          and b->>'approval' = 'Aprovado'
          and b->>'executed' = 'true'
      )
    ) order by s.completed_at desc nulls last, s.order_number desc), '[]')
    from public.service_orders s
    left join public.vehicles v on v.id = s.vehicle_id
    left join public.customers c on c.id = s.customer_id
    where s.cancelled_at is null
      and s.status in ('Serviço concluído','Aguardando retirada','Entregue')
  );
end
$$;

revoke all on function public.financial_order_report() from public, anon;
grant execute on function public.financial_order_report() to authenticated;

commit;

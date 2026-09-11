-- Project the existing budget item name; preserve calculations and function permissions.
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
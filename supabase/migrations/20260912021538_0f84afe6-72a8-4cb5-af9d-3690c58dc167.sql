create function public.add_budget_item(
  order_id uuid, expected_version timestamptz, item_id text, item_name text,
  item_type text, unit_cost numeric, markup numeric, quantity integer, unit_price numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.service_orders; item jsonb;
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin','staff'),true) then
    raise exception using errcode='42501',message='Workshop access required';
  end if;
  if (unit_cost is not null or markup is not null) and not public.can_view_financial() then
    raise exception using errcode='42501',message='Financial access required';
  end if;
  if item_type is null or item_type not in ('Peça','Serviço')
    or nullif(btrim(item_id),'') is null or nullif(btrim(item_name),'') is null
    or quantity is null or quantity not between 1 and 100000
    or unit_price is null or unit_price not between 0 and 100000000
    or (unit_cost is not null and unit_cost not between 0 and 100000000)
    or (markup is not null and markup not between 0 and 100000)
    or (item_type='Serviço' and (quantity<>1 or unit_cost is not null or markup is not null)) then
    raise exception 'Invalid item values';
  end if;
  select * into target from public.service_orders where id=$1 for update;
  if not found then raise exception 'Order not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode='40001',message='Order version conflict';
  end if;
  if exists(select 1 from jsonb_array_elements(target.budget) b where b->>'id'=item_id) then
    raise exception using errcode='40001',message='Item already exists; reload order';
  end if;
  item := jsonb_build_object('id',item_id,'type',item_type,'name',btrim(item_name),
    'price',round(unit_price*quantity,2),'approval','Aguardando aprovação','executed',false);
  if item_type='Peça' then
    item := item || jsonb_build_object('quantity',quantity,'unitPrice',unit_price,'availability','Disponível');
  end if;
  update public.service_orders set budget=target.budget || jsonb_build_array(item),
    activities=target.activities || jsonb_build_array(jsonb_build_object('id','a-'||gen_random_uuid(),
      'type','budget','description','Item incluído no orçamento: '||btrim(item_name),'at',clock_timestamp())),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond')
    where id=$1 returning * into target;
  if item_type='Peça' and public.can_view_financial() then
    insert into public.order_part_financials(order_id,item_id,unit_cost,markup) values($1,$3,$6,$7);
  end if;
  return to_jsonb(target);
end $$;
revoke all on function public.add_budget_item(uuid,timestamptz,text,text,text,numeric,numeric,integer,numeric) from public,anon;
grant execute on function public.add_budget_item(uuid,timestamptz,text,text,text,numeric,numeric,integer,numeric) to authenticated;
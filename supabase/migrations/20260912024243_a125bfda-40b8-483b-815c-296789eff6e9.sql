begin;
create function public.remove_budget_item(order_id uuid, expected_version timestamptz, item_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.service_orders; removed jsonb;
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin','staff'),true) then
    raise exception using errcode='42501',message='Workshop access required';
  end if;
  select * into target from public.service_orders where id=$1 for update;
  if not found then raise exception 'Order not found'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode='40001',message='Order version conflict';
  end if;
  select b into removed from jsonb_array_elements(target.budget) b where b->>'id'=$3;
  if removed is null then raise exception using errcode='40001',message='Item not found; reload order'; end if;
  if target.status not in ('Recebido','Em diagnóstico','Aguardando aprovação')
    or coalesce(removed->>'executed','false') <> 'false' then
    raise exception 'Return to budget through the order workflow before removing this item';
  end if;
  delete from public.order_part_financials f where f.order_id=$1 and f.item_id=$3;
  update public.service_orders set
    budget=(select coalesce(jsonb_agg(b order by ordinal),'[]'::jsonb)
      from jsonb_array_elements(target.budget) with ordinality entries(b,ordinal)
      where b->>'id' is distinct from $3),
    activities=coalesce(target.activities,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id','a-'||gen_random_uuid(),'type','budget','description','Item removido do orçamento: '||(removed->>'name'),'at',clock_timestamp())),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond')
    where id=$1 returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.remove_budget_item(uuid,timestamptz,text) from public,anon;
grant execute on function public.remove_budget_item(uuid,timestamptz,text) to authenticated;
commit;
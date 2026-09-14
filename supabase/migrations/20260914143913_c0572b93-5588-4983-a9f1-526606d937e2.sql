begin;

alter table public.service_orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancel_reason text;

create or replace function pitgarage_private.order_is_deletable(target public.service_orders)
returns boolean language sql stable set search_path = '' as $$
  select target.status = 'Recebido'
    and target.cancelled_at is null
    and btrim(coalesce(target.diagnosis, '')) = ''
    and btrim(coalesce(target.findings, '')) = ''
    and coalesce(jsonb_array_length(target.budget), 0) = 0
    and coalesce(jsonb_array_length(target.evidence), 0) = 0
    and target.payment is null
    and target.completed_at is null
    and not exists (select 1 from public.order_part_financials f where f.order_id = target.id)
$$;

create or replace function pitgarage_private.guard_order_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin'), true) then
    raise exception using errcode = '42501', message = 'Somente proprietário ou administrador pode excluir uma OS';
  end if;
  if not pitgarage_private.order_is_deletable(old) then
    raise exception using errcode = '42501', message = 'Esta OS já possui movimentação e não pode ser excluída';
  end if;
  update public.calendar_events set service_order_id = null, updated_at = clock_timestamp()
    where service_order_id = old.id;
  delete from public.order_part_financials f where f.order_id = old.id;
  return old;
end $$;

drop trigger if exists guard_order_delete on public.service_orders;
create trigger guard_order_delete before delete on public.service_orders
  for each row execute function pitgarage_private.guard_order_delete();

create or replace function pitgarage_private.guard_cancelled_order()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.cancelled_at is not null then
    raise exception using errcode = '42501', message = 'OS cancelada é somente leitura';
  end if;
  return new;
end $$;

drop trigger if exists guard_cancelled_order on public.service_orders;
create trigger guard_cancelled_order before update on public.service_orders
  for each row execute function pitgarage_private.guard_cancelled_order();

create or replace function public.delete_service_order(order_id uuid, expected_version timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.service_orders;
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin'), true) then
    raise exception using errcode = '42501', message = 'Somente proprietário ou administrador pode excluir uma OS';
  end if;
  select * into target from public.service_orders where id = $1 for update;
  if not found then raise exception using errcode = '40001', message = 'OS não encontrada; recarregue a lista'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode = '40001', message = 'Order version conflict';
  end if;
  if not pitgarage_private.order_is_deletable(target) then
    raise exception using errcode = '42501', message = 'Esta OS já possui movimentação e não pode ser excluída';
  end if;
  delete from public.service_orders where id = $1;
end $$;

revoke all on function public.delete_service_order(uuid, timestamptz) from public, anon;
grant execute on function public.delete_service_order(uuid, timestamptz) to authenticated;

create or replace function public.cancel_service_order(order_id uuid, expected_version timestamptz, reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.service_orders;
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin'), true) then
    raise exception using errcode = '42501', message = 'Somente proprietário ou administrador pode cancelar uma OS';
  end if;
  if btrim(coalesce(reason, '')) = '' then
    raise exception using errcode = '22023', message = 'Informe o motivo do cancelamento';
  end if;
  select * into target from public.service_orders where id = $1 for update;
  if not found then raise exception using errcode = '40001', message = 'OS não encontrada; recarregue a lista'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode = '40001', message = 'Order version conflict';
  end if;
  if target.cancelled_at is not null then
    raise exception using errcode = '42501', message = 'Esta OS já está cancelada';
  end if;
  if target.payment is not null
    or target.status in ('Serviço concluído','Aguardando retirada','Entregue')
    or exists (
      select 1 from jsonb_array_elements(coalesce(target.budget, '[]'::jsonb)) b
      where coalesce(b->>'executed', 'false') = 'true'
    ) then
    raise exception using errcode = '42501',
      message = 'Esta OS tem pagamento registrado ou serviço executado e precisa de tratamento manual';
  end if;
  update public.service_orders set
    cancelled_at = clock_timestamp(),
    cancelled_by = auth.uid(),
    cancel_reason = btrim(reason),
    activities = coalesce(target.activities, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'a-' || gen_random_uuid(), 'type', 'status',
      'description', 'OS cancelada: ' || btrim(reason), 'at', clock_timestamp())),
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
    where id = $1 returning * into target;
  return to_jsonb(target);
end $$;

revoke all on function public.cancel_service_order(uuid, timestamptz, text) from public, anon;
grant execute on function public.cancel_service_order(uuid, timestamptz, text) to authenticated;

commit;
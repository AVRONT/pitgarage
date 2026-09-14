begin;

create or replace function public.update_order_complaint(order_id uuid, expected_version timestamptz, new_complaint text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.service_orders; cleaned text;
begin
  if coalesce(pitgarage_private.current_access_level() not in ('owner','admin','staff'), true) then
    raise exception using errcode = '42501', message = 'Sem permissão para editar o problema relatado';
  end if;
  cleaned := btrim(coalesce(new_complaint, ''));
  if cleaned = '' then
    raise exception using errcode = '22023', message = 'Informe o problema relatado';
  end if;
  if length(cleaned) > 2000 then
    raise exception using errcode = '22023', message = 'Texto muito longo (máximo 2000 caracteres)';
  end if;
  select * into target from public.service_orders where id = $1 for update;
  if not found then raise exception using errcode = '40001', message = 'OS não encontrada; recarregue a lista'; end if;
  if target.updated_at is distinct from expected_version then
    raise exception using errcode = '40001', message = 'Order version conflict';
  end if;
  if target.cancelled_at is not null then
    raise exception using errcode = '42501', message = 'OS cancelada é somente leitura';
  end if;
  if target.status in ('Serviço concluído','Aguardando retirada','Entregue') or target.completed_at is not null then
    raise exception using errcode = '42501', message = 'OS concluída ou entregue não pode ter o problema relatado alterado';
  end if;
  if cleaned = btrim(coalesce(target.complaint, '')) then
    return to_jsonb(target);
  end if;
  update public.service_orders set
    complaint = cleaned,
    activities = coalesce(target.activities, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'a-' || gen_random_uuid(), 'type', 'diagnosis',
      'description', 'Problema relatado editado de "' || coalesce(target.complaint, '') || '" para "' || cleaned || '"',
      'at', clock_timestamp(), 'by', auth.uid())),
    updated_at = greatest(clock_timestamp(), target.updated_at + interval '1 millisecond')
    where id = $1 returning * into target;
  return to_jsonb(target);
end $$;

revoke all on function public.update_order_complaint(uuid, timestamptz, text) from public, anon;
grant execute on function public.update_order_complaint(uuid, timestamptz, text) to authenticated;

commit;
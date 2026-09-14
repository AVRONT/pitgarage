create or replace function pitgarage_private.guard_team_abuse()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
  actor_level public.access_level := pitgarage_private.current_access_level();
begin
  if tg_op = 'INSERT' then
    if new.access_level = 'owner' then
      raise exception using errcode = '42501', message = 'Não é permitido criar outro proprietário.';
    end if;
    return new; -- Auth-created customer profile remains unchanged.
  end if;
  if tg_op = 'DELETE' then
    if old.access_level = 'owner' then
      raise exception using errcode = '42501', message = 'Contas de proprietário estão protegidas.';
    end if;
    return old;
  end if;
  -- Administrative maintenance runs without a session (service role / migrations).
  -- Row level security already blocks anon and customer roles from reaching this point.
  if actor is null then
    return new;
  end if;
  if actor_level not in ('owner','admin') then
    raise exception using errcode = '42501', message = 'Somente proprietário ou administrador pode alterar a equipe.';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception using errcode = '42501', message = 'A identidade do perfil está protegida.';
  end if;
  if actor_level <> 'owner' and (old.access_level = 'owner' or new.access_level = 'owner') then
    raise exception using errcode = '42501', message = 'Somente o proprietário gerencia contas de proprietário.';
  end if;
  if not pitgarage_private.consume_abuse_budget('team', actor::text, 30, 60)
    or not pitgarage_private.consume_abuse_budget('team', actor::text, 200, 3600) then
    raise exception using errcode = 'PT429', message = 'Muitas alterações na equipe. Aguarde e tente novamente.';
  end if;
  return new;
end $$;

begin;
alter table public.quotes add column vehicle_model_text text, add column vehicle_plate_text text;
alter table public.quotes add constraint quote_vehicle_text_valid check(
 (vehicle_model_text is null or length(vehicle_model_text)<=200) and
 (vehicle_plate_text is null or vehicle_plate_text ~ '^[A-Z0-9]{7}$')
);
create function public.create_quote_snapshot(customer uuid, vehicle uuid, quote_description text, quote_notes text,
 contact_name text, contact_phone text, contact_email text, vehicle_model_text text, vehicle_plate_text text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.quotes; created jsonb; plate text;
begin
 perform pitgarage_private.require_quote_access();
 plate := nullif(upper(regexp_replace(coalesce(vehicle_plate_text,''),'[^a-zA-Z0-9]','','g')),'');
 if vehicle is not null and (nullif(btrim(vehicle_model_text),'') is not null or plate is not null) then raise exception 'Choose a registered vehicle or manual vehicle data'; end if;
 created := public.create_quote(customer,vehicle,quote_description,quote_notes,contact_name,contact_phone,contact_email);
 update public.quotes set vehicle_model_text=nullif(btrim($8),''),vehicle_plate_text=plate where id=(created->>'id')::uuid returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function public.create_quote_snapshot(uuid,uuid,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.create_quote_snapshot(uuid,uuid,text,text,text,text,text,text,text) to authenticated;

create function public.match_quote_vehicle(quote_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare target public.quotes;
begin
 perform pitgarage_private.require_quote_access();
 select * into target from public.quotes where id=$1;
 if not found or target.customer_id is null then raise exception 'Link customer first'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'customerId',v.customer_id,'model',v.model,'plate',v.plate,'deleted',v.deleted_at is not null))
 from public.vehicles v where v.plate=target.vehicle_plate_text),'[]'::jsonb);
end $$;
revoke all on function public.match_quote_vehicle(uuid) from public,anon;
grant execute on function public.match_quote_vehicle(uuid) to authenticated;

create function public.convert_quote_with_vehicle(quote_id uuid, expected_version timestamptz, vehicle uuid, new_vehicle jsonb, entry_mileage integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.quotes; chosen uuid; chosen_plate text;
begin
 perform pitgarage_private.require_quote_access();
 select * into target from public.quotes where id=$1 for update;
 if not found then raise exception 'Quote not found'; end if;
 if target.updated_at is distinct from expected_version then raise exception using errcode='40001',message='Quote version conflict'; end if;
 if target.customer_id is null then raise exception 'Link customer first'; end if;
 if target.status='Convertido' or target.service_order_id is not null then raise exception using errcode='40001',message='Quote already converted'; end if;
 if new_vehicle is not null then
   if vehicle is not null or target.vehicle_id is not null then raise exception 'Choose only one vehicle'; end if;
   chosen_plate := upper(regexp_replace(coalesce(new_vehicle->>'plate',''),'[^a-zA-Z0-9]','','g'));
   if chosen_plate !~ '^[A-Z0-9]{7}$' or coalesce(new_vehicle->>'kind','') not in ('Carro','Moto') or coalesce(btrim(new_vehicle->>'brand'),'')='' or coalesce(btrim(new_vehicle->>'model'),'')='' then raise exception 'Required vehicle data missing'; end if;
   if target.vehicle_plate_text is not null and chosen_plate<>target.vehicle_plate_text then raise exception 'Plate must match quote snapshot'; end if;
   if exists(select 1 from public.vehicles v where v.plate=chosen_plate) then raise exception 'Plate already registered; link the existing vehicle'; end if;
   insert into public.vehicles(customer_id,kind,brand,model,year,plate,mileage,color)
   values(target.customer_id,new_vehicle->>'kind',btrim(new_vehicle->>'brand'),btrim(new_vehicle->>'model'),
     (new_vehicle->>'year')::integer,chosen_plate,coalesce(entry_mileage,0),coalesce(new_vehicle->>'color','')) returning id into chosen;
 else
   chosen := coalesce(vehicle,target.vehicle_id);
   if target.vehicle_id is null and target.vehicle_plate_text is not null and not exists(
     select 1 from public.vehicles v where v.id=chosen and v.plate=target.vehicle_plate_text
   ) then raise exception 'Vehicle plate must match quote snapshot'; end if;
 end if;
 -- Existing conversion validates customer ownership, duplicate conversion and copies protected costs.
 return public.convert_quote_to_order(quote_id,expected_version,chosen,entry_mileage);
end $$;
revoke all on function public.convert_quote_with_vehicle(uuid,timestamptz,uuid,jsonb,integer) from public,anon;
grant execute on function public.convert_quote_with_vehicle(uuid,timestamptz,uuid,jsonb,integer) to authenticated;
-- Also covers callers of the original conversion RPC: snapshot plate cannot be bypassed.
create function pitgarage_private.check_quote_vehicle_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.vehicle_id is not null and new.vehicle_id is distinct from old.vehicle_id
   and old.vehicle_plate_text is not null
   and not exists(select 1 from public.vehicles v where v.id=new.vehicle_id and v.plate=old.vehicle_plate_text) then
   raise exception 'Vehicle plate must match quote snapshot';
 end if;
 return new;
end $$;
revoke all on function pitgarage_private.check_quote_vehicle_snapshot() from public,anon,authenticated;
create trigger check_quote_vehicle_snapshot before update on public.quotes
for each row execute function pitgarage_private.check_quote_vehicle_snapshot();
commit;

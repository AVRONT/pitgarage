-- Local preparation only. Apply together with the frontend after explicit authorization.
begin;

alter table public.service_orders alter column vehicle_id drop not null;
alter table public.service_orders
  add column if not exists flow_type text not null default 'standard',
  add column if not exists quick_vehicle_brand text,
  add column if not exists quick_vehicle_model text,
  add column if not exists quick_vehicle_year integer,
  add column if not exists creation_request_id uuid;

alter table public.service_orders
  add constraint service_orders_flow_type_check check (flow_type in ('standard','quick')),
  add constraint service_orders_vehicle_identity_check check (
    (flow_type='standard' and vehicle_id is not null)
    or
    (flow_type='quick' and nullif(btrim(quick_vehicle_brand),'') is not null
      and nullif(btrim(quick_vehicle_model),'') is not null
      and quick_vehicle_year between 1900 and 2100)
  );

create unique index service_orders_creation_request_id_idx
  on public.service_orders (creation_request_id) where creation_request_id is not null;

create or replace function pitgarage_private.protect_delivered_quick_order() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.flow_type='quick' and old.status='Entregue' and
    (new.status is distinct from old.status or new.flow_type is distinct from old.flow_type
      or new.vehicle_id is distinct from old.vehicle_id) then
    raise exception 'Uma OS Rápida entregue não pode ser reaberta ou convertida.';
  end if;
  return new;
end $$;
revoke all on function pitgarage_private.protect_delivered_quick_order() from public,anon,authenticated;
create trigger protect_delivered_quick_order before update on public.service_orders
for each row execute function pitgarage_private.protect_delivered_quick_order();

create or replace function pitgarage_private.current_warranty_days() returns integer
language sql stable security definer set search_path='' as $$ select 90 $$;
revoke all on function pitgarage_private.current_warranty_days() from public,anon,authenticated;

create or replace function public.create_service_order_atomic(existing_customer_id uuid,new_customer jsonb,
  existing_vehicle_id uuid,new_vehicle jsonb,order_data jsonb) returns public.service_orders
language plpgsql security definer set search_path='' as $$
declare resolved_customer_id uuid:=existing_customer_id; resolved_vehicle_id uuid:=existing_vehicle_id;
  possible_auth_user_id uuid; created_order public.service_orders; request_id uuid;
  seed_amount numeric; seed_discount numeric; seed_received numeric; seed_method text; seed_service text;
  seed_payment jsonb:=null; actor_name text; stamp timestamptz:=clock_timestamp();
begin
  if not pitgarage_private.is_team_member() then raise exception 'team access required'; end if;
  if (existing_customer_id is null)=(new_customer is null) or (existing_vehicle_id is null)=(new_vehicle is null)
    then raise exception 'provide either existing or new customer and vehicle'; end if;
  if nullif(btrim(order_data->>'complaint'),'') is null then raise exception 'complaint required'; end if;
  request_id:=nullif(order_data->>'creationRequestId','')::uuid;
  if request_id is not null then
    select * into created_order from public.service_orders where creation_request_id=request_id;
    if found then return created_order; end if;
  end if;
  if resolved_customer_id is null then
    possible_auth_user_id:=pitgarage_private.find_confirmed_auth_user(new_customer->>'email');
    if possible_auth_user_id is not null and exists(select 1 from public.customers where auth_user_id=possible_auth_user_id) then possible_auth_user_id:=null; end if;
    insert into public.customers(name,phone,email,cpf,since,auth_user_id) values(new_customer->>'name',
      regexp_replace(new_customer->>'phone','[^0-9]','','g'),coalesce(new_customer->>'email',''),
      nullif(regexp_replace(new_customer->>'cpf','[^0-9]','','g'),''),
      coalesce(new_customer->>'since',extract(year from current_date)::text),possible_auth_user_id)
      returning id into resolved_customer_id;
  end if;
  perform 1 from public.customers where id=resolved_customer_id and deleted_at is null for update;
  if not found then raise exception 'active customer required'; end if;
  if resolved_vehicle_id is null then
    insert into public.vehicles(customer_id,kind,brand,model,year,plate,mileage,color) values(resolved_customer_id,
      new_vehicle->>'kind',new_vehicle->>'brand',new_vehicle->>'model',(new_vehicle->>'year')::integer,
      upper(regexp_replace(new_vehicle->>'plate','[^A-Za-z0-9]','','g')),(new_vehicle->>'mileage')::integer,new_vehicle->>'color')
      returning id into resolved_vehicle_id;
  end if;
  perform 1 from public.vehicles where id=resolved_vehicle_id and customer_id=resolved_customer_id and deleted_at is null for update;
  if not found then raise exception 'vehicle does not belong to customer'; end if;

  if request_id is not null then
    seed_service:=btrim(coalesce(order_data->>'seedService',''));
    seed_amount:=(order_data->>'seedAmount')::numeric; seed_discount:=coalesce((order_data->>'discountAmount')::numeric,0);
    seed_received:=coalesce((order_data->>'receivedAmount')::numeric,0); seed_method:=order_data->>'paymentMethod';
    if seed_service='' or seed_amount<=0 or seed_discount<0 or seed_discount>seed_amount
      or seed_received<0 or seed_received>seed_amount-seed_discount then raise exception 'invalid quick draft values'; end if;
    if seed_received>0 and (seed_method is null or seed_method not in ('Dinheiro','PIX','Cartão')) then raise exception 'payment method required'; end if;
    if seed_discount>0 and not coalesce(pitgarage_private.current_access_level() in ('owner','admin') or public.can_view_financial(),false)
      then raise exception using errcode='42501',message='Você não tem permissão para aplicar desconto comercial.'; end if;
    select coalesce(nullif(btrim(full_name),''),'Usuário interno') into actor_name from public.user_profiles where user_id=auth.uid();
    actor_name:=coalesce(actor_name,'Usuário interno');
    if seed_received>0 then seed_payment:=jsonb_build_object('amount',seed_received,'method',seed_method,'date',stamp,
      'status',case when seed_received=seed_amount-seed_discount then 'Pago' else 'Parcial' end,
      'receipts',jsonb_build_array(jsonb_build_object('id',request_id,'amount',seed_received,'method',seed_method,
        'date',stamp,'note','','recordedBy',auth.uid(),'actorName',actor_name))); end if;
  end if;
  insert into public.service_orders(customer_id,vehicle_id,flow_type,quick_vehicle_brand,quick_vehicle_model,
    quick_vehicle_year,creation_request_id,status,opened_at,entry_mileage,complaint,diagnosis,findings,notes,team,
    budget,evidence,payment,discount_amount,discount_reason,status_history,activities)
  values(resolved_customer_id,resolved_vehicle_id,'standard',order_data->>'quickVehicleBrand',order_data->>'quickVehicleModel',
    nullif(order_data->>'quickVehicleYear','')::integer,request_id,'Recebido',current_date,
    (order_data->>'entryMileage')::integer,order_data->>'complaint','','','','[]'::jsonb,
    case when request_id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id','quick-'||request_id,
      'type','Serviço','name',seed_service,'price',seed_amount,'approval','Aprovado','executed',true)) end,
    '[]'::jsonb,seed_payment,coalesce(seed_discount,0),coalesce(order_data->>'discountReason',''),'[]'::jsonb,
    jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','created',
      'description',case when request_id is null then 'OS criada' else 'Rascunho rápido continuado como OS completa' end,
      'recordedBy',auth.uid(),'actorName',coalesce(actor_name,'Usuário interno'),'at',stamp))) returning * into created_order;
  return created_order;
end $$;

create or replace function public.create_quick_service_order(
  request_id uuid,
  existing_customer_id uuid,
  new_customer jsonb,
  existing_vehicle_id uuid,
  vehicle_brand text,
  vehicle_model text,
  vehicle_year integer,
  service_name text,
  service_amount numeric,
  discount_amount numeric default 0,
  discount_reason text default '',
  received_amount numeric default 0,
  payment_method text default null,
  workshop_snapshot jsonb default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  resolved_customer_id uuid := existing_customer_id;
  target public.service_orders;
  existing public.service_orders;
  clean_brand text := btrim(coalesce(vehicle_brand,''));
  clean_model text := btrim(coalesce(vehicle_model,''));
  clean_service text := btrim(coalesce(service_name,''));
  clean_reason text := coalesce(discount_reason,'');
  clean_phone text;
  clean_cpf text;
  final_total numeric;
  actor_name text;
  receipt jsonb := null;
  payment_data jsonb := null;
  events jsonb;
  stamp timestamptz := clock_timestamp();
begin
  if not pitgarage_private.is_team_member() then
    raise exception using errcode='42501',message='Acesso operacional necessário.';
  end if;
  if request_id is null then raise exception 'Identificador da solicitação obrigatório.'; end if;

  select * into existing from public.service_orders where creation_request_id=request_id;
  if found then
    if not exists (select 1 from jsonb_array_elements(coalesce(existing.activities,'[]'::jsonb)) a
      where a->>'type'='created' and a->>'recordedBy'=auth.uid()::text) then
      raise exception using errcode='42501',message='Identificador da solicitação já utilizado.';
    end if;
    return to_jsonb(existing);
  end if;

  if (existing_customer_id is null) = (new_customer is null) then
    raise exception 'Selecione um cliente ou informe o cadastro rápido.';
  end if;
  if existing_vehicle_id is not null and existing_customer_id is null then
    raise exception 'Veículo existente exige cliente existente.';
  end if;
  if clean_brand='' or clean_model='' or vehicle_year not between 1900 and extract(year from current_date)::integer+1 then
    raise exception 'Informe marca, modelo e ano válidos.';
  end if;
  if clean_service='' or length(clean_service)>500 then raise exception 'Informe o serviço realizado.'; end if;
  if service_amount is null or service_amount<=0 or service_amount>100000000 or service_amount<>round(service_amount,2) then
    raise exception 'Informe um valor de serviço válido.';
  end if;
  if discount_amount is null or discount_amount<0 or discount_amount>service_amount
    or discount_amount<>round(discount_amount,2) or length(clean_reason)>1000 then
    raise exception 'Informe um desconto válido.';
  end if;
  if discount_amount>0 and not coalesce(
    pitgarage_private.current_access_level() in ('owner','admin') or public.can_view_financial(),false) then
    raise exception using errcode='42501',message='Você não tem permissão para aplicar desconto comercial.';
  end if;
  final_total := service_amount-discount_amount;
  if received_amount is null or received_amount<0 or received_amount>final_total
    or received_amount<>round(received_amount,2) then
    raise exception 'O valor recebido deve estar entre zero e o total final.';
  end if;
  if received_amount = 0 then
    payment_method := null;
  elsif received_amount > 0 and (payment_method is null or payment_method not in ('Dinheiro','PIX','Cartão')) then
    raise exception 'Selecione Dinheiro, PIX ou Cartão como forma de pagamento.';
  end if;
  if workshop_snapshot is not null and jsonb_typeof(workshop_snapshot)<>'object' then
    raise exception 'Snapshot da oficina inválido.';
  end if;

  if resolved_customer_id is null then
    clean_phone := regexp_replace(coalesce(new_customer->>'phone',''),'[^0-9]','','g');
    clean_cpf := nullif(regexp_replace(coalesce(new_customer->>'cpf',''),'[^0-9]','','g'),'');
    insert into public.customers(name,phone,email,cpf,since)
    values (new_customer->>'name',clean_phone,'',clean_cpf,extract(year from current_date)::text)
    returning id into resolved_customer_id;
  end if;
  perform 1 from public.customers where id=resolved_customer_id and deleted_at is null for update;
  if not found then raise exception 'Cliente ativo obrigatório.'; end if;

  if existing_vehicle_id is not null then
    perform 1 from public.vehicles where id=existing_vehicle_id and customer_id=resolved_customer_id
      and deleted_at is null for update;
    if not found then raise exception 'O veículo não pertence ao cliente selecionado.'; end if;
  end if;

  select nullif(btrim(full_name),'') into actor_name from public.user_profiles where user_id=auth.uid();
  actor_name := coalesce(actor_name,'Usuário interno');
  if received_amount>0 then
    receipt := jsonb_build_object('id',request_id::text,'amount',received_amount,'date',stamp,
      'method',payment_method,'note','','recordedBy',auth.uid(),'actorName',actor_name);
    payment_data := jsonb_build_object('receipts',jsonb_build_array(receipt),'amount',received_amount,
      'method',payment_method,'date',stamp,'status',case when received_amount=final_total then 'Pago' else 'Parcial' end);
  end if;
  events := jsonb_build_array(
    jsonb_build_object('id','a-created-'||request_id,'type','created','description','OS Rápida criada',
      'recordedBy',auth.uid(),'actorName',actor_name,'at',stamp),
    jsonb_build_object('id','a-service-'||request_id,'type','execution',
      'description','Serviço realizado: '||clean_service||' — R$ '||replace(round(service_amount,2)::text,'.',','),
      'recordedBy',auth.uid(),'actorName',actor_name,'at',stamp)
  );
  if discount_amount>0 then
    events := events||jsonb_build_array(jsonb_build_object('id','a-discount-'||request_id,'type','payment',
      'action','commercial_discount','requestId',request_id,'previousAmount',0,'newAmount',discount_amount,
      'reason',clean_reason,'description','Desconto comercial aplicado: R$ '||replace(round(discount_amount,2)::text,'.',','),
      'recordedBy',auth.uid(),'actorName',actor_name,'at',stamp));
  end if;
  if received_amount>0 then
    events := events||jsonb_build_array(jsonb_build_object('id','a-payment-'||request_id,'type','payment',
      'description','Recebimento registrado: '||received_amount::text||' por '||payment_method,
      'recordedBy',auth.uid(),'actorName',actor_name,'at',stamp));
  end if;
  events := events||jsonb_build_array(jsonb_build_object('id','a-delivered-'||request_id,'type','status',
    'description','Atendimento rápido finalizado e entregue','recordedBy',auth.uid(),'actorName',actor_name,'at',stamp));

  insert into public.service_orders(customer_id,vehicle_id,flow_type,quick_vehicle_brand,
    quick_vehicle_model,quick_vehicle_year,creation_request_id,status,opened_at,completed_at,
    entry_mileage,complaint,diagnosis,findings,notes,team,budget,evidence,payment,discount_amount,
    discount_reason,status_history,activities,workshop_snapshot,warranty_days)
  values(resolved_customer_id,existing_vehicle_id,'quick',clean_brand,clean_model,vehicle_year,
    request_id,'Entregue',current_date,current_date,0,clean_service,'','','','[]'::jsonb,
    jsonb_build_array(jsonb_build_object('id','quick-'||request_id,'type','Serviço','name',clean_service,
      'price',service_amount,'approval','Aprovado','executed',true)),
    '[]'::jsonb,payment_data,discount_amount,clean_reason,
    jsonb_build_array(jsonb_build_object('id','s-'||request_id,'from','Recebido','to','Entregue','at',stamp)),
    events,workshop_snapshot,pitgarage_private.current_warranty_days())
  returning * into target;
  return to_jsonb(target);
exception when unique_violation then
  select * into existing from public.service_orders where creation_request_id=request_id;
  if found then return to_jsonb(existing); end if;
  raise;
end $$;

revoke all on function public.create_quick_service_order(uuid,uuid,jsonb,uuid,text,text,integer,text,numeric,numeric,text,numeric,text,jsonb) from public,anon;
grant execute on function public.create_quick_service_order(uuid,uuid,jsonb,uuid,text,text,integer,text,numeric,numeric,text,numeric,text,jsonb) to authenticated;

create or replace function public.order_receivables() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'number',s.order_number,'customerId',s.customer_id,
   'kind',v.kind,'vehicle',coalesce(nullif(concat_ws(' ',v.brand,v.model,v.plate),''),nullif(concat_ws(' ',s.quick_vehicle_brand,s.quick_vehicle_model,s.quick_vehicle_year::text),'')),
   'date',coalesce(s.completed_at,s.opened_at),'subtotal',tot.total,'discountAmount',s.discount_amount,
   'total',tot.total-s.discount_amount,'paid',pitgarage_private.received_amount(s.payment),
   'balance',greatest(tot.total-s.discount_amount-pitgarage_private.received_amount(s.payment),0),'payment',s.payment))
 from public.service_orders s left join public.vehicles v on v.id=s.vehicle_id
 cross join lateral (select coalesce(sum((i->>'price')::numeric),0) total from jsonb_array_elements(s.budget) i where i->>'approval'='Aprovado') tot
 where s.deleted_at is null and s.cancelled_at is null),'[]'::jsonb);
end $$;
revoke all on function public.order_receivables() from public,anon;
grant execute on function public.order_receivables() to authenticated;

create or replace function public.financial_order_report() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object(
   'orderId',s.id,'orderNumber','OS-'||s.order_number,
   'vehicle',coalesce(nullif(concat_ws(' ',v.brand,v.model,v.plate),''),nullif(concat_ws(' ',s.quick_vehicle_brand,s.quick_vehicle_model,s.quick_vehicle_year::text),'')),
   'customer',c.name,'kind',v.kind,'completedAt',s.completed_at,'discountAmount',s.discount_amount,
   'items',(select coalesce(jsonb_agg(jsonb_build_object('type',b->>'type','name',b->>'name',
     'quantity',case when not (b?'quantity') then 1 when jsonb_typeof(b->'quantity')='number' then (b->>'quantity')::numeric end,
     'revenue',case when jsonb_typeof(b->'price')='number' then (b->>'price')::numeric end,
     'unitCost',case when b->>'type'='Peça' then f.unit_cost end) order by n),'[]'::jsonb)
     from jsonb_array_elements(s.budget) with ordinality e(b,n)
     left join public.order_part_financials f on f.order_id=s.id and f.item_id=b->>'id'
     where b->>'type' in ('Peça','Serviço') and b->>'approval'='Aprovado' and b->>'executed'='true'))
   order by s.completed_at desc nulls last,s.order_number desc),'[]'::jsonb)
 from public.service_orders s left join public.vehicles v on v.id=s.vehicle_id
 left join public.customers c on c.id=s.customer_id
 where s.status in ('Serviço concluído','Aguardando retirada','Entregue'));
end $$;
revoke all on function public.financial_order_report() from public,anon;
grant execute on function public.financial_order_report() to authenticated;

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
     'name',name,'phone',phone,'email',email,'cpf',cpf,'since',since,'deletedAt',deleted_at))),'[]'::jsonb) from public.customers),
   'vehicles',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',id,'customerId',customer_id,
     'kind',kind,'brand',brand,'model',model,'year',year,'plate',plate,'mileage',mileage,'color',color,'deletedAt',deleted_at))),'[]'::jsonb) from public.vehicles),
   'orders',(select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id','OS-'||s.order_number,
     'databaseId',s.id,'customerId',s.customer_id,'vehicleId',s.vehicle_id,'flowType',s.flow_type,
     'quickVehicleBrand',s.quick_vehicle_brand,'quickVehicleModel',s.quick_vehicle_model,
     'quickVehicleYear',s.quick_vehicle_year,'creationRequestId',s.creation_request_id,
     'status',s.status,'openedAt',s.opened_at,'completedAt',s.completed_at,'entryMileage',s.entry_mileage,
     'complaint',s.complaint,'diagnosis',s.diagnosis,'findings',s.findings,'notes',s.notes,'team',s.team,
     'budget',s.budget,'evidence',s.evidence,'payment',s.payment,'discountAmount',s.discount_amount,
     'discountReason',s.discount_reason,'warrantyDays',s.warranty_days,'statusHistory',s.status_history,
     'activities',s.activities,'workshopSnapshot',s.workshop_snapshot,'updatedAt',s.updated_at))),'[]'::jsonb)
     from public.service_orders s)),
  'cloud',jsonb_build_object('version',1,'mediaIncluded',false,'workshopSettingsAvailable',true,
   'tables',jsonb_build_object(
    'revenue_categories',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.revenue_categories t),
    'extra_revenues',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.extra_revenues t),
    'quotes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.quotes t),
    'quote_item_financials',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.quote_item_financials t),
    'customers',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.customers t),
    'vehicles',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.vehicles t),
    'service_orders',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.service_orders t),
    'user_profiles',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.user_profiles t),
    'financial_permissions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.financial_permissions t),
    'order_part_financials',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.order_part_financials t),
    'legacy_financial_budgets',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from pitgarage_private.legacy_financial_budgets t),
    'calendar_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.calendar_events t),
    'notifications',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.notifications t),
    'conversations',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.conversations t),
    'conversation_members',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.conversation_members t),
    'messages',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.messages t),
    'workshop_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.workshop_settings t)))) into snapshot;
 insert into pitgarage_private.structured_backups(payload) values(snapshot) returning id into backup_id;
 return backup_id;
end $$;
revoke all on function pitgarage_private.create_structured_backup() from public,anon,authenticated;

commit;

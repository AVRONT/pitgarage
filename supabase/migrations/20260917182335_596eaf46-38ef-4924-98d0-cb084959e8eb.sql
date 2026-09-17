begin;

create function public.create_quick_service_order(request_id uuid,existing_customer_id uuid,new_customer jsonb,
  existing_vehicle_id uuid,vehicle_brand text,vehicle_model text,vehicle_year integer,service_name text,
  service_amount numeric,discount_amount numeric,discount_reason text,received_amount numeric,
  payment_method text,workshop_snapshot jsonb,internal_cost numeric,card_fee numeric,
  additional_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target jsonb; created_order_id uuid; created_item_id text; existing_cost numeric; cost_found boolean; current_receipt jsonb;
  item jsonb; part_item_id text; item_name text; item_quantity integer; item_quantity_numeric numeric; item_price numeric; item_cost numeric;
  parts_total numeric:=0; final_budget jsonb; was_existing boolean; has_private_cost boolean:=internal_cost is not null;
begin
  if jsonb_typeof(coalesce(additional_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(additional_items,'[]'::jsonb))>50
    then raise exception 'Itens adicionais inválidos.'; end if;
  for item in select value from jsonb_array_elements(coalesce(additional_items,'[]'::jsonb)) loop
    part_item_id:=btrim(coalesce(item->>'id','')); item_name:=btrim(coalesce(item->>'name',''));
    if jsonb_typeof(item->'quantity')<>'number' or jsonb_typeof(item->'unitPrice')<>'number'
      or (item?'unitCost' and item->'unitCost' is distinct from 'null'::jsonb and jsonb_typeof(item->'unitCost')<>'number')
      then raise exception 'Informe quantidade, valor e custo válidos para cada peça.'; end if;
    item_quantity_numeric:=(item->>'quantity')::numeric; item_price:=(item->>'unitPrice')::numeric;
    item_cost:=nullif(item->>'unitCost','')::numeric;
    if part_item_id='' or length(part_item_id)>200 or item_name='' or length(item_name)>500
      or item_quantity_numeric<>trunc(item_quantity_numeric) or item_quantity_numeric not between 1 and 100000
      or item_price<0 or item_price>100000000 or item_price<>round(item_price,2)
      or (item_cost is not null and (item_cost<0 or item_cost>100000000 or item_cost<>round(item_cost,2)))
      then raise exception 'Informe dados válidos para cada peça.'; end if;
    item_quantity:=item_quantity_numeric::integer;
    if part_item_id='quick-'||request_id or exists(select 1 from jsonb_array_elements(coalesce(additional_items,'[]'::jsonb)) duplicate where duplicate->>'id'=part_item_id group by duplicate->>'id' having count(*)>1)
      then raise exception 'Identificador de peça duplicado.'; end if;
    parts_total:=parts_total+round(item_quantity*item_price,2);
    has_private_cost:=has_private_cost or item_cost is not null;
  end loop;
  if internal_cost is not null and (internal_cost<0 or internal_cost>100000000 or internal_cost<>round(internal_cost,2))
    then raise exception 'Informe um custo interno válido.'; end if;
  if coalesce(card_fee,0)<0 or card_fee>received_amount or card_fee<>round(card_fee,2) then raise exception 'Informe uma taxa válida.'; end if;
  if payment_method in ('PIX','Dinheiro') and coalesce(card_fee,0)<>0 then raise exception 'PIX e Dinheiro exigem taxa zero.'; end if;
  if coalesce(card_fee,0)>0 and payment_method is distinct from 'Cartão' then raise exception 'Taxa financeira disponível somente para Cartão.'; end if;
  if (has_private_cost or coalesce(card_fee,0)>0) and not public.can_view_financial() then
    raise exception using errcode='42501',message='Financial access required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,1740293102));
  select exists(select 1 from public.service_orders where creation_request_id=request_id) into was_existing;
  target:=public.create_quick_service_order_before_financial_result(request_id,existing_customer_id,new_customer,
    existing_vehicle_id,vehicle_brand,vehicle_model,vehicle_year,service_name,service_amount+parts_total,discount_amount,
    discount_reason,received_amount,payment_method,workshop_snapshot);
  created_order_id:=(target->>'id')::uuid; created_item_id:='quick-'||request_id;
  if was_existing and target->>'flow_type' is distinct from 'quick' then
    raise exception 'Identificador de criação já utilizado em outro fluxo.';
  end if;
  final_budget:=jsonb_build_array(jsonb_build_object('id',created_item_id,'type','Serviço','name',btrim(service_name),
    'price',service_amount,'approval','Aprovado','executed',true));
  for item in select value from jsonb_array_elements(coalesce(additional_items,'[]'::jsonb)) loop
    item_quantity:=(item->>'quantity')::integer; item_price:=(item->>'unitPrice')::numeric;
    final_budget:=final_budget||jsonb_build_array(jsonb_build_object('id',item->>'id','type','Peça','name',btrim(item->>'name'),
      'quantity',item_quantity,'unitPrice',item_price,'price',round(item_quantity*item_price,2),'approval','Aprovado','executed',true));
  end loop;
  if was_existing and (
    (target->>'discount_amount')::numeric is distinct from discount_amount
    or target->>'discount_reason' is distinct from coalesce(discount_reason,'')
    or pitgarage_private.received_amount(target->'payment') is distinct from received_amount
    or (received_amount>0 and target->'payment'->>'method' is distinct from payment_method)
    or target->'workshop_snapshot' is distinct from coalesce(workshop_snapshot,'null'::jsonb)
    or (existing_customer_id is not null and (target->>'customer_id')::uuid is distinct from existing_customer_id)
    or (existing_vehicle_id is not null and (target->>'vehicle_id')::uuid is distinct from existing_vehicle_id)
    or (existing_vehicle_id is null and target->>'vehicle_id' is not null)
    or target->>'quick_vehicle_brand' is distinct from btrim(vehicle_brand)
    or target->>'quick_vehicle_model' is distinct from btrim(vehicle_model)
    or (target->>'quick_vehicle_year')::integer is distinct from vehicle_year
    or (new_customer is not null and not exists(select 1 from public.customers c where c.id=(target->>'customer_id')::uuid
      and c.name=new_customer->>'name' and c.phone=regexp_replace(coalesce(new_customer->>'phone',''),'[^0-9]','','g')
      and c.cpf is not distinct from nullif(regexp_replace(coalesce(new_customer->>'cpf',''),'[^0-9]','','g'),'')))
  ) then raise exception 'Identificador de criação já utilizado com outros dados.'; end if;
  if was_existing and target->'budget' is distinct from final_budget then
    raise exception 'Identificador de criação já utilizado com outros itens.';
  elsif not was_existing then
    update public.service_orders s set budget=final_budget,activities=(select jsonb_agg(
      case when event->>'id'='a-service-'||request_id then jsonb_set(event,'{description}',to_jsonb(
        'Serviço realizado: '||btrim(service_name)||' — R$ '||replace(round(service_amount,2)::text,'.',','))) else event end order by n)
      from jsonb_array_elements(s.activities) with ordinality entries(event,n))
      where s.id=created_order_id returning to_jsonb(s.*) into target;
  end if;
  select f.unit_cost into existing_cost from public.order_part_financials f
    where f.order_id=created_order_id and f.item_id=created_item_id;
  cost_found:=found;
  if was_existing and ((cost_found and existing_cost is distinct from internal_cost) or (not cost_found and internal_cost is not null)) then
    raise exception 'Identificador de criação já utilizado com outro custo.';
  end if;
  if internal_cost is not null then
    insert into public.order_part_financials(order_id,item_id,unit_cost,markup)
      values(created_order_id,created_item_id,internal_cost,null)
      on conflict on constraint order_part_financials_pkey do nothing;
  end if;
  for item in select value from jsonb_array_elements(coalesce(additional_items,'[]'::jsonb)) loop
    part_item_id:=item->>'id'; item_cost:=nullif(item->>'unitCost','')::numeric;
    select f.unit_cost into existing_cost from public.order_part_financials f where f.order_id=created_order_id and f.item_id=part_item_id;
    cost_found:=found;
    if was_existing and ((cost_found and existing_cost is distinct from item_cost) or (not cost_found and item_cost is not null)) then
      raise exception 'Identificador de criação já utilizado com outro custo.';
    end if;
    if item_cost is not null then
      insert into public.order_part_financials(order_id,item_id,unit_cost,markup) values(created_order_id,part_item_id,item_cost,null)
        on conflict on constraint order_part_financials_pkey do nothing;
    end if;
  end loop;
  if received_amount>0 then
    select r into current_receipt from jsonb_array_elements(coalesce(target->'payment'->'receipts','[]')) r
      where r->>'id'=request_id::text;
    if current_receipt?'feeAmount' and pitgarage_private.receipt_fee(current_receipt) is distinct from card_fee then
      raise exception 'Identificador de criação já utilizado com outra taxa.'; end if;
    update public.service_orders s set payment=jsonb_set(s.payment,'{receipts}',(
      select jsonb_agg(case when r->>'id'=request_id::text then r||jsonb_build_object(
        'feeAmount',card_fee,'netAmount',received_amount-card_fee) else r end)
      from jsonb_array_elements(s.payment->'receipts') r)) where s.id=created_order_id returning to_jsonb(s.*) into target;
  end if;
  return target;
end $$;
revoke all on function public.create_quick_service_order(uuid,uuid,jsonb,uuid,text,text,integer,text,numeric,numeric,text,numeric,text,jsonb,numeric,numeric,jsonb) from public,anon;
grant execute on function public.create_quick_service_order(uuid,uuid,jsonb,uuid,text,text,integer,text,numeric,numeric,text,numeric,text,jsonb,numeric,numeric,jsonb) to authenticated;

create or replace function public.create_service_order_atomic(existing_customer_id uuid,new_customer jsonb,
  existing_vehicle_id uuid,new_vehicle jsonb,order_data jsonb) returns public.service_orders
language plpgsql security definer set search_path='' as $$
declare target public.service_orders; internal_cost numeric:=nullif(order_data->>'internalCost','')::numeric;
  card_fee numeric:=coalesce((order_data->>'cardFee')::numeric,0); method text:=order_data->>'paymentMethod';
  request_id uuid:=nullif(order_data->>'creationRequestId','')::uuid; receipt_id text; additional_items jsonb:=coalesce(order_data->'additionalItems','[]'::jsonb);
  item jsonb; part_item_id text; item_name text; item_quantity integer; item_quantity_numeric numeric; item_price numeric; item_cost numeric;
  seed_amount numeric:=nullif(order_data->>'seedAmount','')::numeric; parts_total numeric:=0; final_budget jsonb;
  existing_cost numeric; cost_found boolean; was_existing boolean; has_private_cost boolean:=internal_cost is not null; base_order_data jsonb:=order_data;
begin
  if request_id is not null then
    if jsonb_typeof(additional_items)<>'array' or jsonb_array_length(additional_items)>50 then raise exception 'Itens adicionais inválidos.'; end if;
    for item in select value from jsonb_array_elements(additional_items) loop
      part_item_id:=btrim(coalesce(item->>'id','')); item_name:=btrim(coalesce(item->>'name',''));
      if jsonb_typeof(item->'quantity')<>'number' or jsonb_typeof(item->'unitPrice')<>'number'
        or (item?'unitCost' and item->'unitCost' is distinct from 'null'::jsonb and jsonb_typeof(item->'unitCost')<>'number')
        then raise exception 'Informe quantidade, valor e custo válidos para cada peça.'; end if;
      item_quantity_numeric:=(item->>'quantity')::numeric; item_price:=(item->>'unitPrice')::numeric; item_cost:=nullif(item->>'unitCost','')::numeric;
      if part_item_id='' or length(part_item_id)>200 or item_name='' or length(item_name)>500
        or item_quantity_numeric<>trunc(item_quantity_numeric) or item_quantity_numeric not between 1 and 100000
        or item_price<0 or item_price>100000000 or item_price<>round(item_price,2)
        or (item_cost is not null and (item_cost<0 or item_cost>100000000 or item_cost<>round(item_cost,2)))
        then raise exception 'Informe dados válidos para cada peça.'; end if;
      item_quantity:=item_quantity_numeric::integer;
      if part_item_id='quick-'||request_id or exists(select 1 from jsonb_array_elements(additional_items) duplicate where duplicate->>'id'=part_item_id group by duplicate->>'id' having count(*)>1)
        then raise exception 'Identificador de peça duplicado.'; end if;
      parts_total:=parts_total+round(item_quantity*item_price,2); has_private_cost:=has_private_cost or item_cost is not null;
    end loop;
    base_order_data:=order_data||jsonb_build_object('seedAmount',seed_amount+parts_total);
    perform pg_advisory_xact_lock(hashtextextended(request_id::text,1740293102));
    select exists(select 1 from public.service_orders where creation_request_id=request_id) into was_existing;
  end if;
  if internal_cost is not null and (internal_cost<0 or internal_cost>100000000 or internal_cost<>round(internal_cost,2)) then raise exception 'Informe um custo interno válido.'; end if;
  if card_fee<0 or card_fee>coalesce((order_data->>'receivedAmount')::numeric,0) or card_fee<>round(card_fee,2) then raise exception 'Informe uma taxa válida.'; end if;
  if method in ('PIX','Dinheiro') and card_fee<>0 then raise exception 'PIX e Dinheiro exigem taxa zero.'; end if;
  if card_fee>0 and method is distinct from 'Cartão' then raise exception 'Taxa financeira disponível somente para Cartão.'; end if;
  if (has_private_cost or card_fee>0) and not public.can_view_financial() then raise exception using errcode='42501',message='Financial access required'; end if;
  target:=public.create_service_order_atomic_before_financial_result(existing_customer_id,new_customer,existing_vehicle_id,new_vehicle,base_order_data);
  if request_id is not null then
    if was_existing and target.flow_type is distinct from 'standard' then
      raise exception 'Identificador de criação já utilizado em outro fluxo.';
    end if;
    final_budget:=jsonb_build_array(jsonb_build_object('id','quick-'||request_id,'type','Serviço','name',btrim(order_data->>'seedService'),
      'price',seed_amount,'approval','Aprovado','executed',true));
    for item in select value from jsonb_array_elements(additional_items) loop
      item_quantity:=(item->>'quantity')::integer; item_price:=(item->>'unitPrice')::numeric;
      final_budget:=final_budget||jsonb_build_array(jsonb_build_object('id',item->>'id','type','Peça','name',btrim(item->>'name'),
        'quantity',item_quantity,'unitPrice',item_price,'price',round(item_quantity*item_price,2),'approval','Aprovado','executed',true));
    end loop;
    if was_existing and (
      target.discount_amount is distinct from coalesce((order_data->>'discountAmount')::numeric,0)
      or target.discount_reason is distinct from coalesce(order_data->>'discountReason','')
      or pitgarage_private.received_amount(target.payment) is distinct from coalesce((order_data->>'receivedAmount')::numeric,0)
      or (coalesce((order_data->>'receivedAmount')::numeric,0)>0 and target.payment->>'method' is distinct from method)
      or target.entry_mileage is distinct from (order_data->>'entryMileage')::integer
      or target.complaint is distinct from order_data->>'complaint'
      or target.quick_vehicle_brand is distinct from order_data->>'quickVehicleBrand'
      or target.quick_vehicle_model is distinct from order_data->>'quickVehicleModel'
      or target.quick_vehicle_year is distinct from nullif(order_data->>'quickVehicleYear','')::integer
      or (existing_customer_id is not null and target.customer_id is distinct from existing_customer_id)
      or (existing_vehicle_id is not null and target.vehicle_id is distinct from existing_vehicle_id)
      or (new_customer is not null and not exists(select 1 from public.customers c where c.id=target.customer_id
        and c.name=new_customer->>'name' and c.phone=regexp_replace(coalesce(new_customer->>'phone',''),'[^0-9]','','g')
        and c.email=coalesce(new_customer->>'email','')
        and c.cpf is not distinct from nullif(regexp_replace(coalesce(new_customer->>'cpf',''),'[^0-9]','','g'),'')))
      or (new_vehicle is not null and not exists(select 1 from public.vehicles v where v.id=target.vehicle_id
        and v.kind=new_vehicle->>'kind' and v.brand=new_vehicle->>'brand' and v.model=new_vehicle->>'model'
        and v.year=(new_vehicle->>'year')::integer and v.plate=upper(regexp_replace(new_vehicle->>'plate','[^A-Za-z0-9]','','g'))
        and v.mileage=(new_vehicle->>'mileage')::integer and v.color=new_vehicle->>'color'))
    ) then raise exception 'Identificador de criação já utilizado com outros dados.'; end if;
    if was_existing and target.budget is distinct from final_budget then raise exception 'Identificador de criação já utilizado com outros itens.';
    elsif not was_existing then update public.service_orders set budget=final_budget where id=target.id returning * into target; end if;
  end if;
  if request_id is not null then
    select f.unit_cost into existing_cost from public.order_part_financials f where f.order_id=target.id and f.item_id='quick-'||request_id;
    cost_found:=found;
    if was_existing and ((cost_found and existing_cost is distinct from internal_cost) or (not cost_found and internal_cost is not null)) then
      raise exception 'Identificador de criação já utilizado com outro custo.';
    end if;
    if internal_cost is not null then
      insert into public.order_part_financials(order_id,item_id,unit_cost,markup)
        values(target.id,'quick-'||request_id,internal_cost,null) on conflict on constraint order_part_financials_pkey do nothing;
    end if;
  end if;
  if request_id is not null then
    for item in select value from jsonb_array_elements(additional_items) loop
      part_item_id:=item->>'id'; item_cost:=nullif(item->>'unitCost','')::numeric;
      select f.unit_cost into existing_cost from public.order_part_financials f where f.order_id=target.id and f.item_id=part_item_id;
      cost_found:=found;
      if was_existing and ((cost_found and existing_cost is distinct from item_cost) or (not cost_found and item_cost is not null)) then
        raise exception 'Identificador de criação já utilizado com outro custo.';
      end if;
      if item_cost is not null then
        insert into public.order_part_financials(order_id,item_id,unit_cost,markup) values(target.id,part_item_id,item_cost,null)
          on conflict on constraint order_part_financials_pkey do nothing;
      end if;
    end loop;
  end if;
  if request_id is not null and target.payment is not null then
    receipt_id:=request_id::text;
    update public.service_orders s set payment=jsonb_set(s.payment,'{receipts}',(
      select jsonb_agg(case when r->>'id'=receipt_id then r||jsonb_build_object('feeAmount',card_fee,
        'netAmount',(r->>'amount')::numeric-card_fee) else r end) from jsonb_array_elements(s.payment->'receipts')r))
      where s.id=target.id returning * into target;
  end if;
  return target;
end $$;
revoke all on function public.create_service_order_atomic(uuid,jsonb,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.create_service_order_atomic(uuid,jsonb,uuid,jsonb,jsonb) to authenticated;

commit;
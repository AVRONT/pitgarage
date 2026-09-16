begin;
-- Only extend the accepted payment methods; preserve authorization, concurrency and receipts.
create or replace function public.record_order_payment(order_id uuid, expected_version timestamptz, receipt jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.service_orders; entries jsonb; saved jsonb; paid numeric; total numeric; amount numeric; stamp timestamptz; receipt_id uuid; result_payment jsonb;
begin
  if not pitgarage_private.is_team_member() then raise exception using errcode='42501',message='Workshop access required'; end if;
  receipt_id := (receipt->>'id')::uuid;
  amount := (receipt->>'amount')::numeric; stamp := (receipt->>'date')::timestamptz;
  if receipt_id is null or amount is null or amount not between 0.01 and 100000000 or amount<>round(amount,2)
    or stamp is null or not isfinite(stamp) or coalesce(receipt->>'method','') not in ('PIX','Cartão','Dinheiro')
    or length(coalesce(receipt->>'note',''))>1000 then raise exception 'Invalid receipt'; end if;
  select * into target from public.service_orders where id=$1 for update;
  if not found then raise exception 'Order not found'; end if;
  entries := coalesce(target.payment->'receipts','[]'::jsonb);
  select r into saved from jsonb_array_elements(entries) r where r->>'id'=receipt_id::text;
  if saved is not null then
    if (saved->>'amount')::numeric<>amount or saved->>'method'<>receipt->>'method' or (saved->>'date')::timestamptz<>stamp or coalesce(saved->>'note','')<>coalesce(receipt->>'note','') then
      raise exception 'Receipt id already used';
    end if;
    return to_jsonb(target);
  end if;
  if target.updated_at is distinct from expected_version then raise exception using errcode='40001',message='Order version conflict'; end if;
  if target.deleted_at is not null then raise exception 'Order is deleted'; end if;
  -- Current cancellation is encoded by the operational schema; check JSON for compatibility.
  if to_jsonb(target)->>'cancelled_at' is not null then raise exception 'Order is cancelled'; end if;
  select coalesce(sum((i->>'price')::numeric),0) into total from jsonb_array_elements(target.budget) i where i->>'approval'='Aprovado';
  paid := pitgarage_private.received_amount(target.payment);
  if amount>greatest(total-paid,0) then raise exception 'Payment exceeds outstanding balance'; end if;
  if target.payment is not null and not (target.payment ? 'receipts') and paid>0 then
    entries := jsonb_build_array(jsonb_build_object('id','legacy','amount',paid,'method',target.payment->>'method',
      'date',target.payment->>'date','note','Pagamento anterior preservado','recordedBy',''));
  end if;
  entries := entries || jsonb_build_array(jsonb_build_object('id',receipt_id,'amount',amount,'date',stamp,
    'method',receipt->>'method','note',coalesce(receipt->>'note',''),'recordedBy',auth.uid()));
  paid := paid+amount;
  result_payment := coalesce(target.payment,'{}'::jsonb) || jsonb_build_object('receipts',entries,'amount',paid,
    'method',receipt->>'method','date',stamp,'status',case when paid>=total then 'Pago' else 'Parcial' end);
  if target.payment is not null and not (target.payment ? 'receipts') then result_payment := result_payment || jsonb_build_object('legacy',target.payment); end if;
  update public.service_orders set payment=result_payment,
    activities=coalesce(target.activities,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('id','a-'||gen_random_uuid(),'type','payment',
      'description','Recebimento registrado: '||amount::text||' por '||(receipt->>'method'),'at',clock_timestamp())),
    updated_at=greatest(clock_timestamp(),target.updated_at+interval '1 millisecond')
  where id=$1 returning * into target;
  return to_jsonb(target);
end $$;
revoke all on function public.record_order_payment(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.record_order_payment(uuid,timestamptz,jsonb) to authenticated;
commit;

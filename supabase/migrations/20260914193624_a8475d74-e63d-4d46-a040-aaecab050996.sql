alter table public.service_orders add column if not exists warranty_days integer;
comment on column public.service_orders.warranty_days is 'Warranty term in days frozen when the order was completed; historical orders keep 30.';
update public.service_orders set warranty_days = 30 where completed_at is not null and warranty_days is null;
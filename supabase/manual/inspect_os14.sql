-- SOMENTE INSPEÇÃO. Não é migration e não efetua limpeza.
-- Antes de executar manualmente, conferir no painel/conexão o projeto
-- vzvwprzmlhvfehwykstx. current_database() não comprova o project ref.
-- Usar sessão administrativa autorizada, com visibilidade integral (sem filtro RLS).
-- Resultado contém dados operacionais: não publicar nem commitar a saída.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';
set local row_security = off; -- falha em vez de aceitar resultado filtrado por RLS

-- Exatamente uma linha deve ser encontrada; zero/mais de uma impede prosseguir.
select current_database() as database_name, current_user as inspection_role,
       transaction_timestamp() as inspected_at, count(*) as candidate_count,
       count(*) = 1 as unique_candidate
from public.service_orders where order_number = 14;

select s.id, s.order_number, s.customer_id, c.name as customer_name,
       s.vehicle_id, v.brand, v.model, v.plate, s.status,
       s.created_at, s.updated_at as expected_version, s.opened_at,
       s.completed_at, s.deleted_at, to_jsonb(s)->'cancelled_at' as cancelled_at,
       md5(to_jsonb(s)::text) as row_fingerprint,
       s.budget, s.payment, s.status_history, s.activities,
       s.evidence,
       to_jsonb(s)->'discount_amount' as discount_amount,
       to_jsonb(s)->'discount_reason' as discount_reason,
       to_jsonb(s) ? 'discount_amount' as discount_column_present
from public.service_orders s
join public.customers c on c.id = s.customer_id
join public.vehicles v on v.id = s.vehicle_id
where s.order_number = 14;

-- Mantém os dados dos dependentes para revisão; ausência de tabela é bloqueio,
-- não autorização para ignorá-la ou aplicar migrations automaticamente.
select f.* from public.order_part_financials f
join public.service_orders s on s.id = f.order_id where s.order_number = 14;
select e.* from public.calendar_events e
join public.service_orders s on s.id = e.service_order_id where s.order_number = 14;
select q.* from public.quotes q
join public.service_orders s on s.id = q.service_order_id where s.order_number = 14;
select f.* from public.quote_item_financials f
join public.quotes q on q.id = f.quote_id
join public.service_orders s on s.id = q.service_order_id where s.order_number = 14;
select n.* from public.notifications n
join public.service_orders s on n.metadata->>'service_order_id' = s.id::text
where s.order_number = 14;

-- FK transitivas de entrada e saída imediata da OS. Dependências desconhecidas
-- exigem inspeção específica dos registros antes de formular qualquer limpeza.
with recursive scope(oid) as (
  select 'public.service_orders'::regclass::oid
  union
  select c.conrelid from pg_constraint c join scope s on c.confrelid = s.oid
  where c.contype = 'f'
)
select c.conname, c.conrelid::regclass as source_table,
       c.confrelid::regclass as target_table, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.contype = 'f' and
  (c.confrelid in (select oid from scope) or c.conrelid in (select oid from scope))
order by c.conrelid::regclass::text, c.conname;

with recursive scope(oid) as (
  select 'public.service_orders'::regclass::oid
  union
  select c.conrelid from pg_constraint c join scope s on c.confrelid = s.oid
  where c.contype = 'f'
), inspected as (
  select oid from scope
  union select 'public.notifications'::regclass::oid
)
select t.tgrelid::regclass as relation, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid) as trigger_definition,
       case when not t.tgisinternal then pg_get_functiondef(t.tgfoid) end as function_definition
from pg_trigger t where t.tgrelid in (select oid from inspected)
order by t.tgrelid::regclass::text, t.tgname;

-- Função auxiliar da proteção: sua regra real pode diferir do checkout local.
select pg_get_functiondef(p.oid) as deletion_rule
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'pitgarage_private' and p.proname = 'order_is_deletable';

-- Somente leitura da sequência. Nunca nextval/setval/RESTART; não reutilizar 14.
select last_value, is_called from public.service_order_number_seq;
rollback;

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const migration = new URL("../supabase/migrations/20260917030000_quick_service_orders.sql", import.meta.url);

test("quick order migration is explicit, idempotent, protected and financially compatible", async () => {
  const sql = await readFile(migration, "utf8");
  for (const token of [
    "flow_type", "quick_vehicle_brand", "quick_vehicle_model", "quick_vehicle_year",
    "creation_request_id", "create_quick_service_order", "pitgarage_private.is_team_member()",
    "protect_delivered_quick_order",
    "'Entregue'", "warranty_days", "Dinheiro", "PIX", "Cartão",
    "left join public.vehicles", "order_receivables", "financial_order_report",
  ]) assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(sql, /unique[\s\S]*creation_request_id/i);
  assert.match(sql, /received_amount\s*=\s*0[\s\S]*payment_method/is);
  assert.match(sql, /received_amount\s*>\s*0[\s\S]*payment_method/is);
  assert.match(sql, /existing[\s\S]*creation_request_id[\s\S]*return/is);
  assert.doesNotMatch(sql, /convert_quick_order_to_standard/i);
});

const runtime = process.env.PITGARAGE_PGLITE_PATH;
test("quick order migration runs in PostgreSQL and preserves operational invariants", { skip: !runtime }, async (t) => {
  const { PGlite } = await import(pathToFileURL(runtime + "/dist/index.js").href);
  const db = new PGlite();
  const actor = "00000000-0000-4000-8000-000000000001";
  const customer = "00000000-0000-4000-8000-000000000002";
  const vehicle = "00000000-0000-4000-8000-000000000003";
  const rpc = async (name, values) => (await db.query(
    `select public.${name}(${values.map((_, index) => "$" + (index + 1)).join(",")}) result`, values)).rows[0].result;
  const standardRpc = async (values) => (await db.query(
    `select to_jsonb(public.create_service_order_atomic(${values.map((_, index) => "$" + (index + 1)).join(",")})) result`, values)).rows[0].result;
  const quick = (requestId, received = 0, method = null, discount = 0) => rpc("create_quick_service_order", [
    requestId, customer, null, null, "Honda", "CG 160", 2023, "Troca de óleo", 180,
    discount, discount ? "PIX" : "", received, method, null,
  ]);
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema pitgarage_private;
      create function auth.uid() returns uuid language sql as $$ select current_setting('test.actor')::uuid $$;
      create function pitgarage_private.current_access_level() returns text language sql as $$ select current_setting('test.access',true) $$;
      create function pitgarage_private.is_team_member() returns boolean language sql as $$ select coalesce(pitgarage_private.current_access_level() in ('owner','admin','staff'),false) $$;
      create function pitgarage_private.find_confirmed_auth_user(customer_email text) returns uuid language sql as $$ select null::uuid $$;
      create function public.can_view_financial() returns boolean language sql as $$ select pitgarage_private.current_access_level() in ('owner','admin','staff') $$;
      create function pitgarage_private.received_amount(value jsonb) returns numeric language sql immutable as $$
        select coalesce((select sum((entry->>'amount')::numeric) from jsonb_array_elements(coalesce(value->'receipts','[]')) entry),
          case when value->>'status'='Pago' then coalesce((value->>'amount')::numeric,0) else 0 end,0) $$;
      create table public.user_profiles(user_id uuid primary key,full_name text);
      create table public.customers(id uuid primary key default gen_random_uuid(),auth_user_id uuid,name text not null,
        phone text not null unique,email text not null,cpf text unique,since text not null default '2026',deleted_at timestamptz);
      create table public.vehicles(id uuid primary key default gen_random_uuid(),customer_id uuid not null references customers(id),
        kind text not null,brand text not null,model text not null,year integer not null,plate text not null unique,
        mileage integer not null,color text not null,deleted_at timestamptz,unique(id,customer_id));
      create sequence public.service_order_number_seq start 1;
      create table public.service_orders(id uuid primary key default gen_random_uuid(),order_number bigint not null unique default nextval('service_order_number_seq'),
        customer_id uuid not null references customers(id),vehicle_id uuid not null references vehicles(id),status text not null,
        opened_at date not null default current_date,completed_at date,entry_mileage integer not null,complaint text not null,
        diagnosis text not null default '',findings text not null default '',notes text not null default '',team jsonb not null default '[]',
        budget jsonb not null default '[]',evidence jsonb not null default '[]',payment jsonb,discount_amount numeric not null default 0,
        discount_reason text not null default '',status_history jsonb not null default '[]',activities jsonb not null default '[]',
        workshop_snapshot jsonb,warranty_days integer,deleted_at timestamptz,cancelled_at timestamptz,updated_at timestamptz not null default clock_timestamp(),
        foreign key(vehicle_id,customer_id) references vehicles(id,customer_id));
      create table public.order_part_financials(order_id uuid,item_id text,unit_cost numeric);
      create table public.workshop_settings(name text,legal_name text,cnpj text,phone text,address text,postal_code text,hours text);
      create table pitgarage_private.structured_backups(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),payload jsonb);
      insert into user_profiles values('${actor}','Salomão');
      insert into customers(id,name,phone,email) values('${customer}','Cliente','11999999999','');
      insert into vehicles values('${vehicle}','${customer}','Moto','Honda','CG 160',2023,'ABC1D23',1000,'Preta',null);
      set test.actor='${actor}'; set test.access='owner';
    `);
    await db.exec(await readFile(migration, "utf8"));

    await t.test("snapshot quick, zero payment, warranty, finance and idempotency", async () => {
      const request = crypto.randomUUID();
      const first = await quick(request);
      assert.equal(first.flow_type, "quick"); assert.equal(first.vehicle_id, null);
      assert.equal(first.status, "Entregue"); assert.equal(first.payment, null);
      assert.equal(first.warranty_days, 90); assert.equal(first.order_number, 1);
      assert.equal((await quick(request)).id, first.id);
      assert.equal((await db.query("select count(*)::int count from service_orders")).rows[0].count, 1);
      const receivable = (await rpc("order_receivables", [])).find((row) => row.id === first.id);
      assert.equal(receivable.balance, 180); assert.match(receivable.vehicle, /Honda CG 160 2023/);
      const report = (await rpc("financial_order_report", [])).find((row) => row.orderId === first.id);
      assert.equal(report.items[0].revenue, 180); assert.match(report.vehicle, /Honda CG 160 2023/);
    });

    await t.test("positive payment requires supported method; partial and discount persist", async () => {
      await assert.rejects(quick(crypto.randomUUID(), 10, null), /Dinheiro, PIX ou Cartão/);
      await assert.rejects(quick(crypto.randomUUID(), 10, "Cheque"), /Dinheiro, PIX ou Cartão/);
      const partial = await quick(crypto.randomUUID(), 100, "PIX", 10);
      assert.equal(partial.payment.status, "Parcial"); assert.equal(partial.payment.amount, 100);
      assert.equal(partial.discount_amount, 10); assert.equal(partial.discount_reason, "PIX");
      for (const method of ["Dinheiro","PIX","Cartão"])
        assert.equal((await quick(crypto.randomUUID(), 170, method, 10)).payment.method, method);
    });

    await t.test("customer is blocked", async () => {
      await db.exec("set test.access='customer'");
      await assert.rejects(quick(crypto.randomUUID()), /Acesso operacional/);
      await db.exec("set test.access='owner'");
    });

    await t.test("standard still requires official vehicle and quick draft continues directly as standard", async () => {
      await assert.rejects(standardRpc([customer,null,null,null,{ entryMileage: 0, complaint: "Teste" }]), /vehicle/);
      const request = crypto.randomUUID();
      const standard = await standardRpc([customer,null,vehicle,null,{
        entryMileage: 1000, complaint: "Troca de óleo", creationRequestId: request,
        quickVehicleBrand: "Honda", quickVehicleModel: "CG 160", quickVehicleYear: 2023,
        seedService: "Troca de óleo", seedAmount: 180, discountAmount: 10, discountReason: "PIX",
        receivedAmount: 100, paymentMethod: "PIX",
      }]);
      assert.equal(standard.flow_type, "standard"); assert.equal(standard.status, "Recebido");
      assert.equal(standard.vehicle_id, vehicle); assert.equal(standard.budget[0].name, "Troca de óleo");
      assert.equal(standard.discount_amount, 10); assert.equal(standard.payment.amount, 100);
      assert.equal((await standardRpc([customer,null,vehicle,null,{
        entryMileage: 1000, complaint: "Troca de óleo", creationRequestId: request,
        quickVehicleBrand: "Honda", quickVehicleModel: "CG 160", quickVehicleYear: 2023,
        seedService: "Troca de óleo", seedAmount: 180, discountAmount: 10, discountReason: "PIX", receivedAmount: 100, paymentMethod: "PIX",
      }])).id, standard.id);
      assert.equal((await db.query("select count(*)::int count from service_orders where creation_request_id=$1", [request])).rows[0].count, 1);
      assert.ok(standard.order_number > 1);
    });

    await t.test("delivered quick cannot be reopened, converted or linked later", async () => {
      const order = await quick(crypto.randomUUID());
      await assert.rejects(db.query("update service_orders set status='Recebido' where id=$1", [order.id]), /não pode ser reaberta/);
      await assert.rejects(db.query("update service_orders set flow_type='standard',vehicle_id=$2 where id=$1", [order.id,vehicle]), /não pode ser reaberta/);
    });
  } finally { await db.close(); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const runtime = process.env.PITGARAGE_PGLITE_PATH;
test("commercial discount RPC, permissions, receipts and financial projections in local PostgreSQL", { skip: !runtime }, async t => {
  const { PGlite } = await import(pathToFileURL(runtime + "/dist/index.js").href);
  const db = new PGlite();
  const actor = "00000000-0000-4000-8000-000000000001";
  const read = name => readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
  const call = async (name, values = []) => (await db.query(
    `select public.${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) result`, values)).rows[0].result;
  const load = async id => (await db.query("select to_jsonb(s) result from service_orders s where id=$1", [id])).rows[0].result;
  const create = async () => {
    const id = crypto.randomUUID();
    await db.query(`insert into service_orders(id,customer_id,vehicle_id,budget) values($1,$2,$2,$3)`, [id, actor,
      [{ id: "p", type: "Peça", price: 1000, approval: "Aprovado", executed: true },
        { id: "s", type: "Serviço", price: 560, approval: "Aprovado", executed: true }]]);
    await db.query("insert into order_part_financials values($1,'p',900,30)", [id]);
    return load(id);
  };
  const discount = (order, amount = 60, reason = "PIX", id = crypto.randomUUID()) =>
    call("set_order_discount", [order.id, order.updated_at, id, amount, reason]);
  const receipt = (order, amount) => call("record_order_payment", [order.id, order.updated_at,
    { id: crypto.randomUUID(), amount, method: "PIX", date: "2026-09-16T12:00:00Z", note: "" }]);
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema pitgarage_private;
      create function auth.uid() returns uuid language sql as $$ select '${actor}'::uuid $$;
      create function pitgarage_private.current_access_level() returns text language sql as $$ select current_setting('test.access',true) $$;
      create function pitgarage_private.is_team_member() returns boolean language sql as $$ select coalesce(pitgarage_private.current_access_level() in ('owner','admin','staff'),false) $$;
      create table public.financial_permissions(user_id uuid);
      create table public.customers(id uuid primary key,name text);
      create table public.vehicles(id uuid primary key,kind text,brand text,model text,plate text);
      create table public.service_orders(id uuid primary key,order_number bigint generated always as identity,
        customer_id uuid,vehicle_id uuid,status text default 'Em manutenção',opened_at date default current_date,
        completed_at date,budget jsonb not null default '[]',payment jsonb,activities jsonb default '[]',
        updated_at timestamptz default clock_timestamp(),deleted_at timestamptz,cancelled_at timestamptz);
      create table public.order_part_financials(order_id uuid,item_id text,unit_cost numeric,markup numeric);
      insert into customers values('${actor}','Cliente');
      insert into vehicles values('${actor}','Carro','Honda','Civic','ABC1D23');
      grant usage on schema public,auth,pitgarage_private to authenticated;
      grant select,insert,update on service_orders to authenticated;
      grant usage on sequence service_orders_order_number_seq to authenticated;
      set test.access='owner';
    `);
    const permissions = await read("20260911010000_financial_parts_permissions.sql");
    await db.exec(permissions.match(/create function public.can_view_financial\(\)[\s\S]*?\$\$;/)[0]);
    await db.exec(await read("20260914210007_operational_receipts.sql"));
    await db.exec(await read("20260916171847_allow_cash_order_receipts.sql"));
    await db.exec(await read("20260911040000_financial_order_report_item_names.sql"));
    // Before the new migration exists, the assertions below exercise the old database.
    try { await db.exec(await read("20260917010000_order_commercial_discount.sql")); }
    catch (e) { if (e.code !== "ENOENT") throw e; }

    await t.test("1560 minus 60 persists, retries once, audits old/new/reason/actor and leaves budget/cost/markup untouched", async () => {
      const order = await create(), request = crypto.randomUUID();
      const saved = await discount(order, 60, "Desconto PIX", request);
      assert.equal(saved.discount_amount, 60);
      assert.deepEqual(saved.budget, order.budget);
      const cost = (await db.query("select unit_cost::float,markup::float from order_part_financials where order_id=$1", [order.id])).rows[0];
      assert.deepEqual(cost, { unit_cost: 900, markup: 30 });
      assert.equal((await load(order.id)).discount_reason, "Desconto PIX");
      const activity = saved.activities.at(-1);
      assert.equal(activity.previousAmount, 0);
      assert.equal(activity.newAmount, 60);
      assert.equal(activity.recordedBy, actor);
      assert.equal(activity.reason, "Desconto PIX");
      assert.ok(Date.parse(activity.at));
      assert.equal((await discount(order, 60, "Desconto PIX", request)).activities.length, 1);
      await assert.rejects(discount(order, 50, "Desconto PIX", request), /utilizado/);
      await assert.rejects(discount(order, 50), /version conflict/);
      const edited = await discount(saved, 50, "À vista");
      assert.equal(edited.activities.at(-1).previousAmount, 60);
      const removed = await discount(edited, 0, "Removido");
      assert.equal(removed.activities.at(-1).newAmount, 0);
      assert.equal(removed.activities.length, 3);
    });
    await t.test("partial and multiple payments settle net total and finance deducts discount", async () => {
      const saved = await discount(await create());
      const partial = await receipt(saved, 500);
      assert.equal(partial.payment.status, "Parcial");
      const debt = (await call("order_receivables")).find(r => r.id === saved.id);
      assert.equal(debt.total, 1500);
      assert.equal(debt.balance, 1000);
      const paid = await receipt(partial, 1000);
      assert.equal(paid.payment.status, "Pago");
      assert.equal(paid.payment.receipts.length, 2);
      await assert.rejects(receipt(paid, 0.01), /exceeds/);
      await db.query("update service_orders set status='Serviço concluído',completed_at='2026-09-16' where id=$1", [saved.id]);
      const row = (await call("financial_order_report")).find(r => r.orderId === saved.id);
      assert.equal(row.discountAmount, 60);
      assert.equal(row.items.reduce((n, i) => n + i.revenue, 0) - row.discountAmount, 1500);
      const single = await receipt(await discount(await create()), 1500);
      assert.equal(single.payment.status, "Pago");
    });
    await t.test("negative, excess, fractional, received-money limits and stale concurrent operations are rejected", async () => {
      const order = await create();
      for (const amount of [-1, 1561, 0.001, "NaN", "Infinity", null])
        await assert.rejects(discount(order, amount));
      const partial = await receipt(order, 1000);
      await assert.rejects(discount(partial, 561), /crédito\/estorno/);
      assert.equal((await discount(partial, 560)).discount_amount, 560);
      await assert.rejects(receipt(partial, 1), /version conflict/);
      const zero = await discount(await create(), 1560);
      await assert.rejects(receipt(zero, 1), /exceeds/);
    });
    await t.test("owner/admin and financial staff only; direct writes cannot forge discounts or erase discount history", async () => {
      const order = await create();
      for (const access of ["customer", "staff"]) {
        await db.exec(`set test.access='${access}';set role authenticated`);
        await assert.rejects(discount(order), /permissão/);
        await assert.rejects(db.query("update service_orders set discount_amount=60 where id=$1", [order.id]), /operação de desconto/);
        await db.exec("reset role");
      }
      await db.exec("set test.access='admin';set role authenticated");
      const saved = await discount(order);
      await assert.rejects(db.query("update service_orders set activities='[]' where id=$1", [order.id]), /histórico/);
      await assert.rejects(db.query("update service_orders set discount_reason='forjado' where id=$1", [order.id]), /operação de desconto/);
      await db.exec(`reset role;insert into financial_permissions values('${actor}');set test.access='staff';set role authenticated`);
      assert.equal((await discount(saved, 50)).discount_amount, 50);
      await db.exec("reset role;set test.access='owner'");
    });
    await t.test("concluded, delivered, cancelled and deleted orders reject changes; budget reversal cannot create negative total", async () => {
      for (const status of ["Serviço concluído", "Aguardando retirada", "Entregue"]) {
        const order = await create();
        await db.query("update service_orders set status=$2 where id=$1", [order.id,status]);
        await assert.rejects(discount(order), /somente leitura/);
      }
      for (const field of ["completed_at", "cancelled_at", "deleted_at"]) {
        const order = await create();
        await db.query(`update service_orders set ${field}=current_date where id=$1`, [order.id]);
        await assert.rejects(discount(order), /somente leitura/);
      }
      const order = await discount(await create());
      await assert.rejects(db.query("update service_orders set budget='[]' where id=$1", [order.id]), /subtotal/);
      assert.equal((await load(order.id)).budget.length, 2);
    });
    await t.test("legacy payments and existing excess credit are retained without refund", async () => {
      const order = await create();
      await db.query("update service_orders set payment=$2 where id=$1", [order.id, { amount: 500, status: "Pago", method: "PIX", date: "2026-09-15" }]);
      const saved = await discount(await load(order.id));
      const paid = await receipt(saved, 1000);
      assert.equal(paid.payment.legacy.amount, 500);
      assert.equal(paid.payment.receipts[0].id, "legacy");
      await db.query("update service_orders set budget=$2 where id=$1", [order.id, [{ price: 1000, approval: "Aprovado" }]]);
      const credit = await load(order.id);
      assert.equal(credit.payment.amount, 1500);
      await assert.rejects(receipt(credit, 1), /exceeds/);
      await assert.rejects(discount(credit, 100), /crédito\/estorno/);
    });
  } finally { await db.close(); }
});

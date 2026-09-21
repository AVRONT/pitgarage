import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const runtime = process.env.PITGARAGE_PGLITE_PATH;
const read = (name) => readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
test("directory persistence and cancellation protection in isolated PostgreSQL", { skip: !runtime }, async (t) => {
  const { PGlite } = await import(pathToFileURL(runtime + "/dist/index.js").href);
  const db = new PGlite();
  const actor = "00000000-0000-4000-8000-000000000001";
  const customer = { id: crypto.randomUUID(), name: "Ana", phone: "11999999999", email: "", since: "2026" };
  const vehicle = { id: crypto.randomUUID(), customerId: customer.id, kind: "Carro", brand: "Fiat", model: "Uno", year: 2020, plate: "ABC1D23", mileage: 100, color: "Branco" };
  const rpc = async (name, args) => (await db.query(`select to_jsonb(public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")})) result`, args)).rows[0].result;
  try {
    await db.exec(`
      create role authenticated; create role anon; create role service_role;
      create schema auth; create schema pitgarage_private;
      create type public.access_level as enum ('customer','staff','admin','owner');
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create table public.user_profiles(user_id uuid primary key,full_name text,access_level public.access_level,is_active boolean,operational_role text);
      create policy user_profiles_select_own_or_manager on public.user_profiles for select using(true);
      create function auth.uid() returns uuid language sql as $$ select current_setting('test.actor')::uuid $$;
      create function pitgarage_private.current_access_level() returns public.access_level language sql as $$ select current_setting('test.access')::public.access_level $$;
      grant usage on schema auth,pitgarage_private to authenticated;
      insert into auth.users values('${actor}','actor@example.com',now());
      insert into user_profiles values('${actor}','Owner','owner',true,'Oficina');
      set test.actor='${actor}'; set test.access='owner';
    `);
    await db.exec(await read("20260902230000_create_operational_base.sql"));
    await db.exec(`create table order_part_financials(order_id uuid,item_id text,unit_cost numeric);
      create table calendar_events(service_order_id uuid,updated_at timestamptz);`);
    await db.exec(await read("20260907174418_e5dbbd95-3107-4e7a-85a4-f608c9c27de8.sql"));
    await db.exec(await read("20260914143913_c0572b93-5588-4983-a9f1-526606d937e2.sql"));
    await db.exec(await read("20260918010000_allow_cancel_with_financial_records.sql"));
    const patch = await read("20260921010000_persist_directory_and_guard_cancellation.sql").catch(e => { if (e.code === "ENOENT") return ""; throw e; });
    if (patch) await db.exec(patch);

    await t.test("standalone records persist, retries do not duplicate, and existing/new OS creation still works", async () => {
      const exists = (await db.query("select to_regprocedure('public.create_customer(jsonb)') is not null present")).rows[0].present;
      assert.equal(exists, true, "standalone persistence RPC required");
      await db.exec("set role authenticated; set test.access='staff'");
      const c = await rpc("create_customer", [customer]);
      const v = await rpc("create_vehicle", [vehicle]);
      assert.equal(c.id, customer.id); assert.equal(v.customer_id, c.id);
      assert.deepEqual(await rpc("create_customer", [customer]), c);
      assert.deepEqual(await rpc("create_vehicle", [vehicle]), v);
      await assert.rejects(rpc("create_customer", [{ ...customer, id: crypto.randomUUID() }]), /unique|duplicate/);
      await assert.rejects(rpc("create_vehicle", [{ ...vehicle, id: crypto.randomUUID() }]), /unique|duplicate/);
      await assert.rejects(rpc("create_vehicle", [{ ...vehicle, id: crypto.randomUUID(), customerId: crypto.randomUUID(), plate: "DEF4G56" }]), /cliente/i);
      await db.exec("reset role; set role authenticated");
      assert.equal((await db.query("select count(*)::int n from customers")).rows[0].n, 1);
      assert.equal((await db.query("select count(*)::int n from vehicles")).rows[0].n, 1);
      const order = await rpc("create_service_order_atomic", [c.id, null, v.id, null, { entryMileage: 100, complaint: "Revisão" }]);
      assert.equal(order.customer_id, c.id); assert.equal(order.vehicle_id, v.id);
      const bundled = await rpc("create_service_order_atomic", [null, { ...customer, phone: "11888888888" }, null, { ...vehicle, plate: "DEF4G56" }, { entryMileage: 100, complaint: "Revisão" }]);
      assert.notEqual(bundled.customer_id, c.id);
      await db.exec("set test.access='customer'");
      await assert.rejects(rpc("create_customer", [{ ...customer, id: crypto.randomUUID() }]), /permission|equipe/i);
      await assert.rejects(rpc("create_vehicle", [{ ...vehicle, id: crypto.randomUUID() }]), /permission|equipe/i);
      await db.exec("reset role");
    });

    await t.test("direct cancellation fields are protected, staff can edit, owner/admin RPC preserves history and payments", async () => {
      await db.exec("reset role; set test.access='owner'");
      // Independent fixture also exercises the old direct-UPDATE bypass before the fix.
      const c = (await db.query("insert into customers(name,phone,email) values('Teste','11777777777','') returning id")).rows[0].id;
      const v = (await db.query("insert into vehicles(customer_id,kind,brand,model,year,plate,mileage,color) values($1,'Carro','Fiat','Uno',2020,'GHI7J89',0,'Branco') returning id", [c])).rows[0].id;
      for (const role of ["owner", "admin"]) {
        const order = await rpc("create_service_order_atomic", [c, null, v, null, { entryMileage: 0, complaint: "Teste" }]);
        await db.query("update service_orders set payment=$2,status_history=$3 where id=$1", [order.id, { amount: 20, status: "Pago" }, [{ from: "Recebido" }]]);
        await db.exec("set role authenticated; set test.access='staff'");
        await db.query("update service_orders set notes='Atualização legítima' where id=$1", [order.id]);
        for (const access of ["staff", "owner", "admin"]) {
          await db.exec(`set test.access='${access}'`);
          for (const change of ["cancelled_at=now()", "cancelled_by=auth.uid()", "cancel_reason='Direto'"])
            await assert.rejects(db.query(`update service_orders set ${change} where id=$1`, [order.id]), /cancelamento|cancel/i);
        }
        await db.exec("set test.access='staff'");
        await assert.rejects(rpc("cancel_service_order", [order.id, order.updated_at, "Motivo"]), /proprietário|administrador/);
        await db.exec(`set test.access='${role}'`);
        await assert.rejects(rpc("cancel_service_order", [order.id, order.updated_at, " "]), /motivo/);
        const cancelled = await rpc("cancel_service_order", [order.id, order.updated_at, "Cliente desistiu"]);
        assert.equal(cancelled.cancel_reason, "Cliente desistiu"); assert.equal(cancelled.cancelled_by, actor);
        assert.deepEqual(cancelled.payment, { amount: 20, status: "Pago" });
        assert.deepEqual(cancelled.status_history, [{ from: "Recebido" }]);
        assert.equal(cancelled.status, "Recebido");
        assert.match(cancelled.activities.at(-1).description, /Cliente desistiu/);
        await assert.rejects(rpc("cancel_service_order", [order.id, cancelled.updated_at, "Repetido"]), /cancelada/);
        await assert.rejects(db.query("update service_orders set notes='Alteração' where id=$1", [order.id]), /somente leitura/);
        await db.exec("reset role");
      }
    });
  } finally { await db.close(); }
});

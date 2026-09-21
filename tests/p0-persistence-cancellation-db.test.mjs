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
    const administration = await read("20260914011729_90c83674-f1a6-4603-9cdd-58dc852376a7.sql");
    await db.exec(administration.match(/create or replace function pitgarage_private.can_administer\(\)[\s\S]*?\$\$;/)[0]);
    // Real operational schema/RLS and financial functions, not substitutes for Cloud infrastructure.
    for (const name of [
      "20260903190000_create_calendar.sql",
      "20260907174418_e5dbbd95-3107-4e7a-85a4-f608c9c27de8.sql",
      "20260911010000_financial_parts_permissions.sql",
      "20260912010000_add_budget_item_atomic.sql",
      "20260914112752_2a14be2d-aafc-4eb8-a04a-bbb4e77be3f1.sql",
      "20260914143913_c0572b93-5588-4983-a9f1-526606d937e2.sql",
      "20260914193624_a8475d74-e63d-4d46-a040-aaecab050996.sql",
      "20260914210007_operational_receipts.sql",
      "20260917010000_order_commercial_discount.sql",
      "20260917020000_discount_actor_name.sql",
      "20260917030000_quick_service_orders.sql",
      "20260917040000_financial_real_result.sql",
      "20260917050000_quick_service_order_parts.sql",
      "20260918010000_allow_cancel_with_financial_records.sql",
      "20260921010000_persist_directory_and_guard_cancellation.sql",
    ]) await db.exec(await read(name));

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

    await t.test("invalid directory input, changed retries and cancelled inserts fail without partial writes", async () => {
      await db.exec("reset role; set test.access='owner'; set role authenticated");
      const counts = async () => (await db.query("select (select count(*)::int from customers) customers, (select count(*)::int from vehicles) vehicles")).rows[0];
      const before = await counts();
      for (const changes of [{ id: "c-temp" }, { id: null }, { name: " " }, { phone: "123" }, { cpf: "00000000000" }, { email: "invalid" }]) {
        await assert.rejects(rpc("create_customer", [{ ...customer, id: crypto.randomUUID(), phone: "11666666666", ...changes }]));
      }
      for (const changes of [{ id: "v-temp" }, { id: null }, { customerId: crypto.randomUUID() }, { brand: " " }, { year: 1800 }, { mileage: -1 }, { plate: "X" }]) {
        await assert.rejects(rpc("create_vehicle", [{ ...vehicle, id: crypto.randomUUID(), plate: "JKL1M23", ...changes }]));
      }
      await assert.rejects(rpc("create_customer", [{ ...customer, name: "Alterado" }]), /Identificador/);
      await assert.rejects(rpc("create_vehicle", [{ ...vehicle, model: "Alterado" }]), /Identificador/);
      assert.deepEqual(await counts(), before);
      const saved = await rpc("create_customer", [{ ...customer, id: crypto.randomUUID(), phone: "11555555555", auth_user_id: actor, deleted_at: "2026-09-01", access_level: "owner" }]);
      assert.equal(saved.auth_user_id, null); assert.equal(saved.deleted_at, null);
      await db.query("update customers set deleted_at=now() where id=$1", [saved.id]);
      await assert.rejects(rpc("create_vehicle", [{ ...vehicle, id: crypto.randomUUID(), customerId: saved.id, plate: "JKL1M23" }]), /cliente ativo/);
      await assert.rejects(rpc("cancel_service_order", [crypto.randomUUID(), null, "Motivo"]), /não encontrada/);
      // Exercise the INSERT trigger even if a future table grant exposes INSERT.
      await db.exec("reset role; begin; grant insert on service_orders to authenticated; grant usage on sequence service_order_number_seq to authenticated; set role authenticated");
      await assert.rejects(db.query("insert into service_orders(customer_id,vehicle_id,status,entry_mileage,complaint,cancel_reason) values($1,$2,'Recebido',0,'Teste','Direto')", [customer.id, vehicle.id]), /cancelamento/);
      await db.exec("rollback; reset role");
    });

    await t.test("real profile authorization rejects inactive, missing, customer and anonymous actors", async () => {
      const authMigration = await read("20260902190000_prepare_auth_user_profiles.sql");
      const helper = authMigration.match(/create function pitgarage_private.current_access_level\(\)[\s\S]*?\$\$;/)[0];
      await db.exec(helper.replace("create function", "create or replace function"));
      for (const [access, active, allowed] of [["owner", true, true], ["admin", true, true], ["staff", true, true], ["customer", true, false], ["owner", false, false], ["admin", false, false], ["staff", false, false]]) {
        await db.exec("reset role");
        await db.query("update user_profiles set access_level=$1,is_active=$2 where user_id=$3", [access, active, actor]);
        await db.exec("set role authenticated");
        if (allowed) {
          assert.equal((await rpc("create_customer", [customer])).id, customer.id);
          assert.equal((await rpc("create_vehicle", [vehicle])).id, vehicle.id);
        } else {
          await assert.rejects(rpc("create_customer", [customer]), /equipe/);
          await assert.rejects(rpc("create_vehicle", [vehicle]), /equipe/);
          await assert.rejects(rpc("cancel_service_order", [crypto.randomUUID(), null, "Motivo"]), /proprietário/);
        }
      }
      await db.exec("reset role; update user_profiles set is_active=true,access_level='owner'; set role authenticated");
      await db.query("select set_config('test.actor',$1,false)", [crypto.randomUUID()]);
      await assert.rejects(rpc("create_customer", [customer]), /equipe/);
      await assert.rejects(rpc("create_vehicle", [vehicle]), /equipe/);
      await db.query("select set_config('test.actor',$1,false)", [actor]);
      await db.exec("reset role; set role anon");
      await assert.rejects(rpc("create_customer", [customer]), /permission denied/);
      await assert.rejects(rpc("create_vehicle", [vehicle]), /permission denied/);
      await db.exec("reset role");
    });

    await t.test("local SQL smoke: settings, directory, standard OS, items, execution, payment, delivery, reload and cancellation", async () => {
      await db.exec("set role authenticated");
      await db.query("update workshop_settings set name=$1 where id=true", ["Oficina local de teste"]);
      assert.equal((await db.query("select name from workshop_settings")).rows[0].name, "Oficina local de teste");
      const c = await rpc("create_customer", [{ ...customer, id: crypto.randomUUID(), phone: "11444444444" }]);
      const v = await rpc("create_vehicle", [{ ...vehicle, id: crypto.randomUUID(), customerId: c.id, plate: "MNO4P56" }]);
      let order = await rpc("create_service_order_atomic", [c.id, null, v.id, null, { entryMileage: 1234, complaint: "Revisão" }]);
      for (const [id, name, type, cost, quantity, price] of [["service", "Revisão", "Serviço", null, 1, 100], ["part", "Filtro", "Peça", 20, 2, 40]]) {
        order = await rpc("add_budget_item", [order.id, order.updated_at, id, name, type, cost, null, quantity, price]);
      }
      const budget = order.budget.map(item => ({ ...item, approval: "Aprovado", executed: true }));
      await db.query("update service_orders set diagnosis='Revisão confirmada',budget=$2,status='Serviço concluído',completed_at=current_date where id=$1", [order.id, budget]);
      order = (await db.query("select * from service_orders where id=$1", [order.id])).rows[0];
      order = await rpc("record_order_payment", [order.id, order.updated_at, { id: crypto.randomUUID(), amount: 80, method: "PIX", date: "2026-09-21T12:00:00Z", note: "" }]);
      assert.equal((await rpc("order_receivables", [])).find(row => row.id === order.id).balance, 100);
      order = await rpc("record_order_payment", [order.id, order.updated_at, { id: crypto.randomUUID(), amount: 100, method: "Cartão", feeAmount: 5, date: "2026-09-21T12:00:00Z", note: "" }]);
      assert.equal(order.payment.amount, 180);
      await db.query("update service_orders set status='Entregue' where id=$1", [order.id]);
      await db.exec("reset role; set role authenticated");
      order = (await db.query("select * from service_orders where id=$1", [order.id])).rows[0];
      assert.equal(order.status, "Entregue"); assert.equal(order.budget.length, 2);
      assert.equal(order.budget.every(item => item.executed), true);
      assert.equal((await rpc("order_receivables", [])).find(row => row.id === order.id).balance, 0);
      assert.equal((await rpc("financial_order_report", [])).some(row => row.orderId === order.id), true);
      const cancelled = await rpc("cancel_service_order", [order.id, order.updated_at, "Cancelamento de teste"]);
      assert.deepEqual(cancelled.payment, order.payment);
      assert.deepEqual(cancelled.budget, order.budget);
      assert.equal((await rpc("order_receivables", [])).some(row => row.id === order.id), false);
      assert.equal((await rpc("financial_order_report", [])).some(row => row.orderId === order.id), false);
      assert.equal((await db.query("select count(*)::int n from service_orders where vehicle_id=$1", [v.id])).rows[0].n, 1);
      assert.equal((await db.query("select count(*)::int n from service_orders where vehicle_id=$1 and cancelled_at is null and status<>'Entregue'", [v.id])).rows[0].n, 0);
      await assert.rejects(db.query("update service_orders set cancelled_at=null,cancelled_by=null,cancel_reason=null where id=$1", [order.id]), /somente leitura|cancelamento/);
      await db.exec("reset role");
    });
    await t.test("P0 function metadata is restricted and replay fails without replacing installed objects", async () => {
      const metadata = async () => (await db.query(`select p.oid::regprocedure::text signature,p.prosecdef,p.proconfig,
        has_function_privilege('anon',p.oid,'EXECUTE') anon,
        has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
        from pg_proc p where p.oid in ('public.create_customer(jsonb)'::regprocedure,
          'public.create_vehicle(jsonb)'::regprocedure,'pitgarage_private.protect_order_cancellation()'::regprocedure)
        order by signature`)).rows;
      const before = await metadata();
      assert.equal(before.length, 3);
      for (const row of before) {
        const rpc = !row.signature.includes('protect_order_cancellation');
        assert.equal(row.prosecdef, rpc);
        assert.equal(row.authenticated, rpc);
        assert.equal(row.anon, false);
        assert.ok(row.proconfig.includes('search_path=""'));
      }
      await assert.rejects(db.exec(await read("20260921010000_persist_directory_and_guard_cancellation.sql")), /already exists/);
      await db.exec("rollback");
      assert.deepEqual(await metadata(), before);
    });
  } finally { await db.close(); }
});

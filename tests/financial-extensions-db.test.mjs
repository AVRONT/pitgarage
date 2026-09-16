import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const runtime = process.env.PITGARAGE_PGLITE_PATH;
const migration = (name) =>
  readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
test(
  "local PostgreSQL: payments, extra revenues and quote vehicles",
  { skip: !runtime },
  async (t) => {
    const { PGlite } = await import(pathToFileURL(runtime + "/dist/index.js").href);
    const db = new PGlite();
    const c1 = "00000000-0000-4000-8000-000000000001",
      c2 = "00000000-0000-4000-8000-000000000002";
    const actor = "00000000-0000-4000-8000-000000000003",
      vehicle = "00000000-0000-4000-8000-000000000004";
    const order = "00000000-0000-4000-8000-000000000005";
    const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.result;
    const call = (name, values) =>
      one(
        "select public." + name + "(" + values.map((_, i) => "$" + (i + 1)).join(",") + ") result",
        values,
      );
    try {
      await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema pitgarage_private;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select '${actor}'::uuid $$;
      create function pitgarage_private.current_access_level() returns text language sql as $$ select current_setting('test.access',true) $$;
      create function pitgarage_private.is_team_member() returns boolean language sql as $$ select coalesce(pitgarage_private.current_access_level() in ('owner','admin','staff'),false) $$;
      create function public.can_view_financial() returns boolean language sql as $$ select coalesce(pitgarage_private.current_access_level()='owner' or (pitgarage_private.current_access_level() in ('admin','staff') and current_setting('test.finance',true)='true'),false) $$;
      create function pitgarage_private.require_quote_access() returns void language plpgsql as $$ begin if not pitgarage_private.is_team_member() then raise exception 'access denied'; end if; end $$;
      grant usage on schema auth,pitgarage_private to authenticated;
      create table public.customers(id uuid primary key);
      create table public.vehicles(id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id), kind text not null check(kind in ('Carro','Moto')), brand text not null, model text not null, year integer not null check(year between 1900 and 2100), plate text unique not null check(plate ~ '^[A-Z0-9]{7}$'), mileage integer not null check(mileage between 0 and 2000000), color text not null, deleted_at timestamptz, unique(id,customer_id));
      create table public.service_orders(id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity, customer_id uuid references public.customers(id), vehicle_id uuid references public.vehicles(id), status text default 'Recebido', opened_at date default current_date, completed_at date, entry_mileage integer not null check(entry_mileage between 0 and 2000000), complaint text default '', budget jsonb not null default '[]', payment jsonb, activities jsonb default '[]', warranty_days integer default 90, updated_at timestamptz default clock_timestamp(), deleted_at timestamptz, cancelled_at timestamptz, foreign key(vehicle_id,customer_id) references public.vehicles(id,customer_id));
      create table public.quotes(id uuid primary key default gen_random_uuid(), quote_number bigint generated always as identity, customer_id uuid references public.customers(id), vehicle_id uuid references public.vehicles(id), contact_name text, contact_phone text, contact_email text, description text, notes text, created_by uuid, status text default 'Rascunho', items jsonb default '[]', warranty_days integer default 90, service_order_id uuid, converted_at timestamptz, updated_at timestamptz default clock_timestamp());
      create table public.order_part_financials(order_id uuid,item_id text,unit_cost numeric,markup numeric);
      create table public.quote_item_financials(quote_id uuid,item_id text,unit_cost numeric,markup numeric);
      insert into auth.users values('${actor}');
      insert into public.customers values('${c1}'),('${c2}');
      insert into public.vehicles values('${vehicle}','${c1}','Carro','Honda','Civic',2020,'ABC1D23',0,'',null);
      insert into public.service_orders(id,customer_id,vehicle_id,entry_mileage,budget) values('${order}','${c1}','${vehicle}',0,'[{"id":"s","type":"Serviço","price":1000,"approval":"Aprovado"}]');
      set test.access='owner'; set test.finance='true';
    `);
      const original = await migration("20260914201829_e68fbfe9-b4e4-4934-8ba2-72f3c3538abb.sql");
      for (const name of ["create_quote", "convert_quote_to_order"]) {
        const definition = original.match(
          new RegExp("create or replace function public\\." + name + "\\([\\s\\S]*?end \\$\\$;"),
        )?.[0];
        assert.ok(definition, name);
        await db.exec(definition);
      }
      for (const name of [
        "20260914210007_operational_receipts.sql",
        "20260914210009_extra_revenues.sql",
        "20260914210010_quote_vehicle_snapshot.sql",
        "20260916171847_allow_cash_order_receipts.sql",
      ])
        await db.exec(await migration(name));
      let version = (
        await db.query("select updated_at::text from public.service_orders where id=$1", [order])
      ).rows[0].updated_at;
      const first = {
        id: crypto.randomUUID(),
        amount: 400,
        date: "2026-09-14T12:00:00Z",
        method: "PIX",
        note: "",
      };
      await t.test(
        "1000 unpaid, 400 partial, retry idempotent, remaining paid and stale version rejected",
        async () => {
          assert.equal((await call("order_receivables", []))[0].balance, 1000);
          const saved = await call("record_order_payment", [order, version, first]);
          assert.equal(saved.payment.amount, 400);
          assert.equal(saved.payment.status, "Parcial");
          assert.equal((await call("order_receivables", []))[0].balance, 600);
          const repeated = await call("record_order_payment", [order, version, first]);
          assert.equal(repeated.payment.receipts.length, 1);
          await assert.rejects(
            call("record_order_payment", [order, version, { ...first, id: crypto.randomUUID() }]),
            /version conflict/,
          );
          version = saved.updated_at;
          const final = await call("record_order_payment", [
            order,
            version,
            { ...first, id: crypto.randomUUID(), amount: 600 },
          ]);
          assert.equal(final.payment.status, "Pago");
          assert.equal(final.payment.amount, 1000);
          await assert.rejects(
            call("record_order_payment", [
              order,
              final.updated_at,
              { ...first, id: crypto.randomUUID(), amount: 1 },
            ]),
            /exceeds/,
          );
        },
      );
      await t.test(
        "customer cannot register receipt; direct update cannot erase receipts",
        async () => {
          await db.exec("set test.access='customer'");
          await assert.rejects(
            call("record_order_payment", [order, version, first]),
            /access required/,
          );
          await db.exec(
            "set test.access='owner'; grant select,update on public.service_orders to authenticated; set role authenticated",
          );
          await assert.rejects(
            db.exec("update public.service_orders set payment=null"),
            /payment operation/,
          );
          await db.exec("reset role");
        },
      );
      await t.test(
        "legacy paid receipt is preserved, delivered debt remains receivable, repeat returns current state",
        async () => {
          const old = { amount: 100, method: "PIX", date: "2026-09-13", status: "Pago" };
          const id = crypto.randomUUID();
          await db.query(
            "insert into public.service_orders(id,customer_id,vehicle_id,entry_mileage,budget,status,payment) values($1,$2,$3,0,$4,'Entregue',$5)",
            [id, c1, vehicle, [{ price: 1000, approval: "Aprovado" }], old],
          );
          const version = (
            await db.query("select updated_at::text from public.service_orders where id=$1", [id])
          ).rows[0].updated_at;
          const saved = await call("record_order_payment", [
            id,
            version,
            { ...first, id: crypto.randomUUID(), amount: 300 },
          ]);
          assert.deepEqual(saved.payment.legacy, old);
          assert.equal(saved.payment.receipts.length, 2);
          assert.equal(saved.payment.receipts[0].amount, 100);
          assert.equal((await call("order_receivables", [])).find((r) => r.id === id).balance, 600);
        },
      );
      await t.test("PIX, card and cash persist through RPC; cash partial plus card settles the OS", async () => {
        for (const [method, amount] of [["PIX", 1000], ["Cartão", 1000], ["Dinheiro", 1000], ["Dinheiro", 400]]) {
          const id = crypto.randomUUID();
          await db.query("insert into public.service_orders(id,customer_id,vehicle_id,entry_mileage,budget) values($1,$2,$3,0,$4)",
            [id,c1,vehicle,[{ price: 1000, approval: "Aprovado" }]]);
          const version = (await db.query("select updated_at::text from public.service_orders where id=$1", [id])).rows[0].updated_at;
          const input = { ...first, id: crypto.randomUUID(), method, amount, note: "Recebimento teste local" };
          const saved = await call("record_order_payment", [id, version, input]);
          const loaded = (await db.query("select payment,activities from public.service_orders where id=$1", [id])).rows[0];
          assert.equal(loaded.payment.receipts[0].method, method);
          assert.equal(loaded.payment.receipts[0].recordedBy, actor);
          assert.equal(loaded.payment.receipts[0].note, "Recebimento teste local");
          assert.equal(Date.parse(loaded.payment.receipts[0].date), Date.parse(first.date));
          assert.ok(loaded.activities.at(-1).description.includes(method));
          const retry = await call("record_order_payment", [id, version, input]);
          assert.equal(retry.payment.receipts.length, 1);
          if (amount === 400) {
            assert.equal(saved.payment.status, "Parcial");
            assert.equal((await call("order_receivables", [])).find(r => r.id === id).balance, 600);
            const settled = await call("record_order_payment", [id, saved.updated_at, { ...input, id: crypto.randomUUID(), method: "Cartão", amount: 600 }]);
            assert.equal(settled.payment.status, "Pago");
            assert.equal(settled.payment.amount, 1000);
            assert.deepEqual(settled.payment.receipts.map(p => p.method), ["Dinheiro", "Cartão"]);
            assert.equal((await call("order_receivables", [])).find(r => r.id === id).balance, 0);
          } else assert.equal(saved.payment.status, "Pago");
          await assert.rejects(call("record_order_payment", [id, saved.updated_at, { ...input, id: crypto.randomUUID(), method: "Cheque" }]), /Invalid receipt/);
        }
      });
      const category = crypto.randomUUID(),
        sub = crypto.randomUUID();
      await t.test(
        "category, subcategory, 500 minus 320, zero default, duplicate protection",
        async () => {
          await call("save_revenue_category", [category, "Vendas", null, true]);
          await call("save_revenue_category", [sub, "Peças", category, true]);
          const entry = {
            id: crypto.randomUUID(),
            date: "2026-09-14",
            categoryId: category,
            subcategoryId: sub,
            description: "Avulsa",
            revenue: 500,
            cost: 320,
          };
          const saved = await call("add_extra_revenue", [entry]);
          assert.equal(Number(saved.revenue) - Number(saved.cost), 180);
          await call("add_extra_revenue", [entry]);
          const zero = await call("add_extra_revenue", [
            { ...entry, id: crypto.randomUUID(), cost: undefined },
          ]);
          assert.equal(Number(zero.cost), 0);
          assert.equal((await call("list_extra_revenues", [])).entries.length, 2);
          await call("save_revenue_category", [category, "Vendas arquivadas", null, false]);
          await assert.rejects(
            call("add_extra_revenue", [{ ...entry, id: crypto.randomUUID() }]),
            /Active category/,
          );
          assert.equal((await call("list_extra_revenues", [])).entries.length, 2);
        },
      );
      await t.test(
        "customer/unprivileged staff cannot read financial entries; staff cannot write",
        async () => {
          for (const access of ["customer", "staff"]) {
            await db.exec(
              "set test.access='" + access + "'; set test.finance='false'; set role authenticated",
            );
            assert.equal((await db.query("select * from public.extra_revenues")).rows.length, 0);
            assert.equal(
              (await db.query("select * from public.revenue_categories")).rows.length,
              0,
            );
            await assert.rejects(call("list_extra_revenues", []), /Financial access/);
            await assert.rejects(
              call("save_revenue_category", [crypto.randomUUID(), "No", null, true]),
              /access required/,
            );
            await db.exec("reset role");
          }
          await db.exec("set test.access='staff';set test.finance='true';set role authenticated");
          assert.equal((await call("list_extra_revenues", [])).entries.length, 2);
          await assert.rejects(
            call("save_revenue_category", [crypto.randomUUID(), "No", null, true]),
            /access required/,
          );
          await db.exec("reset role;set test.access='owner';set test.finance='true'");
        },
      );
      await t.test(
        "quote snapshots persist without vehicle creation; existing plate links once",
        async () => {
          const q = await call("create_quote_snapshot", [
            null,
            null,
            "Teste",
            "",
            "Contato",
            "11999999999",
            null,
            "Honda Civic",
            "ABC1D23",
          ]);
          assert.equal(q.vehicle_model_text, "Honda Civic");
          assert.equal(q.vehicle_id, null);
          assert.equal(
            Number((await db.query("select count(*) n from public.vehicles")).rows[0].n),
            1,
          );
          await db.query("update public.quotes set customer_id=$2 where id=$1", [q.id, c1]);
          const match = await call("match_quote_vehicle", [q.id]);
          assert.equal(match[0].id, vehicle);
          const created = await call("convert_quote_with_vehicle", [
            q.id,
            q.updated_at,
            vehicle,
            null,
            100,
          ]);
          assert.equal(created.vehicle_id, vehicle);
          const original = (await db.query("select * from public.quotes where id=$1", [q.id]))
            .rows[0];
          assert.equal(original.vehicle_plate_text, "ABC1D23");
          assert.equal(original.status, "Convertido");
          await assert.rejects(
            call("convert_quote_with_vehicle", [q.id, q.updated_at, vehicle, null, 100]),
            /conflict|converted/,
          );
        },
      );
      await t.test(
        "new vehicle only during conversion; duplicate and wrong owner are blocked; transaction rolls back",
        async () => {
          const q = await call("create_quote_snapshot", [
            c1,
            null,
            "Novo",
            "",
            null,
            null,
            null,
            "CB 500",
            "NEW1A23",
          ]);
          const created = await call("convert_quote_with_vehicle", [
            q.id,
            q.updated_at,
            null,
            {
              kind: "Moto",
              brand: "Honda",
              model: "CB 500",
              year: 2020,
              plate: "NEW1A23",
              color: "",
            },
            0,
          ]);
          assert.ok(created.vehicle_id);
          const q2 = await call("create_quote_snapshot", [
            c2,
            null,
            "Duplicado",
            "",
            null,
            null,
            null,
            "Civic",
            "ABC1D23",
          ]);
          await assert.rejects(
            call("convert_quote_with_vehicle", [q2.id, q2.updated_at, vehicle, null, 0]),
            /belong/,
          );
          await assert.rejects(
            call("convert_quote_with_vehicle", [
              q2.id,
              q2.updated_at,
              null,
              {
                kind: "Carro",
                brand: "Honda",
                model: "Civic",
                year: 2020,
                plate: "ABC1D23",
                color: "",
              },
              0,
            ]),
            /already registered/,
          );
          const q3 = await call("create_quote_snapshot", [
            c1,
            null,
            "Inválido",
            "",
            null,
            null,
            null,
            "X",
            "NEW9A99",
          ]);
          await assert.rejects(
            call("convert_quote_with_vehicle", [
              q3.id,
              q3.updated_at,
              null,
              { kind: "Carro", brand: "X", model: "X", year: 1800, plate: "NEW9A99", color: "" },
              0,
            ]),
          );
          assert.equal(
            Number(
              (await db.query("select count(*) n from public.vehicles where plate='NEW9A99'"))
                .rows[0].n,
            ),
            0,
          );
          await assert.rejects(
            call("convert_quote_to_order", [q3.id, q3.updated_at, vehicle, 0]),
            /plate must match/i,
          );
          assert.equal(
            (await db.query("select service_order_id from public.quotes where id=$1", [q3.id]))
              .rows[0].service_order_id,
            null,
          );
          await db.exec(
            "create function public.test_reject_order() returns trigger language plpgsql as $$ begin raise exception 'test order rejected'; end $$; create trigger test_reject_order before insert on public.service_orders for each row execute function public.test_reject_order()",
          );
          await assert.rejects(
            call("convert_quote_with_vehicle", [
              q3.id,
              q3.updated_at,
              null,
              { kind: "Carro", brand: "X", model: "X", year: 2020, plate: "NEW9A99", color: "" },
              0,
            ]),
            /test order rejected/,
          );
          assert.equal(
            Number(
              (await db.query("select count(*) n from public.vehicles where plate='NEW9A99'"))
                .rows[0].n,
            ),
            0,
          );
        },
      );
    } finally {
      await db.close();
    }
  },
);

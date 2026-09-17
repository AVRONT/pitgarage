import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const runtime = process.env.PITGARAGE_PGLITE_PATH;
test('manual OS14 cleanup in isolated PostgreSQL', { skip: !runtime }, async t => {
  const { PGlite } = await import(pathToFileURL(runtime + '/dist/index.js').href);
  const sql = await readFile(new URL('../supabase/manual/delete_test_os14.sql', import.meta.url), 'utf8');
  const id = '00000000-0000-4000-8000-000000000014';
  const other = '00000000-0000-4000-8000-000000000015';
  async function fixture() {
    const db = new PGlite();
    await db.exec(`
      create schema pitgarage_private; create schema storage;
      create sequence service_order_number_seq start 16;
      create table customers(id uuid primary key); create table vehicles(id uuid primary key);
      insert into customers values('${id}'); insert into vehicles values('${id}');
      create table service_orders(id uuid primary key, order_number bigint default nextval('service_order_number_seq'),
        customer_id uuid references customers(id), vehicle_id uuid references vehicles(id),
        evidence jsonb, payment jsonb, budget jsonb, activities jsonb, discount_amount numeric);
      insert into service_orders values('${id}',14,'${id}','${id}',
        '[{"path":"${id}/own.jpg"},{"path":"${id}/shared.jpg"},{"path":"external.jpg"}]',
        '{"receipts":[{"amount":100}]}','[{"id":"item"}]','[{"id":"history"}]',10),
        ('${other}',15,'${id}','${id}','[{"path":"${id}/shared.jpg"}]',null,'[]','[]',0);
      create table order_part_financials(order_id uuid references service_orders(id), cost numeric);
      insert into order_part_financials values('${id}',100),('${other}',200);
      create table pitgarage_private.legacy_financial_budgets(order_id uuid, budget jsonb);
      insert into pitgarage_private.legacy_financial_budgets values('${id}','[]'),('${other}','[]');
      create table calendar_events(id int, service_order_id uuid references service_orders(id) on delete set null, updated_at timestamptz);
      create table quotes(id int primary key, service_order_id uuid references service_orders(id), updated_at timestamptz);
      insert into calendar_events values(14,'${id}',now()),(15,'${other}',now());
      insert into quotes values(14,'${id}',now()),(15,'${other}',now());
      create table quote_item_financials(quote_id int references quotes(id) on delete cascade,cost numeric);
      insert into quote_item_financials values(14,100),(15,200);
      create table notifications(id int primary key, metadata jsonb);
      insert into notifications values(14,jsonb_build_object('service_order_id','${id}')),
        (15,jsonb_build_object('service_order_id','${other}'));
      create table storage.objects(bucket_id text,name text);
      insert into storage.objects values('os-evidence','${id}/orphan.jpg'),('other-bucket','${id}/keep.jpg');
      create function pitgarage_private.guard_order_delete() returns trigger language plpgsql as $$
        begin raise exception 'normal deletion blocked'; end $$;
      create trigger guard_order_delete before delete on service_orders for each row execute function pitgarage_private.guard_order_delete();
      create function pitgarage_private.check_quote_vehicle_snapshot() returns trigger language plpgsql as $$ begin return new; end $$;
      create trigger check_quote_vehicle_snapshot before update on quotes for each row execute function pitgarage_private.check_quote_vehicle_snapshot();
    `);
    return db;
  }
  await t.test('deletes only 14; preserves independent records, sequence, guard and physical Storage', async () => {
    const db = await fixture();
    try {
      const before = (await db.query(`select to_jsonb(s) row from service_orders s where id='${other}'`)).rows;
      const result = await db.exec(sql);
      const manifest = result.find(r => r.rows?.[0]?.bucket_id)?.rows;
      assert.equal(manifest.length, 4);
      assert.match(manifest.find(r => r.path.endsWith('/shared.jpg')).action, /PRESERVE/);
      assert.match(manifest.find(r => r.path === 'external.jpg').action, /PRESERVE/);
      assert.match(manifest.find(r => r.path.endsWith('/orphan.jpg')).action, /REMOVE VIA/);
      assert.deepEqual((await db.query(`select to_jsonb(s) row from service_orders s`)).rows, before);
      for (const table of ['customers','vehicles']) assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 1);
      for (const table of ['calendar_events','quotes']) {
        assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 2);
        assert.equal((await db.query(`select service_order_id from ${table} where id=14`)).rows[0].service_order_id, null);
      }
      for (const table of ['order_part_financials','pitgarage_private.legacy_financial_budgets','notifications'])
        assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 1);
      for (const table of ['quote_item_financials','storage.objects'])
        assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 2);
      assert.deepEqual((await db.query('select last_value::int, is_called from service_order_number_seq')).rows[0], {last_value:16,is_called:false});
      await assert.rejects(db.exec(`delete from service_orders where id='${other}'`), /normal deletion blocked/);
    } finally { await db.close(); }
  });
  const cases = [
    ['missing 14', 'update service_orders set order_number=13 where order_number=14', /exactly one/],
    ['duplicate 14', 'update service_orders set order_number=14 where order_number=15', /exactly one/],
    ['unknown cascade FK', 'create table surprise(order_id uuid references service_orders(id) on delete cascade)', /unreviewed FK/],
    ['unsafe sequence', "select setval('service_order_number_seq',14,false)", /numbering configuration/],
    ['unknown delete trigger', `create function reject_delete() returns trigger language plpgsql as $$ begin raise exception 'unexpected'; end $$;
      create trigger late_failure after delete on service_orders for each row execute function reject_delete()`, /unreviewed trigger/],
    ['commit failure rolls back deleted rows and restores guard', `drop trigger check_quote_vehicle_snapshot on quotes;
      create or replace function pitgarage_private.check_quote_vehicle_snapshot() returns trigger language plpgsql as $$ begin raise exception 'forced late failure'; end $$;
      create constraint trigger check_quote_vehicle_snapshot after update on quotes deferrable initially deferred
      for each row execute function pitgarage_private.check_quote_vehicle_snapshot()`, /forced late failure/],
  ];
  for (const [name, setup, expected] of cases) await t.test(name + ' aborts without deleting dependencies', async () => {
    const db = await fixture();
    try {
      await db.exec(setup);
      await assert.rejects(db.exec(sql), expected);
      await db.exec('rollback');
      assert.equal((await db.query('select count(*)::int n from service_orders')).rows[0].n,2);
      assert.equal((await db.query('select count(*)::int n from order_part_financials')).rows[0].n,2);
      assert.equal((await db.query("select tgenabled from pg_trigger where tgname='guard_order_delete'")).rows[0].tgenabled,'O');
    } finally { await db.close(); }
  });
});

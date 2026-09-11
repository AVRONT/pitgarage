import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";

async function load(name, mocks = {}) {
  const source = await readFile(new URL("../src/features/pilot/" + name, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  new Function("require", "exports", outputText)((id) => mocks[id], exports);
  return exports;
}
const model = await load("financial-model.ts");
const { suggestedPrice, partAmounts, validatePart, aggregateFinancial, dateRange } = model;
test("markup is based on cost; quantity and actual manual sale determine profit", () => {
  assert.equal(suggestedPrice(100, 30), 130);
  assert.equal(suggestedPrice(200, 30), 260);
  assert.deepEqual(partAmounts({ price: 250, quantity: 2 }, 100), {
    quantity: 2,
    revenue: 250,
    cost: 200,
    profit: 50,
    margin: 20,
  });
  assert.equal(partAmounts({ price: 260, quantity: 2 }, 100).profit, 60);
});
test("missing cost stays unknown; legacy quantity defaults to one; zero cost is valid", () => {
  assert.equal(suggestedPrice(null, 30), null);
  assert.equal(suggestedPrice(100, null), null);
  assert.equal(partAmounts({ price: 130 }, null).profit, null);
  assert.equal(partAmounts({ price: 130 }, 100).profit, 30);
  assert.equal(partAmounts({ price: 130 }, 0).profit, 130);
  assert.equal(partAmounts({ price: 0 }, 0).margin, null);
});
test("rejects invalid values and preserves negotiated prices or losses", () => {
  const valid = { itemId: "p", unitCost: 100, markup: 30, quantity: 2, unitPrice: 90 };
  assert.equal(validatePart(valid), null);
  assert.equal(partAmounts({ price: 180, quantity: 2 }, 100).profit, -20);
  for (const invalid of [
    { quantity: 0 },
    { quantity: 1.5 },
    { unitCost: -1 },
    { markup: NaN },
    { unitPrice: Infinity },
  ])
    assert.ok(validatePart({ ...valid, ...invalid }));
});
const rows = [
  {
    orderId: "car",
    kind: "Carro",
    completedAt: "2026-09-10",
    quantity: 2,
    revenue: 300,
    unitCost: 100,
  },
  {
    orderId: "car",
    kind: "Carro",
    completedAt: "2026-09-10",
    quantity: 1,
    revenue: 100,
    unitCost: null,
  },
  {
    orderId: "bike",
    kind: "Moto",
    completedAt: "2026-08-20",
    quantity: 1,
    revenue: 150,
    unitCost: 100,
  },
  { orderId: "undated", kind: "Moto", completedAt: null, quantity: 1, revenue: 999, unitCost: 100 },
];
test("aggregates only known costs for profit and margin, counts OS once", () => {
  const all = aggregateFinancial(rows);
  assert.equal(all.revenue, 550);
  assert.equal(all.cost, 300);
  assert.equal(all.profit, 150);
  assert.equal(all.knownRevenue, 450);
  assert.equal(all.orders, 2);
  assert.equal(all.incomplete, 1);
  assert.equal(all.undated, 1);
  assert.equal(all.timeline.length, 2);
  assert.equal(all.vehicles.length, 2);
});
test("car/motorcycle and custom date filters apply to all aggregates and charts", () => {
  const car = aggregateFinancial(rows, "Carro", "2026-09-01", "2026-09-30");
  assert.equal(car.profit, 100);
  assert.equal(car.orders, 1);
  assert.equal(car.vehicles[0].name, "Carro");
  const moto = aggregateFinancial(rows, "Moto", "2026-08-01", "2026-08-31");
  assert.equal(moto.profit, 50);
  assert.equal(moto.orders, 1);
  assert.equal(aggregateFinancial(rows, "Moto", "2026-09-01", "2026-09-30").orders, 0);
});
test("empty or missing-cost datasets yield empty charts, not invented profit", () => {
  for (const input of [[], [{ ...rows[0], unitCost: null }]]) {
    const summary = aggregateFinancial(input);
    assert.equal(summary.profit, null);
    assert.equal(summary.cost, null);
    assert.deepEqual(summary.timeline, []);
    assert.deepEqual(summary.vehicles, []);
  }
});
test("period boundaries handle previous year and leap months", () => {
  assert.deepEqual(dateRange("previous", new Date(2026, 0, 15)), {
    start: "2025-12-01",
    end: "2025-12-31",
  });
  assert.deepEqual(dateRange("month", new Date(2024, 1, 15)), {
    start: "2024-02-01",
    end: "2024-02-29",
  });
  assert.deepEqual(dateRange("today", new Date(2026, 8, 10)), {
    start: "2026-09-10",
    end: "2026-09-10",
  });
});
test("fractional unit costs round per part consistently with the OS", () => {
  const row = {
    orderId: "os",
    kind: "Carro",
    completedAt: "2026-09-10",
    quantity: 1,
    revenue: 1,
    unitCost: 0.335,
  };
  const result = aggregateFinancial([row, row]);
  assert.equal(result.cost, 0.68);
  assert.equal(result.profit, 1.32);
  assert.equal(result.vehicles[0].Custo, 0.68);
  assert.equal(partAmounts({ price: 1, quantity: 1 }, 0.335).cost, 0.34);
});
test("RPC access failures do not produce financial data", async () => {
  const api = await load("financial-api.ts", {
    "@/integrations/supabase/client": {
      supabase: { rpc: async () => ({ data: null, error: { code: "42501", message: "denied" } }) },
    },
  });
  await assert.rejects(api.financialApi.report(), /permissão financeira/);
  await assert.rejects(api.financialApi.part("os", "p"), /permissão financeira/);
});
test("legacy and cloud backups keep the same envelope and media references, no binary conversion", async () => {
  const workshop = { name: "Oficina" };
  const backup = await load("pilot-storage.ts", {
    "./workshop-data": { defaultWorkshop: workshop, workshopStorageKey: "test" },
  });
  const data = {
    customers: [{ id: "c", name: "Cliente", phone: "", email: "", since: "2026" }],
    vehicles: [
      {
        id: "v",
        customerId: "c",
        kind: "Carro",
        brand: "",
        model: "",
        plate: "",
        color: "",
        year: 2020,
        mileage: 0,
      },
    ],
    orders: [
      {
        id: "os",
        customerId: "c",
        vehicleId: "v",
        status: "Recebido",
        openedAt: "2026-09-10",
        entryMileage: 0,
        complaint: "",
        diagnosis: "",
        findings: "",
        notes: "",
        team: [],
        budget: [
          { id: "old", name: "Antiga", type: "Peça", price: 130, cost: 100, approval: "Aprovado" },
          {
            id: "p",
            name: "Nova",
            type: "Peça",
            price: 250,
            quantity: 2,
            unitPrice: 125,
            approval: "Aprovado",
          },
        ],
        evidence: [
          { id: "legacy", kind: "Foto", name: "Antiga", caption: "Sem arquivo" },
          {
            id: "e",
            kind: "Foto",
            name: "Foto",
            caption: "Foto",
            path: "11111111-1111-4111-8111-111111111111/e-22222222-2222-4222-8222-222222222222.jpg",
            mimeType: "image/jpeg",
            size: 123,
          },
        ],
      },
    ],
  };
  const legacy = backup.createBackup(data, workshop);
  assert.deepEqual(backup.parseBackup(JSON.stringify(legacy)).data, data);
  const cloud = {
    ...legacy,
    cloud: {
      version: 1,
      mediaIncluded: false,
      tables: { order_part_financials: [{ unit_cost: 100 }] },
    },
  };
  const serialized = JSON.stringify(cloud),
    parsed = backup.parseBackup(serialized);
  assert.deepEqual(parsed.cloud, cloud.cloud);
  assert.deepEqual(parsed.data, data);
  assert.ok(!serialized.includes("base64"));
  assert.throws(() => backup.persistImportedBackup(parsed), /administrador/);
  const malformed = structuredClone(legacy);
  malformed.data.orders[0].budget[1].quantity = 0;
  assert.throws(() => backup.parseBackup(JSON.stringify(malformed)));
});
test("SQL contract: sensitive tables have no operational write grant, RPCs check permissions", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20260911010000_financial_parts_permissions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /alter table public.order_part_financials enable row level security/);
  assert.match(sql, /using \(\(select public.can_view_financial\(\)\)\)/);
  assert.match(sql, /revoke all on public.financial_permissions from public, anon, authenticated/);
  for (const name of ["financial_report", "get_part_financial", "save_part_financial"]) {
    const body = sql.split("create function public." + name)[1].split("end $$;")[0];
    assert.match(body, /if not public.can_view_financial\(\)/);
  }
  for (const name of ["list_financial_members", "set_financial_permission"]) {
    assert.match(
      sql.split("create function public." + name)[1].split("end $$;")[0],
      /is distinct from 'owner'/,
    );
  }
  assert.match(sql, /target.updated_at is distinct from expected_version/);
  assert.match(sql, /and sale_changed/);
  assert.match(sql, /Costs must use the financial API/);
});
test("SQL backup contract: 72h, lock, private snapshot, no media objects/auth secrets", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260911020000_structured_backups.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /interval '72 hours'/);
  assert.match(sql, /pg_try_advisory_xact_lock/);
  assert.match(sql, /'format','pitgarage-local-backup','formatVersion',1/);
  assert.match(sql, /'mediaIncluded',false/);
  assert.match(sql, /'evidence',s.evidence/);
  assert.doesNotMatch(sql, /storage\.objects|auth\.users|base64|service_role/);
  assert.match(
    sql,
    /revoke all on function pitgarage_private.create_structured_backup\(\) from public,anon,authenticated/,
  );
});

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
async function uiHarness(api, owner = false) {
  let cursor = 0;
  const slots = [],
    effects = [];
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === "function" ? value(slots[i]) : value;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (slots[i] ??= { current: initial });
    },
    useEffect(fn, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || deps.some((v, n) => v !== previous[n])) {
        slots[i] = deps;
        effects.push(fn);
      }
    },
  };
  const ui = await load("financial-screen.tsx", {
    react,
    "react/jsx-runtime": jsxRuntime,
    recharts: Object.fromEntries(
      [
        "Bar",
        "BarChart",
        "CartesianGrid",
        "Legend",
        "Line",
        "LineChart",
        "ResponsiveContainer",
        "Tooltip",
        "XAxis",
        "YAxis",
      ].map((name) => [name, name]),
    ),
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/card": { Card: "section", CardContent: "div" },
    "@/components/ui/input": { Input: "input" },
    "@/features/auth/auth-context": {
      useAuth: () => ({ accessLevel: owner ? "owner" : "staff", isLocalBypass: false }),
    },
    "./financial-api": { financialApi: api },
    "./financial-model": model,
  });
  return {
    ui,
    render(component, props) {
      cursor = 0;
      const tree = component(props);
      for (const effect of effects.splice(0)) effect();
      return tree;
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

const orderRows = [
  {
    orderId: "service",
    orderNumber: "OS-1",
    vehicle: "Carro A",
    customer: "Cliente A",
    kind: "Carro",
    completedAt: "2026-09-10",
    items: [{ type: "Serviço", quantity: 1, revenue: 200, unitCost: null }],
  },
  {
    orderId: "mixed",
    orderNumber: "OS-2",
    vehicle: "Moto B",
    customer: "Cliente B",
    kind: "Moto",
    completedAt: "2026-09-10",
    items: [
      { type: "Peça", quantity: 2, revenue: 250, unitCost: 100 },
      { type: "Serviço", quantity: 1, revenue: 300, unitCost: null },
    ],
  },
  {
    orderId: "previous",
    orderNumber: "OS-3",
    vehicle: "Carro C",
    customer: "Cliente C",
    kind: "Carro",
    completedAt: "2026-08-20",
    items: [{ type: "Serviço", quantity: 1, revenue: 100, unitCost: null }],
  },
];
test("complete OS report includes service-only orders and mixed part/service totals", () => {
  const service = model.orderAmounts(orderRows[0]);
  assert.equal(service.revenue, 200);
  assert.equal(service.cost, 0);
  assert.equal(service.result, 200);
  assert.equal(service.partsRevenue, 0);
  const mixed = model.orderAmounts(orderRows[1]);
  assert.equal(mixed.revenue, 550);
  assert.equal(mixed.partsRevenue, 250);
  assert.equal(mixed.servicesRevenue, 300);
  assert.equal(mixed.cost, 200);
  assert.equal(mixed.result, 350);
  const all = model.aggregateOrders(orderRows);
  assert.equal(all.revenue, 850);
  assert.equal(all.partsRevenue, 250);
  assert.equal(all.servicesRevenue, 600);
  assert.equal(all.result, 650);
  assert.equal(all.ticket, 283.33);
  assert.equal(all.orders, 3);
  assert.equal(all.parts.profit, 50);
});
test("all/category/period filters drive OS rows, ticket and the three graphs together", () => {
  const month = model.aggregateOrders(orderRows, "Todos", "2026-09-01", "2026-09-30");
  assert.equal(month.orders, 2);
  assert.equal(month.ticket, 375);
  assert.deepEqual(month.timeline, [
    { name: "2026-09-10", Faturamento: 750, Custo: 200, Resultado: 550 },
  ]);
  assert.deepEqual(month.vehicles, [
    { name: "Carro", Faturamento: 200, Custo: 0, Resultado: 200 },
    { name: "Moto", Faturamento: 550, Custo: 200, Resultado: 350 },
  ]);
  assert.deepEqual(month.vehicleTimeline, [{ name: "2026-09-10", Carros: 200, Motos: 350 }]);
  const car = model.aggregateOrders(orderRows, "Carro", "2026-09-10", "2026-09-10");
  assert.equal(car.rows.length, 1);
  assert.equal(car.ticket, 200);
  assert.equal(car.vehicleTimeline[0].Motos, null);
  assert.equal(model.aggregateOrders(orderRows, "Moto").result, 350);
  assert.equal(model.aggregateOrders(orderRows, "Todos", "2026-08-01", "2026-08-31").revenue, 100);
});
test("unknown cost, sale and dates stay explicit; partial cost is flagged, not fabricated", () => {
  const unknown = {
    ...orderRows[1],
    items: [{ type: "Peça", quantity: 1, revenue: 250, unitCost: null }],
  };
  const summary = model.aggregateOrders([orderRows[0], unknown]);
  assert.equal(summary.cost, 0);
  assert.equal(summary.result, null);
  assert.equal(summary.incompleteCosts, 1);
  assert.equal(summary.vehicles.find((row) => row.name === "Moto").Resultado, null);
  const partial = model.orderAmounts({
    ...unknown,
    items: [...unknown.items, orderRows[1].items[0]],
  });
  assert.equal(partial.cost, 200);
  assert.equal(partial.result, 300);
  assert.equal(partial.missingCosts, 1);
  const unpriced = { ...unknown, items: [{ ...unknown.items[0], revenue: null }] };
  const filtered = model.aggregateOrders([
    orderRows[0],
    unpriced,
    { ...orderRows[2], completedAt: null },
  ]);
  assert.equal(filtered.orders, 2);
  assert.equal(filtered.revenue, 200);
  assert.equal(filtered.ticket, 200);
  assert.equal(filtered.unpriced, 1);
  assert.equal(filtered.undated, 1);
  assert.equal(model.orderAmounts({ ...unknown, items: [] }).revenue, null);
  assert.equal(model.aggregateOrders([]).revenue, null);
  assert.deepEqual(model.aggregateOrders([]).timeline, []);
});
test("canonical saved cost/markup prefill legacy and multiple quantities without replacing manual price", () => {
  assert.deepEqual(model.prefillPart({ price: 125, cost: 999 }, { unitCost: 100, markup: 30 }), {
    quantity: 1,
    unitPrice: 125,
    unitCost: 100,
    markup: 30,
    implicit: null,
  });
  const values = model.prefillPart({ price: 250, quantity: 2 }, { unitCost: 100, markup: null });
  assert.equal(values.unitPrice, 125);
  assert.equal(values.implicit, 25);
  assert.equal(model.implicitMarkup(100, 90), -10);
  assert.equal(model.implicitMarkup(0, 125), null);
  assert.equal(model.implicitMarkup(null, 125), null);
  assert.equal(
    model.prefillPart({ price: 250, cost: 100 }, { unitCost: null, markup: null }).unitCost,
    null,
  );
  assert.equal(
    model.prefillPart({ price: 250, quantity: 2, unitPrice: 125 }, { unitCost: 100, markup: 30 })
      .unitPrice,
    125,
  );
});
test("editor shows implied markup without saving it or replacing the negotiated price", async () => {
  let saved;
  const harness = await uiHarness({ part: async () => ({ unitCost: 100, markup: null }) });
  const props = {
    order: { databaseId: "os", status: "Recebido" },
    item: { id: "p", type: "Peça", price: 250, quantity: 2, approval: "Aguardando aprovação" },
    save: async (input) => {
      saved = input;
    },
  };
  const render = () => nodes(harness.render(harness.ui.PartFinancialEditor, props));
  render()
    .find((node) => node.type === "button")
    .props.onClick();
  render();
  await tick();
  const fields = render().filter((node) => node.type === "input");
  assert.equal(fields[0].props.value, "100");
  assert.equal(fields[1].props.value, "");
  assert.equal(fields[1].props.placeholder, "25% implícito");
  assert.equal(fields[2].props.value, "2");
  assert.equal(fields[3].props.value, "125");
  await render()
    .find((node) => node.props?.children === "Salvar dados da peça")
    .props.onClick();
  assert.equal(saved.markup, null);
  assert.equal(saved.unitPrice, 125);
  assert.equal(saved.quantity, 2);
});
test("general report RPC is read-only, guarded server-side and includes executed services", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260911030000_financial_order_report.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /if not public.can_view_financial\(\)/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /revoke all on function public.financial_order_report\(\) from public,anon/);
  assert.match(sql, /in \('Peça','Serviço'\)/);
  assert.match(sql, /b->>'approval'='Aprovado' and b->>'executed'='true'/);
  assert.match(sql, /s.completed_at/);
  assert.match(sql, /left join public.order_part_financials/);
  assert.doesNotMatch(sql, /\b(insert|update|delete|alter table)\b/i);
  let called;
  const api = await load("financial-api.ts", {
    "@/integrations/supabase/client": {
      supabase: {
        rpc: async (name) => {
          called = name;
          return { data: orderRows, error: null };
        },
      },
    },
  });
  assert.deepEqual(await api.financialApi.report(), orderRows);
  assert.equal(called, "financial_order_report");
});

test("editor preserves manual final price when cost/markup changes; applies suggestion only on click", async () => {
  let saved;
  const harness = await uiHarness({ part: async () => ({ unitCost: 100, markup: 30 }) });
  const props = {
    order: { databaseId: "os", status: "Recebido" },
    item: { id: "p", type: "Peça", price: 125, approval: "Aguardando aprovação" },
    save: async (input) => {
      saved = input;
    },
  };
  const render = () => nodes(harness.render(harness.ui.PartFinancialEditor, props));
  render()
    .find((node) => node.type === "button")
    .props.onClick();
  render();
  await tick();
  let fields = render().filter((node) => node.type === "input");
  fields[0].props.onChange({ target: { value: "200" } });
  fields[1].props.onChange({ target: { value: "30" } });
  fields = render().filter((node) => node.type === "input");
  assert.equal(fields[3].props.value, "125");
  await render()
    .find((node) => node.props?.children === "Salvar dados da peça")
    .props.onClick();
  assert.equal(saved.unitPrice, 125);
  assert.equal(saved.unitCost, 200);
  render()
    .find((node) => node.type === "button")
    .props.onClick();
  render();
  await tick();
  render()
    .find((node) => node.props?.children === "Usar preço sugerido")
    .props.onClick();
  assert.equal(render().filter((node) => node.type === "input")[3].props.value, "130");
});
test("financial screen creates all three charts with data and hides charts on empty/denied data", async () => {
  for (const mode of ["data", "empty", "denied"]) {
    const harness = await uiHarness({
      access: async () => mode !== "denied",
      report: async () => (mode === "data" ? orderRows : []),
    });
    let tree = nodes(harness.render(harness.ui.FinancialScreen));
    await tick();
    tree = nodes(harness.render(harness.ui.FinancialScreen));
    if (mode === "data") {
      const selects = tree.filter((node) => node.type === "select");
      selects[1].props.onChange({ target: { value: "all" } });
      tree = nodes(harness.render(harness.ui.FinancialScreen));
      assert.equal(tree.filter((node) => node.type === "LineChart").length, 2);
      assert.equal(tree.filter((node) => node.type === "BarChart").length, 1);
    } else {
      assert.equal(
        tree.filter((node) => node.type === "LineChart" || node.type === "BarChart").length,
        0,
      );
      if (mode === "denied") assert.ok(tree.some((node) => node.props?.role === "alert"));
    }
  }
});

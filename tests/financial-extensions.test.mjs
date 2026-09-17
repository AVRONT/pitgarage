import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
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
  new Function("require", "exports", outputText)(
    (id) => (id in mocks ? mocks[id] : require(id)),
    exports,
  );
  return exports;
}
const financial = await load("financial-model.ts");
const payments = await load("payment-model.ts", { "./financial-model": financial });
const authors = await load("activity-author.ts", {
  "@/features/auth/auth-context": {}, "@/integrations/supabase/client": { supabase: {} },
});
const extras = await load("extra-revenue-model.ts", { "./financial-model": financial });
const data = await load("pilot-data.ts");
test("structured backup only adds the four tables, retaining the original 72h and private snapshot", async () => {
  const read = name => readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8");
  const before = await read("20260914112831_fa9c35d6-17af-4634-ac46-2124d8246e68.sql");
  const after = await read("20260914211122_financial_extensions_backup.sql");
  const withoutNewTables = after.split(/\r?\n/).filter(line => !/^\s*'(revenue_categories|extra_revenues|quotes|quote_item_financials)',/.test(line)).join("\n");
  assert.equal(withoutNewTables.trim(), before.replace(/\r\n/g,"\n").trim());
  for (const table of ["revenue_categories","extra_revenues","quotes","quote_item_financials"]) assert.ok(after.includes("from public." + table + " t"));
});
const workflow = await load("pilot-workflow.ts", {
  "./pilot-data": data,
  "./payment-model": payments,
});
const base = {
  ...data.initialOrders[0],
  id: "OS-1",
  customerId: "c",
  status: "Entregue",
  budget: [
    {
      id: "s",
      type: "Serviço",
      name: "Serviço",
      price: 1000,
      approval: "Aprovado",
      executed: true,
    },
  ],
  payment: undefined,
};
const receipt = {
  id: "r",
  amount: 400,
  date: "2026-09-14T12:00:00Z",
  method: "PIX",
  note: "Sinal",
  recordedBy: "u",
};
const partial = {
  amount: 400,
  date: receipt.date,
  method: "PIX",
  status: "Parcial",
  receipts: [receipt],
};
test("debt is derived: unpaid / partial / paid, including delivered OS and customer totals", () => {
  assert.deepEqual(payments.paymentSummary(base), {
    subtotal: 1000,
    discount: 0,
    total: 1000,
    paid: 0,
    fees: 0,
    netReceived: 0,
    balance: 1000,
    credit: 0,
    status: "Em aberto",
  });
  assert.equal(payments.paymentSummary({ ...base, payment: partial }).balance, 600);
  assert.equal(payments.paymentSummary({ ...base, payment: partial }).status, "Parcial");
  const paid = { ...partial, receipts: [receipt, { ...receipt, id: "r2", amount: 600 }] };
  assert.equal(payments.paymentSummary({ ...base, payment: paid }).status, "Pago");
  const customer = payments.customerDebts(
    [
      base,
      { ...base, id: "OS-2", payment: partial },
      { ...base, id: "OS-3", customerId: "other" },
      { ...base, id: "OS-4", cancelledAt: "2026-09-14" },
    ],
    "c",
  );
  assert.equal(customer.balance, 1600);
  assert.equal(customer.debts.length, 2);
  assert.equal(customer.debts[1].order.status, "Entregue");
});
test("receipt fees preserve gross debt settlement and derive net cash", () => {
  assert.deepEqual(payments.receiptAmounts({ amount: 500, method: "Cartão", feeAmount: 20 }), {
    gross: 500, fee: 20, net: 480,
  });
  assert.deepEqual(payments.receiptAmounts({ amount: 400, method: "PIX" }), {
    gross: 400, fee: 0, net: 400,
  });
  const mixed = payments.paymentSummary({
    ...base,
    payment: {
      ...partial,
      receipts: [
        { ...receipt, amount: 400 },
        { ...receipt, id: "card", amount: 600, method: "Cartão", feeAmount: 24, netAmount: 576 },
      ],
    },
  });
  assert.equal(mixed.paid, 1000);
  assert.equal(mixed.balance, 0);
  assert.equal(mixed.fees, 24);
  assert.equal(mixed.netReceived, 976);
});

test("order result subtracts service costs and financial fees", () => {
  const amounts = financial.orderAmounts({
    orderId: "o", orderNumber: "OS-1", vehicle: null, customer: null, kind: "Carro",
    completedAt: "2026-09-17", discountAmount: 0, paid: 500, fees: 20, netReceived: 480,
    items: [{ type: "Serviço", name: "Troca", quantity: 1, revenue: 500, unitCost: 100 }],
  });
  assert.equal(amounts.cost, 100);
  assert.equal(amounts.fees, 20);
  assert.equal(amounts.netReceived, 480);
  assert.equal(amounts.result, 380);
});

test("financial correction UI is separate from operational reopening and requires a reason", async () => {
  const source = await readFile(new URL("../src/features/pilot/financial-correction.tsx", import.meta.url), "utf8");
  assert.match(source, /Corrigir financeiro/);
  assert.match(source, /Motivo obrigatório/);
  assert.match(source, /receipt|discount|cost/);
  assert.doesNotMatch(source, /status\s*:/);
});
test("legacy paid/pending are not lost or mistaken for cash; reversal preserves receipts and exposes credit", () => {
  assert.equal(
    payments.paymentSummary({
      ...base,
      payment: { ...partial, receipts: undefined, status: "Pago" },
    }).paid,
    400,
  );
  assert.equal(
    payments.paymentSummary({
      ...base,
      payment: { ...partial, receipts: undefined, status: "Pendente" },
    }).paid,
    0,
  );
  for (const status of data.orderStatuses.slice(1)) {
    const reversed = workflow.reverseOrderWorkflow({ ...base, status, payment: partial });
    assert.deepEqual(reversed.payment, partial);
  }
  const reversed = workflow.reverseOrderWorkflow({
    ...base,
    status: "Em diagnóstico",
    payment: partial,
  });
  assert.equal(payments.paymentSummary(reversed).credit, 400);
  assert.equal(workflow.evaluateOrderWorkflow({ ...base, payment: partial }).paymentPending, true);
});
test("extra revenues: cost default, date/category/subcategory filters and consolidation", () => {
  const rows = [
    { id: "1", date: "2026-09-14", category_id: "c", subcategory_id: "s", revenue: 500, cost: 320 },
    { id: "2", date: "2026-09-15", category_id: "c", subcategory_id: null, revenue: 200 },
    { id: "3", date: "2026-08-14", category_id: "x", subcategory_id: null, revenue: 100, cost: 10 },
  ];
  const a = extras.extraSummary(rows, "2026-09-01", "2026-09-30", "c", "s");
  assert.equal(a.result, 180);
  assert.equal(a.rows.length, 1);
  const b = extras.extraSummary(rows, "2026-09-01", "2026-09-30", "c");
  assert.equal(b.cost, 320);
  assert.equal(b.revenue, 700);
  assert.equal(b.result, 380);
  assert.deepEqual(extras.consolidated({ revenue: 1000, cost: 200, result: 800 }, b), {
    revenue: 1700,
    cost: 520,
    result: 1180,
  });
  assert.deepEqual(extras.consolidated({ revenue: null, cost: null, result: null }, b), {
    revenue: null,
    cost: null,
    result: null,
  });
});
test("receipt dates use local calendar day, preserving legacy date-only strings", () => {
  assert.equal(payments.receiptDay("2026-09-14"), "2026-09-14");
  const d = new Date(2026, 8, 14, 23, 59);
  assert.equal(payments.receiptDay(d.toISOString()), "2026-09-14");
  assert.equal(payments.receiptDay("invalid"), "");
});
test("backup roundtrip preserves legacy and multiple receipts; duplicate receipt rejected", async () => {
  const workshop = { name: "Oficina" };
  const api = await load("pilot-storage.ts", {
    "./workshop-data": { defaultWorkshop: workshop, workshopStorageKey: "test" },
  });
  const backup = api.createBackup(
    {
      customers: data.initialCustomers,
      vehicles: data.initialVehicles,
      orders: [
        { ...data.initialOrders[0], payment: partial },
        {
          ...data.initialOrders[1],
          payment: { amount: 100, method: "PIX", status: "Pago", date: "2026-09-14" },
        },
      ],
    },
    workshop,
  );
  assert.deepEqual(api.parseBackup(JSON.stringify(backup)).data.orders[0].payment, partial);
  backup.data.orders[0].payment = { ...partial, receipts: [receipt, receipt] };
  assert.throws(() => api.parseBackup(JSON.stringify(backup)), /ordens/);
});
function find(node, type) {
  if (!node || typeof node !== "object") return;
  if (node.type === type) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const hit = find(child, type);
    if (hit) return hit;
  }
}
test("cash and mixed receipts survive backup reload without changing balance calculations", async () => {
  const workshop = { name: "Oficina" };
  const api = await load("pilot-storage.ts", {
    "./workshop-data": { defaultWorkshop: workshop, workshopStorageKey: "test" },
  });
  for (const method of ["PIX", "Cartão", "Dinheiro"]) {
    const payment = { ...partial, method, receipts: [{ ...receipt, method }] };
    const backup = api.createBackup({
      customers: data.initialCustomers, vehicles: data.initialVehicles,
      orders: [{ ...data.initialOrders[0], budget: base.budget, payment }],
    }, workshop);
    const restored = api.parseBackup(JSON.stringify(backup)).data.orders[0];
    assert.equal(restored.payment.receipts[0].method, method);
    assert.equal(payments.paymentSummary(restored).balance, 600);
    assert.equal(payments.paymentSummary(restored).status, "Parcial");
    restored.payment = { ...payment, method: "Cartão", amount: 1000, status: "Pago",
      receipts: [...payment.receipts, { ...receipt, id: "r2", amount: 600, method: "Cartão" }] };
    const reloaded = api.parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, orders: [restored] } })).data.orders[0];
    assert.equal(payments.paymentSummary(reloaded).balance, 0);
    assert.equal(payments.paymentSummary(reloaded).paid, 1000);
    assert.equal(payments.paymentSummary(reloaded).status, "Pago");
    assert.equal(reloaded.payment.receipts[0].method, method);
  }
  const invalid = api.createBackup({ customers: data.initialCustomers, vehicles: data.initialVehicles,
    orders: [{ ...data.initialOrders[0], payment: { ...partial, method: "Cheque" } }] }, workshop);
  assert.throws(() => api.parseBackup(JSON.stringify(invalid)), /ordens/);
});
test("payment form prevents double submit and retains entered value after failure", async () => {
  const states = [],
    refs = [];
  let s = 0,
    r = 0;
  const react = {
    useState(initial) {
      const i = s++;
      if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial;
      return [
        states[i],
        (value) => {
          states[i] = value;
        },
      ];
    },
    useRef(initial) {
      const i = r++;
      return (refs[i] ??= { current: initial });
    },
  };
  const { OrderPayments } = await load("order-payments.tsx", {
    react,
    "./order-discount": { OrderDiscount: () => null },
    "./financial-correction": { FinancialCorrection: () => null },
    "./activity-author": authors,
    "./pilot-data": data,
    "./payment-model": payments,
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/input": { Input: "input" },
  });
  let reject,
    calls = 0;
  const save = (input) => {
    assert.equal(input.receipt.method, "Dinheiro");
    assert.equal(input.receipt.amount, 400);
    assert.equal(input.receipt.feeAmount, 0);
    calls++;
    return new Promise((_, fail) => {
      reject = fail;
    });
  };
  const render = () => {
    s = 0;
    r = 0;
    return OrderPayments({ order: base, save });
  };
  const methodSelect = find(render(), "select");
  assert.deepEqual(methodSelect.props.children.map(option => option.props.children), ["PIX", "Cartão", "Dinheiro"]);
  methodSelect.props.onChange({ target: { value: "Dinheiro" } });
  states[0] = "400";
  const form = find(render(), "form");
  const first = form.props.onSubmit({ preventDefault() {} });
  await form.props.onSubmit({ preventDefault() {} });
  assert.equal(calls, 1);
  reject(new Error("conflict"));
  await first;
  assert.equal(states[0], "400");
  assert.match(states[6], /Recarregue/);
});
test("receipt history renders cash, recorder and note from saved payment data", async () => {
  const { OrderPayments } = await load("order-payments.tsx", {
    "./order-discount": { OrderDiscount: () => null },
    "./financial-correction": { FinancialCorrection: () => null },
    "./activity-author": authors,
    "./pilot-data": data, "./payment-model": payments,
    "@/components/ui/button": { Button: "button" }, "@/components/ui/input": { Input: "input" },
  });
  const html = require("react-dom/server").renderToStaticMarkup(
    require("react").createElement(OrderPayments, {
      order: { ...base, payment: { ...partial, method: "Dinheiro", receipts: [{ ...receipt, method: "Dinheiro" }] } },
      save: async () => {},
      activityAuthors: { u: "Suporte PitGarage" },
    }),
  );
  const history = html.slice(html.indexOf("<ul"));
  assert.match(history, /Dinheiro/);
  assert.match(history, /Registrado por: Suporte PitGarage/);
  assert.match(history, /Sinal/);
});
test("commercial quote document uses persisted model/plate snapshot and conversion stays explicit", async () => {
  const source = await readFile(
    new URL("../src/features/pilot/quotes-screen.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /quote.vehicleModelText.*quote.vehiclePlateText/);
  assert.match(source, /<dd>\{vehicleLabel\(open\)\}<\/dd>/);
  const conversion = await readFile(
    new URL("../src/features/pilot/quote-vehicle-conversion.tsx", import.meta.url),
    "utf8",
  );
  assert.match(conversion, /matchVehicle\(quote.id\)/);
  assert.match(conversion, /useState\(quote.vehicleId \?\? ""\)/);
});

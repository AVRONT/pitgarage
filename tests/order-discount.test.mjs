import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
async function load(name, mocks = {}) {
  const source = await readFile(new URL("../src/features/pilot/" + name, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source.replaceAll("import.meta.env.DEV", "true"), { fileName: name, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const exports = {};
  new Function("require", "exports", outputText)(id => id in mocks ? mocks[id] : require(id), exports);
  return exports;
}
const financial = await load("financial-model.ts");
const payments = await load("payment-model.ts", { "./financial-model": financial });
const data = await load("pilot-data.ts");
const base = { ...data.initialOrders[0], status: "Em manutenção", completedAt: undefined,
  budget: [{ id: "p", name: "Peça", type: "Peça", price: 1000, approval: "Aprovado", executed: true },
    { id: "s", name: "Serviço", type: "Serviço", price: 560, approval: "Aprovado", executed: true }], payment: undefined };
const discounted = { ...base, discountAmount: 60, discountReason: "PIX" };
const paid = amount => ({ amount, status: "Pago", method: "PIX", date: "2026-09-16",
  receipts: [{ id: "1", amount, method: "PIX", date: "2026-09-16", note: "", recordedBy: "u" }] });

test("commercial discount reduces total and debt without changing approved prices", () => {
  const before = structuredClone(discounted);
  assert.equal(payments.paymentSummary(base).total, 1560);
  assert.equal(payments.paymentSummary(discounted).total, 1500);
  assert.equal(payments.paymentSummary({ ...discounted, payment: paid(1500) }).status, "Pago");
  const summary = payments.paymentSummary({ ...discounted, payment: paid(500) });
  assert.equal(summary.balance, 1000);
  assert.equal(summary.status, "Parcial");
  assert.deepEqual(discounted, before);
  const multiple = paid(500);
  multiple.receipts.push({ ...multiple.receipts[0], id: "2", amount: 1000 });
  assert.equal(payments.paymentSummary({ ...discounted, payment: multiple }).balance, 0);
  assert.equal(payments.paymentSummary({ ...discounted, payment: paid(1560) }).credit, 60);
});

test("discount validation rejects invalid precision, limits and reduction below received money", () => {
  for (const amount of [-1, NaN, Infinity, 0.001, 1561])
    assert.ok(payments.discountError(base, amount));
  assert.equal(payments.discountError(base, 1560), null);
  assert.equal(payments.discountError({ ...base, payment: paid(1000) }, 560), null);
  assert.match(payments.discountError({ ...base, payment: paid(1000) }, 561), /crédito\/estorno/);
  assert.equal(payments.discountError(base, 0), null);
});

test("closed, delivered and cancelled orders cannot edit commercial discount", () => {
  assert.equal(payments.discountBlocker(base), null);
  for (const status of ["Serviço concluído", "Aguardando retirada", "Entregue"])
    assert.ok(payments.discountBlocker({ ...base, status }));
  assert.ok(payments.discountBlocker({ ...base, completedAt: "2026-09-16" }));
  assert.ok(payments.discountBlocker({ ...base, cancelledAt: "2026-09-16" }));
});

test("financial revenue and gross result deduct the OS discount once, leaving costs and item revenue intact", () => {
  const row = { orderId: "o", orderNumber: "OS-1", kind: "Carro", completedAt: "2026-09-16", discountAmount: 60,
    items: [{ type: "Peça", revenue: 1000, quantity: 1, unitCost: 900 },
      { type: "Serviço", revenue: 560, quantity: 1, unitCost: null }] };
  const summary = financial.aggregateOrders([row]);
  assert.equal(summary.grossRevenue, 1560);
  assert.equal(summary.discountAmount, 60);
  assert.equal(summary.revenue, 1500);
  assert.equal(summary.cost, 900);
  assert.equal(summary.result, 600);
  assert.equal(summary.partsRevenue, 1000);
  assert.equal(summary.servicesRevenue, 560);
  assert.equal(summary.timeline[0].Faturamento, 1500);
  assert.equal(summary.vehicleTimeline[0].Carros, 600);
});

test("backup reload retains discount and legacy orders, rejects negative or over-subtotal discounts", async () => {
  const workshop = { name: "Oficina" };
  const storage = await load("pilot-storage.ts", { "./workshop-data": { defaultWorkshop: workshop, workshopStorageKey: "test" } });
  const backup = storage.createBackup({ customers: data.initialCustomers, vehicles: data.initialVehicles,
    orders: [discounted, { ...base, id: "OS-legacy" }] }, workshop);
  const restored = storage.parseBackup(JSON.stringify(backup)).data.orders;
  assert.equal(payments.paymentSummary(restored[0]).total, 1500);
  assert.equal(restored[0].discountReason, "PIX");
  assert.equal(payments.paymentSummary(restored[1]).total, 1560);
  for (const discountAmount of [-1, 1561, 0.001]) {
    backup.data.orders = [{ ...base, discountAmount }];
    assert.throws(() => storage.parseBackup(JSON.stringify(backup)), /ordens/);
  }
});

test("final document displays approved subtotal, discount, net total and derived paid state without private costs", async () => {
  const { FinalOrderSummary } = await load("final-order-summary.tsx", {
    "./pilot-data": data, "./payment-model": payments,
    "./workshop-document-header": { WorkshopIdentity: () => null },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/dialog": { Dialog: "div", DialogContent: "div", DialogTitle: "h1", DialogDescription: "p" },
  });
  const render = order => require("react-dom/server").renderToStaticMarkup(require("react").createElement(FinalOrderSummary, {
    order, customer: data.initialCustomers[0], vehicle: data.initialVehicles[0], workshop: {}, open: true, onOpenChange() {},
  }));
  const html = render({ ...discounted, payment: paid(1500) }).replaceAll("\u00a0", " ");
  assert.match(html, /Serviços e peças/);
  assert.match(html, /Desconto/);
  assert.match(html, /1\.560,00/);
  assert.match(html, /60,00/);
  assert.match(html, /1\.500,00/);
  assert.match(html, /Pago/);
  assert.doesNotMatch(html, /markup|margem|custo/i);
  assert.doesNotMatch(render(base), /Desconto/);
});

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
test("discount dialog retains draft/request after uncertain failure, blocks double click and closed orders", async () => {
  const states = [], refs = []; let s = 0, r = 0;
  const react = {
    useState(initial) { const i = s++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
    useRef(initial) { const i = r++; return refs[i] ??= { current: initial }; },
  };
  const { OrderDiscount } = await load("order-discount.tsx", {
    react, "./pilot-data": data, "./payment-model": payments,
    "@/components/ui/button": { Button: "button" }, "@/components/ui/input": { Input: "input" },
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle", "DialogTrigger"].map(n => [n,n])),
  });
  const calls = []; let reject;
  const save = input => { calls.push(input); return new Promise((_, fail) => { reject = fail; }); };
  const render = (order = base) => { s = 0; r = 0; return nodes(OrderDiscount({ order, save, disabled: false, onBusyChange() {} })); };
  render().find(n => n.type === "Dialog").props.onOpenChange(true);
  render().find(n => n.type === "input").props.onChange({ target: { value: "60" } });
  const submit = render().find(n => n.type === "form").props.onSubmit;
  const pending = submit({ preventDefault() {} });
  await submit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].discount.amount, 60);
  reject(new Error("Recarregue a OS")); await pending;
  assert.equal(render().find(n => n.type === "input").props.value, "60");
  assert.equal(render().find(n => n.type === "Dialog").props.open, true);
  const retry = render().find(n => n.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(calls[1].discount.id, calls[0].discount.id);
  reject(new Error("Recarregue a OS")); await retry;
  await render({ ...base, status: "Entregue" }).find(n => n.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 2);
});

test("repository reload maps persisted discount, uses current version, and does not invent discounts on legacy rows", async () => {
  let row = { id: "db", order_number: 1, updated_at: "v1", budget: base.budget, status: base.status };
  const query = { select() { return this; }, eq() { return this; }, async single() { return { data: row }; } };
  const { createOperationalRepository } = await load("operational-repository.ts", {
    "./financial-model": financial,
    "@/integrations/supabase/client": { supabase: { from: () => query } },
    "./financial-api": { financialRpc: async (name, args) => {
      assert.equal(name, "set_order_discount");
      assert.deepEqual(args, { order_id: "db", expected_version: "v1", request_id: "req", amount: 60, reason: "PIX" });
      row = { ...row, updated_at: "v2", discount_amount: 60, discount_reason: "PIX" };
      return row;
    } },
  });
  const repo = createOperationalRepository(false);
  const old = await repo.reloadOrder({ databaseId: "db" });
  assert.equal(payments.paymentSummary(old).total, 1560);
  await repo.savePartFinancial(old, { discount: { id: "req", amount: 60, reason: "PIX" } });
  const reloaded = await createOperationalRepository(false).reloadOrder(old);
  assert.equal(payments.paymentSummary(reloaded).total, 1500);
  assert.equal(reloaded.discountReason, "PIX");
});

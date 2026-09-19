import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Reuses the installed TypeScript compiler; no test runtime dependency.
const source = await readFile(
  new URL("../src/features/pilot/vehicle-history.ts", import.meta.url),
  "utf8",
);
const timelineSource = await readFile(
  new URL("../src/features/pilot/vehicle-history-timeline.tsx", import.meta.url),
  "utf8",
);
const appSource = await readFile(
  new URL("../src/features/pilot/pilot-app.tsx", import.meta.url),
  "utf8",
);
const vehicleDetailRouteSource = appSource.slice(
  appSource.indexOf('{screen === "vehicle"'),
  appSource.indexOf('{screen === "order"'),
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { vehicleHistory, historyEntry, historyDate, historyMileage } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const vehicle = { id: "v", mileage: 90000 };
const order = {
  id: "OS-1",
  vehicleId: "v",
  openedAt: "2026-09-03",
  entryMileage: 50000,
  status: "Recebido",
};

test("empty history uses only existing vehicle mileage", () => {
  assert.deepEqual(vehicleHistory(vehicle, []), {
    orders: [],
    lastVisit: "Não registrada",
    mileage: "90.000 km",
    mileageSource: "Cadastro do veículo",
  });
});
test("chronology, vehicle isolation and no mutation", () => {
  const orders = [
    { ...order, id: "old", openedAt: "2025-01-01" },
    { ...order, id: "unknown", openedAt: "" },
    { ...order },
    { ...order, id: "other", vehicleId: "another" },
  ];
  const before = structuredClone(orders);
  assert.deepEqual(
    vehicleHistory(vehicle, orders).orders.map((x) => x.id),
    ["OS-1", "old", "unknown"],
  );
  assert.deepEqual(orders, before);
});
test("mileage follows latest dated valid entry, not maximum odometer", () => {
  assert.equal(vehicleHistory(vehicle, [order]).mileage, "50.000 km");
  assert.equal(
    vehicleHistory(vehicle, [{ ...order, openedAt: "2026-09-04", entryMileage: null }, order])
      .mileageSource,
    "Entrada da OS-1",
  );
  assert.equal(historyMileage(0), "0 km");
  for (const missing of [null, undefined, NaN, -1, "500"])
    assert.equal(historyMileage(missing), "Não registrada");
});
test("old fields do not invent execution, value or evidence", () => {
  const entry = historyEntry(order);
  assert.deepEqual(entry, {
    completed: false,
    services: [],
    parts: [],
    approvedTotal: null,
    team: "",
    evidenceCount: 0,
  });
  assert.equal(historyDate(undefined), "Não registrada");
  assert.equal(historyDate("invalid"), "Não registrada");
  assert.equal(historyDate("2026-09-03"), "03/09/2026");
});
test("approved budget does not imply execution", () => {
  const budget = [
    {
      id: "s",
      type: "Serviço",
      name: "Executed",
      executed: true,
      approval: "Aprovado",
      price: 100,
      cost: 50,
    },
    { id: "p", type: "Peça", executed: true, approval: "Aprovado", price: 200 },
    { id: "a", type: "Serviço", approval: "Aprovado", price: 300 },
    { id: "r", type: "Peça", approval: "Recusado", price: 400 },
  ];
  const result = historyEntry({ ...order, budget });
  assert.deepEqual(
    result.services.map((x) => x.id),
    ["s"],
  );
  assert.deepEqual(
    result.parts.map((x) => x.id),
    ["p"],
  );
  assert.equal(result.approvedTotal, 600);
});
test("invalid approved prices are unavailable, valid zero is retained", () => {
  for (const price of [undefined, null, NaN, Infinity, -1, "10"])
    assert.equal(
      historyEntry({ ...order, budget: [{ approval: "Aprovado", price }] }).approvedTotal,
      null,
    );
  assert.equal(
    historyEntry({ ...order, budget: [{ approval: "Aprovado", price: 0 }] }).approvedTotal,
    0,
  );
});
test("completion follows current status, not stale completion date", () => {
  assert.equal(historyEntry({ ...order, completedAt: "2026-09-02" }).completed, false);
  for (const status of ["Serviço concluído", "Aguardando retirada", "Entregue"])
    assert.equal(historyEntry({ ...order, status }).completed, true);
});
test("legacy arrays and responsible persons tolerate missing fields", () => {
  const result = historyEntry({
    ...order,
    budget: null,
    team: [null, "", "Maria"],
    evidence: [null, { id: "e" }],
  });
  assert.equal(result.team, "Maria");
  assert.equal(result.evidenceCount, 1);
});

test("quick orders only appear when they are linked to the vehicle", () => {
  const linked = { ...order, id: "OS-QUICK-LINKED", flowType: "quick" };
  const unlinked = { ...order, id: "OS-QUICK-UNLINKED", flowType: "quick", vehicleId: undefined };
  assert.deepEqual(
    vehicleHistory(vehicle, [unlinked, linked]).orders.map((item) => item.id),
    ["OS-QUICK-LINKED"],
  );
});

test("technical history keeps complaint, diagnosis, findings and notes as separate sections", () => {
  for (const label of ["Problema relatado", "Diagnóstico", "Constatações", "Observações"])
    assert.match(timelineSource, new RegExp(label));
  assert.match(timelineSource, /order\.complaint/);
  assert.match(timelineSource, /order\.diagnosis/);
  assert.match(timelineSource, /order\.findings/);
  assert.match(timelineSource, /order\.notes/);
});

test("history keeps execution visible and administrative details in the complete order", () => {
  assert.match(timelineSource, /Serviços realizados/);
  assert.match(timelineSource, /Peças utilizadas/);
  assert.match(timelineSource, /Ver OS completa/);
  assert.doesNotMatch(timelineSource, /Total aprovado no orçamento/);
  assert.doesNotMatch(timelineSource, /Responsáveis registrados/);
  assert.doesNotMatch(timelineSource, /<details/);
});

test("empty history offers a new order and vehicle detail preserves its context", () => {
  assert.match(timelineSource, /onNewOrder/);
  assert.match(timelineSource, /Nova OS/);
  assert.match(
    vehicleDetailRouteSource,
    /onNewOrder=\{\(\) => \{\s*setInitialOrderVehicleId\(selectedVehicleId\);[\s\S]*?setNewOrderOpen\(true\);\s*\}\}/,
  );
});

test("every history entry keeps access to the existing complete order flow", () => {
  assert.match(timelineSource, /onClick=\{\(\) => onOrder\(order\.id\)\}/);
});

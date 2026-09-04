import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Reuses the installed TypeScript compiler; no test runtime dependency.
const source = await readFile(
  new URL("../src/features/pilot/vehicle-history.ts", import.meta.url),
  "utf8",
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

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(name, mocks = {}) {
  const source = await readFile(new URL("../src/features/pilot/" + name, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }});
  const exports = {};
  new Function("require", "exports", outputText)(id => id in mocks ? mocks[id] : require(id), exports);
  return exports;
}

test("quick payment permits zero without method and requires an allowed method above zero", async () => {
  const quick = await load("quick-order-model.ts");
  assert.equal(quick.quickPaymentError(0, undefined, 180), null);
  assert.match(quick.quickPaymentError(10, undefined, 180), /forma de pagamento/i);
  assert.match(quick.quickPaymentError(10, "Cheque", 180), /forma de pagamento/i);
  assert.equal(quick.quickPaymentError(80, "PIX", 180), null);
  assert.match(quick.quickPaymentError(181, "PIX", 180), /total final/i);
  assert.equal(quick.quickPaymentError(180, "Cartão", 180, 20), null);
  assert.match(quick.quickPaymentError(180, "PIX", 180, 1), /taxa zero/i);
  assert.match(quick.quickPaymentError(180, "Dinheiro", 180, 1), /taxa zero/i);
  assert.match(quick.quickPaymentError(180, "Cartão", 180, 181), /taxa/i);
});

test("quick service becomes one approved and executed service budget item", async () => {
  const quick = await load("quick-order-model.ts");
  const item = quick.quickOrderBudgetItem("Troca de óleo", 180, "req-1");
  assert.deepEqual(item, { id: "quick-req-1", type: "Serviço", name: "Troca de óleo", price: 180,
    approval: "Aprovado", executed: true });
});

test("quick parts reuse budget items and contribute quantity times unit price to subtotal", async () => {
  const quick = await load("quick-order-model.ts");
  const parts = [
    { id: "part-a", name: "Filtro", quantity: 2, unitPrice: 35, unitCost: 18 },
    { id: "part-b", name: "Arruela", quantity: 3, unitPrice: 4 },
  ];
  assert.equal(quick.quickOrderSubtotal(180, parts), 262);
  assert.deepEqual(quick.quickOrderBudgetItems("Troca de óleo", 180, "req-1", parts), [
    { id: "quick-req-1", type: "Serviço", name: "Troca de óleo", price: 180,
      approval: "Aprovado", executed: true },
    { id: "part-a", type: "Peça", name: "Filtro", quantity: 2, unitPrice: 35, price: 70,
      approval: "Aprovado", executed: true },
    { id: "part-b", type: "Peça", name: "Arruela", quantity: 3, unitPrice: 4, price: 12,
      approval: "Aprovado", executed: true },
  ]);
});

test("rescue details are organized inside the existing service description", async () => {
  const quick = await load("quick-order-model.ts");
  assert.equal(quick.quickServiceDescription("Resgate de veículo", {
    pickup: "Rua X", destination: "Oficina Y", note: "Cliente aguardou no local",
  }), "Resgate de veículo\nRetirada: Rua X\nDestino: Oficina Y\nObservação: Cliente aguardou no local");
  assert.equal(quick.quickServiceDescription("Resgate de veículo", { pickup: "", destination: "Oficina Y", note: "" }),
    "Resgate de veículo\nDestino: Oficina Y");
});

test("quick payment status mirrors total, received amount and open balance", async () => {
  const quick = await load("quick-order-model.ts");
  assert.equal(quick.quickPaymentStatus(150, 150), "Pago");
  assert.equal(quick.quickPaymentStatus(150, 50), "Parcial");
  assert.equal(quick.quickPaymentStatus(150, 0), "Em aberto");
  assert.equal(quick.quickPaymentStatus(0, 0), "Em aberto");
});

test("vehicle label uses official vehicle first and quick snapshot without inventing plate", async () => {
  const quick = await load("quick-order-model.ts");
  const order = { quickVehicleBrand: "Honda", quickVehicleModel: "CG 160", quickVehicleYear: 2023 };
  assert.equal(quick.orderVehicleLabel(order), "Honda CG 160 · 2023");
  assert.equal(quick.orderVehicleLabel(order, { brand: "Honda", model: "Civic", year: 2020, plate: "ABC1D23" }), "Honda Civic · 2020 · ABC1D23");
});

test("legacy orders default to standard flow", async () => {
  const quick = await load("quick-order-model.ts");
  assert.equal(quick.orderFlowType({}), "standard");
  assert.equal(quick.orderFlowType({ flowType: "quick" }), "quick");
});

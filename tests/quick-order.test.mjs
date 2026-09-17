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

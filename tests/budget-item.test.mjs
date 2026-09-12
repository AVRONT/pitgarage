import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

async function load(file, mocks = {}) {
  const source = await readFile(new URL("../src/features/pilot/" + file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  new Function("require", "exports", outputText)((id) => mocks[id], exports);
  return exports;
}
const model = await load("financial-model.ts");
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
async function harness(allowed = true, save = async () => {}) {
  const state = [], refs = []; let cursor = 0, refCursor = 0, closed = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (v) => { state[i] = v; }]; },
    useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial }; },
  };
  const { AddBudgetItemDialog } = await load("add-budget-item-dialog.tsx", {
    react, "react/jsx-runtime": jsx, "./financial-model": model,
    "@/components/ui/button": { Button: "button" }, "@/components/ui/input": { Input: "input" },
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"].map((x) => [x, x])),
  });
  let tree;
  function render() {
    cursor = 0; refCursor = 0;
    tree = AddBudgetItemDialog({ financialAllowed: allowed, checkingPermission: false, save, onClose: () => closed++ });
    refs[2].current = { reportValidity: () => true, querySelector: () => ({ focus() {} }) };
    return tree;
  }
  render();
  return {
    render, closed: () => closed, text: () => text(tree),
    change(label, value) {
      const parent = nodes(tree).find((n) => n.type === "label" && text(n).startsWith(label));
      assert.ok(parent, label);
      nodes(parent).find((n) => n.type === "input" || n.type === "select").props.onChange({ target: { value } }); render();
    },
    click(label) { nodes(tree).find((n) => n.type === "button" && text(n) === label).props.onClick(); render(); },
    submit() { return nodes(tree).find((n) => n.type === "form").props.onSubmit({ preventDefault() {} }); },
  };
}
test("authorized part: manual sale survives cost changes; suggestion is explicit; quantity and profits", async () => {
  let saved; const h = await harness(true, async (input) => { saved = input; });
  h.change("Tipo", "Peça"); h.change("Descrição", "Pastilha"); h.change("Quantidade", "2");
  h.change("Custo", "100"); h.change("Acréscimo", "30"); h.change("Venda", "125");
  assert.match(h.text(), /Lucro total:.*50,00/);
  h.change("Acréscimo", "40"); await h.submit();
  assert.equal(saved.unitPrice, 125); assert.equal(saved.quantity, 2); assert.equal(saved.unitCost, 100);
  h.click("Usar preço sugerido"); await h.submit(); assert.equal(saved.unitPrice, 140);
});
test("unknown cost is not zero; services and unauthorized staff never send private fields", async () => {
  for (const allowed of [true, false]) {
    let saved; const h = await harness(allowed, async (input) => { saved = input; });
    assert.doesNotMatch(h.text(), /Custo unitário/);
    h.change("Descrição", "Item"); h.change("Valor", "50"); await h.submit();
    assert.equal(saved.newItem.type, "Serviço"); assert.equal(saved.unitCost, null);
    h.change("Tipo", "Peça");
    if (allowed) assert.match(h.text(), /Lucro total: Não informado/);
    else assert.doesNotMatch(h.text(), /Custo unitário|Lucro total|Preço sugerido/);
    await h.submit(); assert.equal(saved.quantity, 1); assert.equal(saved.unitCost, null); assert.equal(saved.markup, null);
  }
});
test("double click is locked; failure preserves draft and retry uses the same item id", async () => {
  let reject, calls = 0; const inputs = [];
  const h = await harness(true, (input) => { calls++; inputs.push(input); return calls === 1 ? new Promise((_, fail) => { reject = fail; }) : Promise.resolve(); });
  h.change("Descrição", "Diagnóstico"); h.change("Valor", "70");
  const pending = h.submit(); await h.submit(); assert.equal(calls, 1);
  reject(new Error("failure")); await pending; h.render();
  assert.equal(h.closed(), 0); assert.match(h.text(), /Seus campos foram mantidos/);
  await h.submit(); assert.equal(h.closed(), 1); assert.deepEqual(inputs[0], inputs[1]);
});
test("new RPC keeps costs private and writes both records in one transaction with version protection", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260912010000_add_budget_item_atomic.sql", import.meta.url), "utf8");
  assert.match(sql, /current_access_level\(\).*owner.*admin.*staff/);
  assert.match(sql, /not public.can_view_financial\(\)/);
  assert.match(sql, /for update/); assert.match(sql, /errcode='40001'/);
  assert.match(sql, /insert into public.order_part_financials/);
  assert.match(sql, /return to_jsonb\(target\)/);
  assert.doesNotMatch(sql, /exception\s+when/i);
  const commercial = sql.slice(sql.indexOf("item :="), sql.indexOf("update public.service_orders"));
  assert.doesNotMatch(commercial, /unit_cost|markup|profit/);
});

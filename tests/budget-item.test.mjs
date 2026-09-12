import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

async function load(file, mocks = {}) {
  const source = await readFile(new URL("../src/features/pilot/" + file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source.replaceAll("import.meta.env.DEV", "true"), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const exports = {};
  new Function("require", "exports", outputText)((id) => mocks[id], exports);
  return exports;
}
const model = await load("financial-model.ts");
test("local removal persists across repository reload and preserves other items/totals", async () => {
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  globalThis.window = { location: { hostname: "localhost" } };
  const order = { id: "OS-1", status: "Aguardando aprovação", budget: [
    { id: "p", name: "Peça", type: "Peça", price: 120, approval: "Aguardando aprovação" },
    { id: "s", name: "Serviço", type: "Serviço", price: 50, approval: "Aguardando aprovação" },
    { id: "a", name: "Outra", type: "Peça", price: 80, approval: "Aprovado" },
    { id: "r", name: "Recusada", type: "Peça", price: 20, approval: "Recusado" },
  ], activities: [{ id: "old" }] };
  let stored = JSON.stringify({ customers: [], vehicles: [], orders: [order] });
  globalThis.localStorage = { getItem: () => stored, setItem: (_, value) => { stored = value; } };
  try {
    const { createOperationalRepository } = await load("operational-repository.ts", { "./financial-model": model, "./financial-api": {}, "@/integrations/supabase/client": {} });
    const repo = createOperationalRepository(true);
    await repo.savePartFinancial(order, { removeItem: "p" });
    const latest = (await createOperationalRepository(true).load()).orders[0];
    assert.deepEqual(latest.budget, order.budget.slice(1));
    assert.equal(latest.budget.reduce((sum, item) => sum + item.price, 0), 150);
    assert.equal(latest.activities[0].id, "old");
    await repo.savePartFinancial(latest, { removeItem: "s" });
    assert.deepEqual((await repo.load()).orders[0].budget, order.budget.slice(2));
  } finally { globalThis.localStorage = originalStorage; globalThis.window = originalWindow; }
});
test("cloud removal passes expected version and translates conflicts without accepting a stale result", async () => {
  const row = { id: "db1", order_number: 1, updated_at: "v1", budget: [], status: "Aguardando aprovação" };
  const query = { select() { return this; }, eq() { return this; }, async single() { return { data: row }; } };
  const { createOperationalRepository, OrderVersionConflict } = await load("operational-repository.ts", {
    "./financial-model": model, "@/integrations/supabase/client": { supabase: { from: () => query } },
    "./financial-api": { financialRpc: async (name, args) => {
      assert.equal(name, "remove_budget_item");
      assert.deepEqual(args, { order_id: "db1", expected_version: "v1", item_id: "p" });
      throw Object.assign(new Error("conflict"), { code: "40001" });
    } },
  });
  const repo = createOperationalRepository(false);
  const order = await repo.reloadOrder({ databaseId: "db1" });
  await assert.rejects(repo.savePartFinancial(order, { removeItem: "p" }), OrderVersionConflict);
});
test("removal only in budget stages, legacy parts/services and partial approval", () => {
  for (const type of ["Peça", "Serviço"])
    for (const approval of ["Aguardando aprovação", "Aprovado", "Recusado"])
      assert.equal(model.canRemoveBudgetItem({ status: "Aguardando aprovação" }, { type, approval }), true);
  assert.equal(model.canRemoveBudgetItem({ status: "Em diagnóstico" }, { executed: true }), false);
  for (const status of ["Aguardando peça", "Em manutenção", "Serviço concluído", "Aguardando retirada", "Entregue"])
    assert.equal(model.canRemoveBudgetItem({ status }, { executed: false }), false);
});
test("removal confirmation blocks customers, duplicate clicks and keeps dialog on failure", async () => {
  const states = [], refs = []; let index = 0, refIndex = 0, calls = 0, reject;
  let role = "staff";
  const { RemoveBudgetItem } = await load("remove-budget-item.tsx", {
    react: {
      useState(v) { const i = index++; if (!(i in states)) states[i] = v; return [states[i], (next) => states[i] = next]; },
      useRef(v) { return refs[refIndex++] ??= { current: v }; },
    },
    "react/jsx-runtime": jsx, "./financial-model": model,
    "lucide-react": { Trash2: "icon" },
    "@/features/auth/auth-context": { useAuth: () => ({ accessLevel: role, isLocalBypass: false }) },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map((x) => [x, x])),
  });
  function render() {
    index = 0; refIndex = 0;
    return RemoveBudgetItem({ order: { status: "Aguardando aprovação" }, item: { id: "p1", name: "Pastilha" }, save: (input) => {
      assert.deepEqual(input, { removeItem: "p1" }); calls++;
      return new Promise((_, fail) => { reject = fail; });
    } });
  }
  role = "customer"; assert.equal(render(), null); role = "staff";
  let tree = render(); nodes(tree).find((n) => n.props?.["aria-label"] === "Remover Pastilha").props.onClick();
  tree = render(); assert.equal(nodes(tree).find((n) => n.type === "Dialog").props.open, true);
  const action = nodes(tree).find((n) => n.type === "button" && text(n) === "Remover item");
  const pending = action.props.onClick(); await action.props.onClick(); assert.equal(calls, 1);
  reject(new Error("conflict")); await pending; tree = render();
  assert.match(text(tree), /Recarregue a OS/);
  assert.equal(nodes(tree).find((n) => n.type === "Dialog").props.open, true);
});
test("removal SQL is atomic, guarded and deletes only matching private data", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260912020000_remove_budget_item_atomic.sql", import.meta.url), "utf8");
  assert.match(sql, /current_access_level\(\).*owner.*admin.*staff/);
  assert.match(sql, /for update/); assert.match(sql, /errcode='40001'/);
  assert.match(sql, /removed->>'executed'/);
  assert.match(sql, /delete from public.order_part_financials f where f.order_id=\$1 and f.item_id=\$3/);
  assert.match(sql, /jsonb_agg\(b order by ordinal\)/);
  assert.match(sql, /where b->>'id' is distinct from \$3/);
  assert.doesNotMatch(sql, /exception\s+when/i);
  assert.match(sql, /return to_jsonb\(target\)/);
});
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

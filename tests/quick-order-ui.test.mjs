import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

async function load(file, mocks = {}) {
  const source = await readFile(new URL(`../src/features/pilot/${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  new Function("require", "exports", outputText)((id) => mocks[id], exports);
  return exports;
}

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

test("quick dialog is single-screen, exposes both destinations and protects repeated submit", async () => {
  const source = await readFile(new URL("../src/features/pilot/quick-order-dialog.tsx", import.meta.url), "utf8");
  assert.match(source, /Finalizar atendimento/);
  assert.match(source, /Continuar como OS completa/);
  assert.match(source, /creating\.current/);
  assert.match(source, /autoFocus/);
  assert.doesNotMatch(source, /TabsTrigger|stepper|setStep/);
  for (const label of ["Cliente", "Marca", "Modelo", "Ano", "Serviço realizado", "Valor do serviço", "Valor recebido"])
    assert.match(source, new RegExp(label));
});

test("application keeps standard action and wires quick draft into standard flow", async () => {
  const source = await readFile(new URL("../src/features/pilot/pilot-app.tsx", import.meta.url), "utf8");
  assert.match(source, /OS Rápida/);
  assert.match(source, /initialQuickDraft/);
  assert.match(source, /createQuickOrder/);
});

test("operational home exposes both order actions and keeps them stacked on mobile", async () => {
  const icons = Object.fromEntries(
    ["AlertTriangle", "CalendarDays", "CarFront", "CheckCircle2", "ChevronRight", "ClipboardList", "Clock3", "Gauge", "PackageCheck", "Plus", "Sparkles", "Wrench"].map((name) => [name, name]),
  );
  const { OperationalDashboard } = await load("operational-dashboard.tsx", {
    react: { useEffect() {}, useMemo: (factory) => factory(), useState: (initial) => [initial, () => {}] },
    "react/jsx-runtime": jsx,
    "lucide-react": icons,
    "@/components/ui/badge": { Badge: "span" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/card": { Card: "section", CardContent: "div" },
    "@/features/auth/auth-context": { useAuth: () => ({ isLocalBypass: true }) },
    "@/features/platform/platform-api": { platformApi: { listCalendarEvents: async () => [] } },
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "./pilot-workflow": { evaluateOrderWorkflow: () => ({}) },
  });
  let standard = 0;
  let quick = 0;
  const tree = OperationalDashboard({
    orders: [], vehicles: [], customers: [], onNavigate() {},
    onNewOrder: () => standard++, onNewQuickOrder: () => quick++,
  });
  const buttons = nodes(tree).filter((node) => node.type === "button");
  const quickButton = buttons.find((node) => text(node).includes("OS Rápida"));
  const standardButton = buttons.find((node) => text(node).includes("Nova ordem de serviço"));
  assert.ok(quickButton);
  assert.ok(standardButton);
  quickButton.props.onClick();
  standardButton.props.onClick();
  assert.equal(quick, 1);
  assert.equal(standard, 1);
  const actionGroup = nodes(tree).find(
    (node) => node.props?.children && text(node).includes("OS Rápida") && text(node).includes("Nova ordem de serviço") && /flex-col/.test(node.props?.className ?? ""),
  );
  assert.match(actionGroup?.props.className ?? "", /sm:flex-row/);
});

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

test("orders screen presents an operational queue with status, next action and continue CTA", async () => {
  const source = await readFile(new URL("../src/features/pilot/pilot-app.tsx", import.meta.url), "utf8");
  const ordersScreen = source.slice(source.indexOf("function OrdersScreen"), source.indexOf("function CustomerDetail"));

  assert.match(ordersScreen, /const workflow = evaluateOrderWorkflow\(order\)/);
  assert.match(ordersScreen, /Próxima ação/);
  assert.match(ordersScreen, /workflow\.nextAction\.label/);
  assert.match(ordersScreen, />\s*Continuar\s*</);
  assert.match(ordersScreen, /StatusBadge status=\{order\.status\}/);
  assert.doesNotMatch(ordersScreen, /hidden md:block[\s\S]{0,80}<StatusBadge status=\{order\.status\}/);
});

test("vehicles screen exposes operational actions and starts a standard order with the vehicle selected", async () => {
  const source = await readFile(new URL("../src/features/pilot/pilot-app.tsx", import.meta.url), "utf8");
  const vehiclesScreen = source.slice(source.indexOf("function VehiclesScreen"), source.indexOf("function OrdersScreen"));
  const newOrderDialog = source.slice(source.indexOf("function NewOrderDialog"));

  assert.match(vehiclesScreen, /evaluateOrderWorkflow\(current\)/);
  assert.match(vehiclesScreen, /Continuar OS/);
  assert.match(vehiclesScreen, /Ver veículo/);
  assert.match(vehiclesScreen, /Nova OS/);
  assert.match(vehiclesScreen, /onNewForVehicle\(vehicle\.id\)/);
  assert.match(newOrderDialog, /initialVehicleId\?: string/);
  assert.match(newOrderDialog, /setCustomerId\(initialVehicle\.customerId\)/);
  assert.match(newOrderDialog, /setVehicleId\(initialVehicle\.id\)/);
});

test("operational home prioritizes action-oriented workshop shortcuts", async () => {
  const icons = Object.fromEntries(
    ["AlertTriangle", "CalendarDays", "CarFront", "CheckCircle2", "ChevronRight", "ClipboardList", "Clock3", "Gauge", "PackageCheck", "Plus", "Settings2", "Sparkles", "WalletCards", "Wrench"].map((name) => [name, name]),
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
  const destinations = [];
  const tree = OperationalDashboard({
    orders: [], vehicles: [], customers: [], onNavigate(target) { destinations.push(target.screen); },
    onNewOrder: () => standard++, onNewQuickOrder: () => quick++,
  });
  const buttons = nodes(tree).filter((node) => node.type === "button");
  const quickButton = buttons.find((node) => text(node).includes("Nova OS Rápida"));
  const standardButton = buttons.find((node) => text(node).includes("OS Completa"));
  const continueButton = buttons.find((node) => text(node).includes("Continuar OS"));
  const paymentButton = buttons.find((node) => text(node).includes("Pagamentos"));
  assert.ok(quickButton);
  assert.ok(standardButton);
  assert.ok(continueButton);
  assert.ok(paymentButton);
  assert.match(text(tree), /O que você quer fazer\?/);
  assert.match(text(tree), /Registrar um serviço simples/);
  assert.match(text(tree), /Ver valores pendentes/);
  quickButton.props.onClick();
  standardButton.props.onClick();
  continueButton.props.onClick();
  paymentButton.props.onClick();
  assert.equal(quick, 1);
  assert.equal(standard, 1);
  assert.deepEqual(destinations, ["orders", "financial"]);
});

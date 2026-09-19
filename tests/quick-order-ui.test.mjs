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

test("quick dialog focuses and scrolls to the first invalid field without closing", async () => {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => {
        slots[index] = typeof value === "function" ? value(slots[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return (slots[index] ??= { current: initial });
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, position) => value !== previous[position])) {
        slots[index] = dependencies;
        effects.push(effect);
      }
    },
  };
  const model = await load("quick-order-model.ts", { "./pilot-data": {} });
  const ui = await load("quick-order-dialog.tsx", {
    react,
    "react/jsx-runtime": jsx,
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/dialog": {
      Dialog: "Dialog",
      DialogContent: "DialogContent",
      DialogDescription: "DialogDescription",
      DialogFooter: "DialogFooter",
      DialogHeader: "DialogHeader",
      DialogTitle: "DialogTitle",
    },
    "@/components/ui/input": { Input: "input" },
    "@/components/ui/label": { Label: "label" },
    "@/components/ui/command": {
      Command: "Command",
      CommandEmpty: "CommandEmpty",
      CommandInput: "CommandInput",
      CommandItem: "CommandItem",
      CommandList: "CommandList",
    },
    "./pilot-data": { warrantyDays: 90 },
    "./quick-order-model": model,
  });
  const focused = [];
  const scrolled = [];
  const fields = new Map();
  const field = (id) => ({
    focus: () => focused.push(id),
    scrollIntoView: (options) => scrolled.push({ id, options }),
    closest: () => null,
  });
  for (const id of ["quick-customer-search", "quick-brand"]) fields.set(id, field(id));
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => fields.get(id) ?? null };
  let finalized = 0;
  const props = {
    open: true,
    onOpenChange() {},
    customers: [{ id: "customer-1", name: "Maria", phone: "48999999999" }],
    vehicles: [],
    financialAllowed: false,
    onFinalize: async () => { finalized += 1; },
    onContinueAsStandard() {},
  };
  const render = () => {
    cursor = 0;
    const tree = nodes(ui.QuickOrderDialog(props));
    for (const effect of effects.splice(0)) effect();
    return tree;
  };
  const submit = (tree) => tree
    .find((node) => node.type === "button" && text(node) === "Finalizar atendimento")
    .props.onClick();

  try {
    let tree = render();
    submit(tree);
    tree = render();
    assert.deepEqual(focused, ["quick-customer-search"]);
    assert.equal(scrolled[0].id, "quick-customer-search");
    assert.equal(scrolled[0].options.block, "center");
    assert.equal(tree.find((node) => node.type === "Dialog").props.open, true);
    assert.match(text(tree.find((node) => node.props?.role === "alert")), /Selecione um cliente/);

    tree.find((node) => node.type === "CommandItem").props.onSelect();
    tree = render();
    submit(tree);
    tree = render();
    assert.deepEqual(focused, ["quick-customer-search", "quick-brand"]);
    assert.match(text(tree.find((node) => node.props?.role === "alert")), /Marca, Modelo e Ano/);
    assert.equal(finalized, 0);

    for (const [id, value] of [
      ["quick-brand", "Honda"],
      ["quick-model", "CG 160"],
      ["quick-year", "2025"],
      ["quick-service", "Troca de óleo"],
      ["quick-amount", "150"],
    ]) {
      tree.find((node) => node.props?.id === id).props.onChange({ target: { value } });
    }
    tree = render();
    submit(tree);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(finalized, 1);
  } finally {
    globalThis.document = previousDocument;
  }
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

test("completed orders present a professional closeout without exposing internal costs", async () => {
  const appSource = await readFile(new URL("../src/features/pilot/pilot-app.tsx", import.meta.url), "utf8");
  const summarySource = await readFile(new URL("../src/features/pilot/final-order-summary.tsx", import.meta.url), "utf8");
  const orderDetail = appSource.slice(appSource.indexOf("function OrderDetail"), appSource.indexOf("function OrderOverview"));

  assert.match(orderDetail, /OS entregue/);
  assert.match(orderDetail, /Pagamento pendente/);
  assert.match(orderDetail, /Pagamento em dia/);
  for (const label of ["OS finalizada", "Serviços realizados", "Peças utilizadas", "Total da OS", "Valor recebido", "Falta receber", "Imprimir resumo"])
    assert.match(summarySource, new RegExp(label));
  assert.match(summarySource, /window\.print\(\)/);
  assert.doesNotMatch(summarySource, /Custo interno|Garantia demonstrativa|data de referência do piloto/i);
});

test("customers screen supports operational search and preselected customer actions", async () => {
  const source = await readFile(new URL("../src/features/pilot/pilot-app.tsx", import.meta.url), "utf8");
  const customersScreen = source.slice(source.indexOf("function CustomersScreen"), source.indexOf("function VehiclesScreen"));
  const customerDetail = source.slice(source.indexOf("function CustomerDetail"), source.indexOf("function VehicleDetail"));
  const newVehicleDialog = source.slice(source.indexOf("function NewVehicleDialog"), source.indexOf("function EditVehicleDialog"));
  const newOrderDialog = source.slice(source.indexOf("function NewOrderDialog"));

  assert.match(customersScreen, /vehicle\.plate/);
  assert.match(customersScreen, /showClear/);
  assert.match(customersScreen, /Continuar OS/);
  assert.match(customersScreen, /Ver cliente/);
  assert.match(customersScreen, /Nova OS/);
  assert.match(customerDetail, /Veículos deste cliente/);
  assert.match(customerDetail, /Novo veículo/);
  assert.match(customerDetail, /Histórico de OS/);
  assert.match(customerDetail, /onNewOrderForVehicle\(vehicle\.id\)/);
  assert.match(newVehicleDialog, /initialCustomerId\?: string/);
  assert.match(newVehicleDialog, /setCustomerId\(initialCustomerId\)/);
  assert.match(newOrderDialog, /initialCustomerId\?: string/);
  assert.match(newOrderDialog, /setCustomerId\(initialCustomer\.id\)/);
});

test("customer and vehicle operational views never treat cancelled or delivered orders as active", async () => {
  const source = await readFile(new URL("../src/features/pilot/pilot-app.tsx", import.meta.url), "utf8");
  const customersScreen = source.slice(source.indexOf("function CustomersScreen"), source.indexOf("function VehiclesScreen"));
  const vehiclesScreen = source.slice(source.indexOf("function VehiclesScreen"), source.indexOf("function OrdersScreen"));
  const customerDetail = source.slice(source.indexOf("function CustomerDetail"), source.indexOf("function VehicleDetail"));
  const activeCondition = /!isOrderCancelled\(order\)\s*&&\s*order\.status !== "Entregue"/g;

  assert.equal(customersScreen.match(activeCondition)?.length, 1);
  assert.equal(vehiclesScreen.match(activeCondition)?.length, 2);
  assert.equal(customerDetail.match(activeCondition)?.length, 2);
});

test("customer and vehicle destructive actions reuse their existing visual permissions", async () => {
  const source = await readFile(new URL("../src/features/pilot/pilot-app.tsx", import.meta.url), "utf8");
  const customerDetail = source.slice(source.indexOf("function CustomerDetail"), source.indexOf("function VehicleDetail"));
  const vehicleDetail = source.slice(source.indexOf("function VehicleDetail"), source.indexOf("function OrderTeamAssignment"));

  assert.match(customerDetail, /const canEditCustomer =[\s\S]*?accessLevel === "staff"/);
  assert.match(customerDetail, /\{canEditCustomer && \([\s\S]*?Excluir cliente/);
  assert.equal(vehicleDetail.match(/\{canEditVehicle && \(/g)?.length, 3);
  assert.match(vehicleDetail, /\{canEditVehicle && \(\s*<Button[\s\S]*?Excluir veículo/);
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

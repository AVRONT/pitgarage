import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

async function repository(supabase = {}) {
  const source = await readFile(new URL("../src/features/pilot/operational-repository.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source.replaceAll("import.meta.env.DEV", "true"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((name) => name.includes("supabase/client") ? { supabase } : {}, exports);
  return exports.createOperationalRepository;
}

const customer = { id: "00000000-0000-4000-8000-000000000002", name: "Ana", phone: "11999999999", email: "", since: "2026" };
const vehicle = { id: "00000000-0000-4000-8000-000000000003", customerId: customer.id, kind: "Carro", brand: "Fiat", model: "Uno", year: 2020, plate: "ABC1D23", mileage: 100, color: "Branco" };

test("standalone directory records survive a repository reload and are usable by an OS without duplicates", async (t) => {
  const previous = { storage: globalThis.localStorage, window: globalThis.window };
  t.after(() => { globalThis.localStorage = previous.storage; globalThis.window = previous.window; });
  const storage = new Map();
  globalThis.window = { location: { hostname: "localhost" } };
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const create = await repository();
  const first = create(true);
  assert.equal(typeof first.createCustomer, "function", "repository must persist standalone customers");
  const savedCustomer = await first.createCustomer(customer);
  const savedVehicle = await first.createVehicle(vehicle);
  assert.match(savedCustomer.id, /^[0-9a-f-]{36}$/);
  assert.equal(savedVehicle.customerId, savedCustomer.id);
  await first.createCustomer(customer);
  await first.createVehicle(vehicle);
  await assert.rejects(first.createCustomer({ ...customer, id: crypto.randomUUID() }), /cadastrado/);
  await assert.rejects(first.createVehicle({ ...vehicle, id: crypto.randomUUID() }), /cadastrado/);
  const reloaded = create(true);
  assert.deepEqual(await reloaded.load(), { customers: [customer], vehicles: [vehicle], orders: [] });
  const data = await reloaded.createOrder({ order: { customerId: savedCustomer.id, vehicleId: savedVehicle.id, status: "Recebido", budget: [] } });
  assert.equal(data.orders[0].customerId, customer.id);
  assert.equal(data.orders[0].vehicleId, vehicle.id);
  assert.equal(data.customers.length, 1);
  assert.equal(data.vehicles.length, 1);
});

test("directory dialogs await saving, lock duplicate submissions and retain draft/UUID after failure", async () => {
  const source = await readFile(new URL("../src/features/pilot/pilot-app.tsx", import.meta.url), "utf8");
  const validationSource = await readFile(new URL("../src/features/pilot/pilot-validation.ts", import.meta.url), "utf8");
  const validation = {};
  new Function("exports", ts.transpileModule(validationSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(validation);
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const text = (node) => node == null || typeof node === "boolean" ? "" : Array.isArray(node) ? node.map(text).join("") : typeof node === "object" ? text(node.props?.children) : String(node);
  for (const [name, end, values] of [
    ["NewCustomerDialog", "NewVehicleDialog", ["Ana", "11999999999", "", ""]],
    ["NewVehicleDialog", "EditVehicleDialog", ["ABC1D23", "Fiat", "Uno", "2020", "100", "Branco"]],
  ]) {
    let cursor = 0;
    const slots = [];
    const effects = [];
    const bindings = {
      ...validation,
      useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
      useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
      useEffect(effect, deps) { const i = cursor++; if (!slots[i] || deps.some((value, n) => value !== slots[i][n])) { slots[i] = deps; effects.push(effect); } },
      ...Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogTitle", "Button", "Input"].map(key => [key, key === "Input" ? "input" : key === "Button" ? "button" : key])),
    };
    const componentSource = "export " + source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${end}(`));
    const compiled = ts.transpileModule(componentSource, { fileName: "dialog.tsx", compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const exports = {};
    new Function("require", "exports", ...Object.keys(bindings), compiled)(() => jsx, exports, ...Object.values(bindings));
    let rejectSave;
    const submitted = [];
    let closed = false;
    let shouldFail = true;
    const props = { open: true, customers: [customer], vehicles: [], onExisting() {}, onOpenChange() { closed = true; },
      onCreate: async draft => { submitted.push(draft); if (shouldFail) await new Promise((_, reject) => { rejectSave = reject; }); },
    };
    if (name === "NewCustomerDialog") props.customers = [];
    else {
      props.customers = [{ ...customer, id: crypto.randomUUID(), name: "Outro cliente" }, customer];
      props.initialCustomerId = customer.id;
    }
    const render = () => { cursor = 0; const tree = nodes(exports[name](props)); effects.splice(0).forEach(effect => effect()); return tree; };
    let tree = render();
    tree.filter(node => node.type === "input").forEach((node, index) => node.props.onChange({ target: { value: values[index] } }));
    tree = render();
    const submit = tree.find(node => node.type === "form").props.onSubmit;
    const pending = submit({ preventDefault() {} });
    await submit({ preventDefault() {} });
    assert.equal(submitted.length, 1);
    if (name === "NewVehicleDialog") assert.equal(submitted[0].customerId, customer.id);
    assert.match(submitted[0].id, /^[0-9a-f-]{36}$/);
    tree = render();
    assert.equal(tree.find(node => node.props.type === "submit").props.disabled, true);
    tree.find(node => node.type === "Dialog").props.onOpenChange(false);
    assert.equal(closed, false);
    rejectSave(new Error("Falha de rede")); await pending;
    tree = render();
    assert.match(text(tree), /Falha de rede/);
    assert.equal(tree.find(node => node.type === "input").props.value, values[0]);
    shouldFail = false;
    await tree.find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
    assert.equal(submitted[1].id, submitted[0].id);
    assert.equal(render().find(node => node.type === "input").props.value, "");
  }
});

test("cloud directory creation uses persisted rows and propagates failures instead of accepting a draft", async () => {
  const create = await repository({ rpc: async (name, args) => {
    if (name === "create_customer") {
      assert.deepEqual(args, { customer_data: customer });
      return { data: { ...customer, id: vehicle.id, auth_user_id: null, cpf: null, deleted_at: null }, error: null };
    }
    assert.equal(name, "create_vehicle");
    assert.deepEqual(args, { vehicle_data: vehicle });
    return { data: { ...vehicle, customer_id: customer.id, deleted_at: null }, error: null };
  } });
  const cloud = create(false);
  assert.equal(typeof cloud.createCustomer, "function");
  assert.equal((await cloud.createCustomer(customer)).id, vehicle.id);
  assert.equal((await cloud.createVehicle(vehicle)).customerId, customer.id);
  const failing = (await repository({ rpc: async () => ({ data: null, error: { code: "23505" } }) }))(false);
  await assert.rejects(failing.createCustomer(customer), /cadastrado/);
  await assert.rejects(failing.createVehicle(vehicle), /cadastrado/);
});

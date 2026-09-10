import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
async function load(name, mocks = {}) {
  const source = await readFile(new URL("../src/features/pilot/" + name, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  new Function("require", "exports", outputText)(
    (id) => (id in mocks ? mocks[id] : require(id)),
    exports,
  );
  return exports;
}
const orderId = "11111111-1111-4111-8111-111111111111";
const path = orderId + "/e-22222222-2222-4222-8222-222222222222.jpg";
const legacy = { id: "old", kind: "Foto", name: "legado.jpg", caption: "Registro" };
const real = { ...legacy, id: "new", path, mimeType: "image/jpeg", size: 123 };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

async function storage(api = {}) {
  return load("evidence-storage.ts", {
    "@/integrations/supabase/client": {
      supabase: {
        storage: {
          from(bucket) {
            assert.equal(bucket, "os-evidence");
            return api;
          },
        },
      },
    },
  });
}
test("upload validates MIME, size and OS before sending; private path and no upsert", async () => {
  const sent = [];
  const api = await storage({
    upload: async (...args) => {
      sent.push(args);
      return { error: null };
    },
  });
  for (const file of [
    { name: "x.svg", type: "image/svg+xml", size: 10 },
    { name: "x.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 },
    { name: "x.jpg", type: "image/jpeg", size: 0 },
  ])
    await assert.rejects(api.uploadEvidenceFile(orderId, "Foto", file));
  await assert.rejects(
    api.uploadEvidenceFile("OS-1", "Foto", { name: "x.jpg", type: "image/jpeg", size: 10 }),
  );
  assert.equal(sent.length, 0);
  for (const [kind, type, size] of [
    ["Foto", "image/jpeg", 10 * 1024 * 1024],
    ["Vídeo", "video/quicktime", 50 * 1024 * 1024],
  ]) {
    const evidence = await api.uploadEvidenceFile(orderId, kind, { name: "file", type, size });
    assert.ok(evidence.path.startsWith(orderId + "/e-"));
    assert.equal(evidence.size, size);
    assert.equal(evidence.url, undefined);
  }
  assert.equal(sent.length, 2);
  assert.equal(sent[0][2].upsert, false);
  assert.ok(api.validateEvidenceFile("Vídeo", { type: "video/mp4", size: 50 * 1024 * 1024 + 1 }));
});
test("upload failure returns no evidence; URL is temporary and failed signing is neutral", async () => {
  const api = await storage({
    upload: async () => ({ error: new Error("denied") }),
    createSignedUrl: async (value, expiry) => {
      assert.equal(value, path);
      assert.equal(expiry, 3600);
      return { data: { signedUrl: "temporary" }, error: null };
    },
  });
  await assert.rejects(
    api.uploadEvidenceFile(orderId, "Foto", { name: "x.jpg", type: "image/jpeg", size: 123 }),
  );
  assert.equal(await api.createEvidenceUrl(path), "temporary");
  assert.equal(
    await (
      await storage({ createSignedUrl: async () => ({ error: "denied" }) })
    ).createEvidenceUrl(path),
    null,
  );
});
test("delete saves OS first, never deletes on save failure or wrong folder", async () => {
  const calls = [];
  const api = await storage({
    remove: async () => {
      calls.push("storage");
      return { data: [{}], error: null };
    },
  });
  await assert.rejects(
    api.deleteEvidence(real, orderId, async () => {
      throw new Error("conflict");
    }),
  );
  await assert.rejects(api.deleteEvidence(real, "another-order", async () => calls.push("save")));
  assert.deepEqual(calls, []);
  assert.equal(
    await api.deleteEvidence(real, orderId, async () => {
      calls.push("save");
    }),
    true,
  );
  assert.deepEqual(calls, ["save", "storage"]);
});
test("legacy and shared references do not delete media; cleanup failure is reported", async () => {
  let removed = 0;
  const api = await storage({
    remove: async () => {
      removed++;
      return { data: [], error: null };
    },
  });
  assert.equal(await api.deleteEvidence(legacy, undefined, async () => {}), true);
  assert.equal(await api.deleteEvidence(real, orderId, async () => false), true);
  assert.equal(removed, 0);
  assert.equal(await api.deleteEvidence(real, orderId, async () => {}), false);
  assert.equal(removed, 1);
  await assert.rejects(api.removeEvidenceFile(path));
});
test("backup roundtrip preserves real and legacy evidence and rejects invalid metadata", async () => {
  const workshop = { name: "Oficina" };
  const api = await load("pilot-storage.ts", {
    "./workshop-data": { defaultWorkshop: workshop, workshopStorageKey: "test" },
  });
  const data = {
    customers: [{ id: "c", name: "Cliente", phone: "", email: "", since: "2026" }],
    vehicles: [
      {
        id: "v",
        customerId: "c",
        kind: "Carro",
        brand: "",
        model: "",
        plate: "",
        color: "",
        year: 2026,
        mileage: 0,
      },
    ],
    orders: [
      {
        id: "os",
        customerId: "c",
        vehicleId: "v",
        status: "Recebido",
        openedAt: "2026-09-10",
        complaint: "",
        diagnosis: "",
        findings: "",
        notes: "",
        entryMileage: 0,
        team: [],
        budget: [],
        evidence: [legacy, real],
      },
    ],
  };
  const json = JSON.stringify(api.createBackup(data, workshop));
  assert.deepEqual(api.parseBackup(json).data.orders[0].evidence, [legacy, real]);
  for (const invalid of [{ path: "https://public/file.jpg" }, { size: -1 }, { mimeType: 123 }]) {
    const parsed = JSON.parse(json);
    Object.assign(parsed.data.orders[0].evidence[1], invalid);
    assert.throws(() => api.parseBackup(JSON.stringify(parsed)));
  }
});

// Exercise actual event handlers with isolated React hooks and mocked I/O, without cloud.
async function panel(storageMock, save) {
  let cursor = 0;
  const slots = [];
  const react = {
    useRef(value) {
      const index = cursor++;
      return (slots[index] ??= { current: value });
    },
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    useEffect() {},
  };
  const module = await load("order-evidence.tsx", {
    react,
    "lucide-react": { ImagePlus: "icon", Video: "icon" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/card": { Card: "section", CardContent: "div" },
    "@/features/auth/auth-context": {
      useAuth: () => ({ isLocalBypass: false, accessLevel: "staff", profile: { is_active: true } }),
    },
    "./evidence-storage": {
      evidenceAccept: { Foto: "image/jpeg", Vídeo: "video/mp4" },
      ...storageMock,
    },
  });
  const order = { databaseId: orderId, evidence: [] };
  const render = () => {
    cursor = 0;
    return module.OrderEvidence({ order, save, notify() {} });
  };
  function nodes(tree) {
    if (!tree || typeof tree !== "object") return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    return [tree, ...nodes(tree.props?.children)];
  }
  return { render, nodes, order, module };
}
test("double selection uploads once; OS is unchanged until upload and save succeed", async () => {
  const uploaded = deferred(),
    saved = deferred();
  let uploads = 0,
    saves = 0;
  const ui = await panel(
    {
      uploadEvidenceFile: () => {
        uploads++;
        return uploaded.promise;
      },
    },
    async (change) => {
      saves++;
      await saved.promise;
      ui.order.evidence = change(ui.order.evidence);
    },
  );
  const input = ui.nodes(ui.render()).find((node) => node.type === "input");
  const event = () => ({
    target: { files: [{ name: "x.jpg", type: "image/jpeg", size: 123 }], value: "x" },
  });
  input.props.onChange(event());
  input.props.onChange(event());
  assert.equal(uploads, 1);
  assert.equal(saves, 0);
  assert.equal(ui.order.evidence.length, 0);
  uploaded.resolve(real);
  await tick();
  assert.equal(saves, 1);
  assert.equal(ui.order.evidence.length, 0);
  saved.resolve();
  await tick();
  assert.deepEqual(ui.order.evidence, [real]);
});
test("failed association retries the uploaded reference, without another upload or duplicate", async () => {
  let uploads = 0,
    attempts = 0;
  const ui = await panel(
    {
      uploadEvidenceFile: async () => {
        uploads++;
        return real;
      },
    },
    async (change) => {
      if (++attempts === 1) throw new Error("save failed");
      ui.order.evidence = change(ui.order.evidence);
    },
  );
  ui.nodes(ui.render())
    .find((node) => node.type === "input")
    .props.onChange({ target: { files: [{ name: "x.jpg" }], value: "" } });
  await tick();
  assert.equal(ui.order.evidence.length, 0);
  const retry = ui
    .nodes(ui.render())
    .find((node) => node.props?.children === "Tentar salvar referência");
  retry.props.onClick();
  retry.props.onClick();
  await tick();
  assert.equal(uploads, 1);
  assert.equal(attempts, 2);
  assert.deepEqual(ui.order.evidence, [real]);
});
test("legacy media renders a neutral fallback without requesting Storage", async () => {
  const ui = await panel(
    {
      createEvidenceUrl: () => {
        throw new Error("unexpected request");
      },
    },
    async () => {},
  );
  const rendered = ui.module.EvidenceMedia({ evidence: legacy });
  assert.equal(rendered.props.children, "Registro antigo · sem arquivo anexado");
});

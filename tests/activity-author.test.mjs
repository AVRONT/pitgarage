import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
async function load(name, mocks = {}) {
  const source = await readFile(new URL("../src/features/pilot/" + name, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { fileName: name, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const exports = {};
  new Function("require", "exports", outputText)(id => id in mocks ? mocks[id] : require(id), exports);
  return exports;
}
const id = "76738073-4d90-49cd-88fe-7f4d9f882261";
const authors = await load("activity-author.ts", {
  "@/integrations/supabase/client": { supabase: {} },
  "@/features/auth/auth-context": {},
});

test("snapshot keeps the name at action time, with UUID untouched after JSON reload", () => {
  for (const newAmount of [60, 50, 0]) {
    const event = JSON.parse(JSON.stringify({ recordedBy: id, actorName: "Salomão", newAmount }));
    assert.equal(authors.activityAuthorName(event, { [id]: "Nome atual" }), "Salomão");
    assert.equal(event.recordedBy, id);
  }
});
test("legacy UUID resolves to current profile, unknown/inactive/blank falls back without raw UUID", () => {
  assert.equal(authors.activityAuthorName({ recordedBy: id }, { [id]: "Suporte PitGarage" }), "Suporte PitGarage");
  for (const event of [{ recordedBy: id }, { recordedBy: "" }, {}, { recordedBy: id, actorName: id }, { recordedBy: id, actorName: {} }])
    assert.equal(authors.activityAuthorName(event), "Usuário interno");
  assert.equal(authors.activityAuthorName({ recordedBy: id }, { [id]: " " }), "Usuário interno");
});
test("legacy lookup reuses the existing internal directory RPC and fails safely", async () => {
  let fail = false;
  const api = await load("activity-author.ts", {
    "@/features/auth/auth-context": {},
    "@/integrations/supabase/client": { supabase: { async rpc(name) {
      assert.equal(name, "list_assignable_members");
      return fail ? { data: null, error: new Error("denied") } : { data: [
        { user_id: id, full_name: " Abraão ", operational_role: null },
        { user_id: "other", full_name: null, operational_role: null },
      ], error: null };
    } } },
  });
  assert.deepEqual(await api.loadActivityAuthors(), { [id]: "Abraão" });
  fail = true;
  assert.deepEqual(await api.loadActivityAuthors(), {});
});

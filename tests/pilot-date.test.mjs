import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/pilot/pilot-data.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { formatDate, formatDateTime, warrantyDeadline } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);

test("invalid or absent historical dates render a safe fallback", () => {
  for (const value of [undefined, null, "", "not-a-date"]) {
    assert.equal(formatDateTime(value), "—");
    assert.equal(formatDate(value), "—");
  }
});

test("invalid legacy completion date does not create an Invalid Date warranty", () => {
  assert.equal(warrantyDeadline({ completedAt: "not-a-date" }), null);
});

test("valid ISO and legacy date values remain visible", () => {
  assert.notEqual(formatDateTime("2026-09-16T14:30:00Z"), "—");
  assert.equal(formatDate("2026-09-16"), "16/09/2026");
  assert.equal(formatDate("2026-09-16T14:30:00Z"), "16/09/2026");
});

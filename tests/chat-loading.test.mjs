import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (
  await readFile(new URL("../src/features/platform/chat-widget.tsx", import.meta.url), "utf8")
).replace(/\r\n/g, "\n");
const start = source.indexOf("  useEffect(() => {\n    if (!activeId) return;");
const end = source.indexOf("  }, [activeId]);", start);
assert.ok(start >= 0 && end > start);
const effect = source.slice(start, end + "  }, [activeId]);".length);
const code = ts.transpileModule(effect, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const run = new Function(
  "useEffect",
  "activeId",
  "platformApi",
  "setLoadingMessages",
  "setError",
  "setMessages",
  code,
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

for (const fail of [false, true]) {
  test(
    "obsolete chat " + (fail ? "error" : "response") + " cannot affect the new conversation",
    async () => {
      const old = deferred(),
        latest = deferred();
      let messages = [],
        error = "",
        loading = false,
        cleanup;
      const mount = (id) =>
        run(
          (fn) => {
            cleanup = fn();
          },
          id,
          { messages: (value) => (value === "A" ? old.promise : latest.promise) },
          (value) => {
            loading = value;
          },
          (value) => {
            error = value;
          },
          (value) => {
            messages = value;
          },
        );
      mount("A");
      cleanup();
      mount("B");
      if (fail) old.reject(new Error("old"));
      else old.resolve(["A"]);
      await tick();
      assert.deepEqual(messages, []);
      assert.equal(error, "");
      assert.equal(loading, true);
      latest.resolve(["B"]);
      await tick();
      assert.deepEqual(messages, ["B"]);
      assert.equal(loading, false);
      cleanup();
    },
  );
}
test("chat response after unmount does not update state", async () => {
  const request = deferred();
  let cleanup,
    updates = 0;
  run(
    (fn) => {
      cleanup = fn();
    },
    "A",
    { messages: () => request.promise },
    () => {
      updates++;
    },
    () => {
      updates++;
    },
    () => {
      updates++;
    },
  );
  cleanup();
  const initial = updates;
  request.resolve(["late"]);
  await tick();
  assert.equal(updates, initial);
});

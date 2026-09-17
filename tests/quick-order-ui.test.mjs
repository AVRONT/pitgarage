import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

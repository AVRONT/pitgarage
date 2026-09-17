# Resultado financeiro real Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar venda, bruto recebido, custo direto, taxa, entrada líquida e resultado, com correção auditada após entrega.

**Architecture:** Estender receipts JSON e a tabela privada de custos existentes. Centralizar validações críticas em RPCs PostgreSQL, manter contas a receber pelo bruto e projetar os novos totais no relatório financeiro.

**Tech Stack:** React 19, TypeScript, Supabase/PostgreSQL, PGlite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-17-financial-real-result-design.md`

## Global Constraints

- PIX e Dinheiro aceitam somente taxa zero; Cartão aceita taxa entre zero e bruto.
- Não criar segundo sistema financeiro.
- Não aplicar migration remota, usar Lovable, fazer commit ou push.
- Customer e staff sem permissão financeira nunca veem custo, taxa, líquido ou resultado.

---

### Task 1: Cálculos e tipos compatíveis

**Files:** Modify `tests/financial-extensions.test.mjs`, `src/features/pilot/payment-model.ts`, `src/features/pilot/financial-model.ts`, `src/features/pilot/pilot-data.ts`.

**Interfaces:** `ReceiptInput.feeAmount`, `receiptAmounts()`, `paymentSummary()` com `fees/netReceived`, relatório com `paid/fees/netReceived`.

- [ ] Escrever testes falhando para legado, PIX/Dinheiro, Cartão, parcial e misto.
- [ ] Executar os testes e confirmar falha pela ausência dos campos/cálculos.
- [ ] Implementar tipos e cálculos mínimos.
- [ ] Executar novamente e confirmar aprovação.

### Task 2: Migration, RPCs, RLS e auditoria

**Files:** Create `supabase/migrations/20260917040000_financial_real_result.sql`; create `tests/financial-real-result-db.test.mjs`.

**Interfaces:** `record_order_payment` aceita `feeAmount`; `correct_order_financial(uuid,timestamptz,uuid,text,jsonb,text)` corrige receipt/desconto/custo; `financial_order_report` projeta recebimentos; auditoria privada guarda antes/depois e autor.

- [ ] Escrever fixture PostgreSQL e casos falhando para regras, permissões, compatibilidade, correções e idempotência.
- [ ] Executar contra PGlite e confirmar falha sem a migration.
- [ ] Implementar migration transacional sem expor dados internos.
- [ ] Executar testes PostgreSQL e confirmar aprovação.

### Task 3: Repository e fluxos de criação

**Files:** Modify `src/features/pilot/operational-repository.ts`, `src/features/pilot/quick-order-model.ts`, `tests/quick-order.test.mjs`.

**Interfaces:** drafts levam custo e taxa; criação quick/standard preserva os valores; repository expõe correção financeira.

- [ ] Escrever testes falhando dos payloads e compatibilidade local.
- [ ] Implementar o menor mapeamento necessário.
- [ ] Executar testes direcionados.

### Task 4: UX operacional e Financeiro

**Files:** Modify `src/features/pilot/order-payments.tsx`, `src/features/pilot/quick-order-dialog.tsx`, `src/features/pilot/financial-screen.tsx`, `src/features/pilot/pilot-app.tsx`; create `src/features/pilot/financial-correction.tsx`.

**Interfaces:** taxa progressiva para Cartão, líquido calculado, custo protegido, modal “Corrigir financeiro”.

- [ ] Escrever testes de componente falhando para progressive disclosure, permissões e correção.
- [ ] Implementar sem wizard nem duplicação de cálculo.
- [ ] Executar testes de UI direcionados.

### Task 5: Backup, documentação e verificação

**Files:** Modify `docs/17-financeiro-backup.md`, `docs/AI_CONTEXT.md`, `CHANGELOG.md`, tipos Supabase e testes de backup.

- [ ] Testar preservação de novos campos e defaults legados.
- [ ] Atualizar projeção de backup/tipos/documentação.
- [ ] Rodar testes direcionados e PostgreSQL/PGlite.
- [ ] Rodar `npx tsc --noEmit`, `npm run build` e `git diff --check`.

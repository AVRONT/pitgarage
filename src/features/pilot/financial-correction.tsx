import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ServiceOrder } from "./pilot-data";
import type { SavePart } from "./financial-api";

type CorrectionType = "receipt" | "discount" | "cost";
const saveConfirmationTimeout = 20_000;

const money = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "Não informado"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FinancialCorrection({ order, save }: { order: ServiceOrder; save: SavePart }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CorrectionType>("receipt");
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"PIX" | "Cartão" | "Dinheiro">("PIX");
  const [fee, setFee] = useState("0");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saveLock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const receipts = order.payment?.receipts ?? [];
  const selectedReceipt = receipts.find((item) => item.id === target);
  const selectedItem = order.budget.find((item) => item.id === target);
  const currentValue =
    type === "receipt"
      ? selectedReceipt?.amount
      : type === "discount"
        ? order.discountAmount ?? 0
        : selectedItem?.cost;

  const payload = useMemo<Record<string, unknown>>(() => {
    if (type === "receipt")
      return {
        receiptId: target,
        amount: Number(amount),
        method,
        feeAmount: method === "Cartão" ? Number(fee) : 0,
      };
    if (type === "discount")
      return { amount: Number(amount), discountReason: order.discountReason ?? "" };
    return { itemId: target, unitCost: amount === "" ? null : Number(amount) };
  }, [type, target, amount, method, fee, order.discountReason]);

  const selectReceipt = (receiptId: string) => {
    const receipt = receipts.find((item) => item.id === receiptId);
    setTarget(receiptId);
    if (!receipt) {
      setAmount("");
      return;
    }
    setAmount(String(receipt.amount));
    setMethod(receipt.method);
    setFee(String(receipt.feeAmount ?? 0));
  };

  const selectItem = (itemId: string) => {
    const item = order.budget.find((entry) => entry.id === itemId);
    setTarget(itemId);
    setAmount(item?.cost === undefined ? "" : String(item.cost));
  };

  const selectType = (nextType: CorrectionType) => {
    setType(nextType);
    setError("");
    if (nextType === "receipt") {
      selectReceipt(receipts[0]?.id ?? "");
      return;
    }
    if (nextType === "discount") {
      setTarget("");
      setAmount(String(order.discountAmount ?? 0));
      return;
    }
    selectItem(order.budget[0]?.id ?? "");
  };

  const openAdjustment = () => {
    setOpen(true);
    setReason("");
    setError("");
    selectType("receipt");
  };

  const submit = async () => {
    if (saveLock.current) return;
    if (!reason.trim()) return setError("Explique o motivo deste ajuste.");
    if (type !== "discount" && !target)
      return setError(type === "receipt" ? "Escolha um pagamento." : "Escolha um item.");
    if (type !== "cost" && amount === "") return setError("Informe o novo valor.");
    if (amount !== "" && (!Number.isFinite(Number(amount)) || Number(amount) < 0))
      return setError("Informe um novo valor válido.");
    saveLock.current = true;
    setBusy(true);
    setError("");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        save({ correction: { id: requestId.current, type, payload, reason: reason.trim() } }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(
                  "A confirmação está demorando. Recarregue a OS para conferir se o ajuste foi salvo antes de tentar novamente.",
                ),
              ),
            saveConfirmationTimeout,
          );
        }),
      ]);
      requestId.current = crypto.randomUUID();
      setOpen(false);
      setReason("");
      setAmount("");
      setTarget("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o ajuste.");
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      saveLock.current = false;
      setBusy(false);
    }
  };

  const currentLabel =
    type === "receipt"
      ? "Valor recebido atualmente"
      : type === "discount"
        ? "Desconto atual"
        : "Custo atual";
  const newValueLabel =
    type === "receipt"
      ? "Novo valor recebido"
      : type === "discount"
        ? "Novo desconto"
        : "Novo custo";

  return (
    <>
      <Button type="button" variant="outline" onClick={openAdjustment}>
        Ajustar valor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajustar valor</DialogTitle>
            <DialogDescription>
              A OS continua {order.status}. O ajuste ficará registrado no histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">O que você quer ajustar?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["receipt", "Valor recebido"],
                    ["discount", "Desconto da OS"],
                    ["cost", "Custo de um item"],
                  ] as Array<[CorrectionType, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    data-adjustment-type={value}
                    aria-pressed={type === value}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 ${
                      type === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/30 hover:bg-white"
                    }`}
                    onClick={() => selectType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            {type === "receipt" && receipts.length > 1 && (
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Qual pagamento deseja ajustar?
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={target}
                  onChange={(event) => selectReceipt(event.target.value)}
                >
                  {receipts.map((receipt) => (
                    <option key={receipt.id} value={receipt.id}>
                      {receipt.method} · {money(receipt.amount)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {type === "cost" && (
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Qual item deseja ajustar?
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={target}
                  onChange={(event) => selectItem(event.target.value)}
                >
                  {order.budget.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-500">{currentLabel}</p>
                <output
                  aria-label={currentLabel}
                  className="mt-1 block text-xl font-semibold text-slate-950 tabular-nums"
                >
                  {money(currentValue)}
                </output>
              </div>
              <label className="text-sm font-medium text-slate-700">
                {newValueLabel}
                <Input
                  aria-label={newValueLabel}
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 bg-white text-lg tabular-nums"
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Por que você está ajustando?
              <Input
                aria-label="Motivo do ajuste"
                maxLength={1000}
                placeholder="Ex.: valor informado incorretamente"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            {type === "receipt" && (
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Forma de pagamento
                <select
                  aria-label="Forma de pagamento"
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={method}
                  onChange={(event) => {
                    setMethod(event.target.value as typeof method);
                    if (event.target.value !== "Cartão") setFee("0");
                  }}
                >
                  <option>PIX</option>
                  <option>Dinheiro</option>
                  <option>Cartão</option>
                </select>
              </label>
            )}
            {type === "receipt" && method === "Cartão" && (
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Taxa cobrada pela maquininha
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fee}
                  onChange={(event) => setFee(event.target.value)}
                />
              </label>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy} onClick={() => void submit()}>
              {busy ? "Salvando…" : "Salvar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

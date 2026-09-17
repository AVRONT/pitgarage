import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ServiceOrder } from "./pilot-data";
import type { SavePart } from "./financial-api";

export function FinancialCorrection({ order, save }: { order: ServiceOrder; save: SavePart }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"receipt" | "discount" | "cost">("receipt");
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"PIX" | "Cartão" | "Dinheiro">("PIX");
  const [fee, setFee] = useState("0");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const payload = useMemo<Record<string, unknown>>(() => {
    if (type === "receipt") return { receiptId: target, amount: Number(amount), method, feeAmount: method === "Cartão" ? Number(fee) : 0 };
    if (type === "discount") return { amount: Number(amount), discountReason: order.discountReason ?? "" };
    return { itemId: target, unitCost: amount === "" ? null : Number(amount) };
  }, [type, target, amount, method, fee, order.discountReason]);
  const submit = async () => {
    if (!reason.trim()) return setError("Motivo obrigatório para corrigir o financeiro.");
    if (type !== "discount" && !target) return setError("Selecione o registro que será corrigido.");
    if (amount !== "" && !Number.isFinite(Number(amount))) return setError("Informe um valor válido.");
    setBusy(true); setError("");
    try {
      await save({ correction: { id: requestId.current, type, payload, reason: reason.trim() } });
      requestId.current = crypto.randomUUID();
      setOpen(false); setReason(""); setAmount(""); setTarget("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível corrigir o financeiro.");
    } finally { setBusy(false); }
  };
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>Corrigir financeiro</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Corrigir financeiro</DialogTitle><DialogDescription>A OS permanece {order.status}. Toda alteração exige motivo e fica auditada.</DialogDescription></DialogHeader>
      <div className="grid gap-3">
        <label className="text-sm">O que corrigir<select className="h-10 w-full rounded-md border bg-background px-3" value={type} onChange={(e) => { setType(e.target.value as typeof type); setTarget(""); }}><option value="receipt">Recebimento</option><option value="discount">Desconto</option><option value="cost">Custo interno</option></select></label>
        {type === "receipt" && <label className="text-sm">Recebimento<select className="h-10 w-full rounded-md border bg-background px-3" value={target} onChange={(e) => { const receipt = order.payment?.receipts?.find((item) => item.id === e.target.value); setTarget(e.target.value); if (receipt) { setAmount(String(receipt.amount)); setMethod(receipt.method); setFee(String(receipt.feeAmount ?? 0)); } }}><option value="">Selecione</option>{(order.payment?.receipts ?? []).map((receipt) => <option key={receipt.id} value={receipt.id}>{receipt.method} · R$ {receipt.amount.toFixed(2)}</option>)}</select></label>}
        {type === "cost" && <label className="text-sm">Item<select className="h-10 w-full rounded-md border bg-background px-3" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Selecione</option>{order.budget.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="text-sm">{type === "cost" ? "Novo custo" : type === "discount" ? "Novo desconto" : "Novo valor bruto"}<Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        {type === "receipt" && <label className="text-sm">Forma<select className="h-10 w-full rounded-md border bg-background px-3" value={method} onChange={(e) => { setMethod(e.target.value as typeof method); if (e.target.value !== "Cartão") setFee("0"); }}><option>PIX</option><option>Dinheiro</option><option>Cartão</option></select></label>}
        {type === "receipt" && method === "Cartão" && <label className="text-sm">Nova taxa<Input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} /></label>}
        <label className="text-sm">Motivo obrigatório<Input maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" disabled={busy} onClick={() => void submit()}>{busy ? "Salvando…" : "Confirmar correção"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}

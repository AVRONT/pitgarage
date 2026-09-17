import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { money, type ServiceOrder } from "./pilot-data";
import { discountBlocker, discountError, paymentSummary } from "./payment-model";
import type { SavePart } from "./financial-api";

export function OrderDiscount({ order, save, disabled, onBusyChange }: {
  order: ServiceOrder;
  save: SavePart;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const summary = paymentSummary(order);
  const blocker = discountBlocker(order);
  return <Dialog open={open} onOpenChange={value => {
    if (lock.current) return;
    if (value) {
      setAmount(String(summary.discount));
      setReason(order.discountReason ?? "");
      setError("");
      requestId.current = crypto.randomUUID();
    }
    setOpen(value);
  }}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="sm" disabled={disabled || Boolean(blocker)} title={blocker ?? undefined}>
        {summary.discount > 0 ? "Editar desconto" : "Aplicar desconto"}
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Desconto comercial</DialogTitle>
        <DialogDescription>Subtotal aprovado: {money(summary.subtotal)}. Informe zero para remover o desconto.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (lock.current || disabled) return;
        const value = Number(amount);
        const invalid = amount.trim() === "" ? "Informe o valor do desconto." : discountError(order, value);
        if (invalid) { setError(invalid); return; }
        lock.current = true;
        setBusy(true);
        onBusyChange(true);
        setError("");
        try {
          await save({ discount: { id: requestId.current, amount: value, reason } });
          setOpen(false);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : "Não foi possível confirmar o desconto. Recarregue a OS antes de tentar novamente.");
        } finally {
          lock.current = false;
          setBusy(false);
          onBusyChange(false);
        }
      }}>
        <fieldset disabled={busy || Boolean(blocker)} className="space-y-4">
          <label className="block text-sm">Valor do desconto (R$)
            <Input autoFocus required type="number" min="0" max={summary.subtotal} step="0.01" value={amount}
              onChange={event => { setAmount(event.target.value); requestId.current = crypto.randomUUID(); }} />
          </label>
          <label className="block text-sm">Motivo/observação (opcional)
            <Input maxLength={1000} value={reason}
              onChange={event => { setReason(event.target.value); requestId.current = crypto.randomUUID(); }} />
          </label>
          <Button type="submit">{busy ? "Salvando…" : "Salvar"}</Button>
        </fieldset>
        {(error || blocker) && <p role="alert" className="text-sm text-destructive">{error || blocker}</p>}
      </form>
    </DialogContent>
  </Dialog>;
}

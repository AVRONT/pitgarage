import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, money, type ServiceOrder } from "./pilot-data";
import { paymentSummary } from "./payment-model";
import type { SavePart } from "./financial-api";
import { OrderDiscount } from "./order-discount";
import { activityAuthorName, type ActivityAuthors } from "./activity-author";
import { FinancialCorrection } from "./financial-correction";

export function OrderPayments({ order, save, canEditDiscount = false, activityAuthors = {} }: { order: ServiceOrder; save: SavePart; canEditDiscount?: boolean; activityAuthors?: ActivityAuthors }) {
  const summary = paymentSummary(order);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"PIX" | "Cartão" | "Dinheiro">("PIX");
  const [date, setDate] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  );
  const [note, setNote] = useState("");
  const [fee, setFee] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const id = useRef(crypto.randomUUID());
  const [discountBusy, setDiscountBusy] = useState(false);
  return (
    <section className="rounded-lg border bg-white p-5">
      <h2 className="font-semibold">Pagamentos · {summary.status}</h2>
      <dl className="my-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Subtotal aprovado", summary.subtotal],
          ["Desconto comercial", -summary.discount],
          ["Total final", summary.total],
          ["Recebido", summary.paid],
          ["Saldo em aberto", summary.balance],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{money(Number(value))}</dd>
          </div>
        ))}
      </dl>
      {order.discountReason && <p className="mb-3 break-words text-sm text-muted-foreground">{order.discountReason}</p>}
      {canEditDiscount && <div className="mb-4">
        <OrderDiscount order={order} save={save} disabled={busy} onBusyChange={setDiscountBusy} />
      </div>}
      {canEditDiscount && (order.completedAt || ["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status)) && (
        <div className="mb-4"><FinancialCorrection order={order} save={save} /></div>
      )}
      {summary.credit > 0 && (
        <p className="text-sm">
          Recebido acima do total atual: {money(summary.credit)}. Conferir manualmente antes de
          novos ajustes.
        </p>
      )}
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current || discountBusy) return;
          const value = Number(amount);
          if (!Number.isFinite(value) || value <= 0 || value > summary.balance) {
            setError("Informe um valor positivo, até o saldo em aberto.");
            return;
          }
          lock.current = true;
          setBusy(true);
          setError("");
          try {
            const feeAmount = method === "Cartão" && canEditDiscount ? Number(fee) : 0;
            if (!Number.isFinite(feeAmount) || feeAmount < 0 || feeAmount > value) {
              setError("Informe uma taxa válida, entre zero e o valor recebido.");
              return;
            }
            await save({
              receipt: {
                id: id.current,
                amount: value,
                date: new Date(date).toISOString(),
                method,
                note,
                feeAmount,
              },
            });
            id.current = crypto.randomUUID();
            setAmount("");
            setNote("");
            setFee("0");
          } catch {
            setError(
              "Não foi possível confirmar o pagamento. Recarregue a OS antes de tentar novamente; os campos foram mantidos.",
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset
          disabled={busy || discountBusy || Boolean(order.cancelledAt)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm">
            Valor recebido
            <Input
              required
              type="number"
              min="0.01"
              max={summary.balance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Data/hora
            <Input
              required
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Forma
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
            >
              <option>PIX</option>
              <option>Cartão</option>
              <option>Dinheiro</option>
            </select>
          </label>
          <label className="text-sm">
            Observação (opcional)
            <Input maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {canEditDiscount && method === "Cartão" && (
            <label className="text-sm">
              Taxa do cartão
              <Input type="number" min="0" max={amount || undefined} step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
              <span className="mt-1 block text-xs text-muted-foreground">
                Líquido: {money(Math.max(0, Number(amount || 0) - Number(fee || 0)))}
              </span>
            </label>
          )}
          <Button disabled={summary.balance <= 0}>
            {busy ? "Registrando…" : "Registrar recebimento"}
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      <ul className="mt-4 space-y-2 text-sm">
        {order.payment?.receipts?.map((p) => (
          <li className="border-t pt-2" key={p.id}>
            {money(p.amount)} · {p.method} · {formatDateTime(p.date)}
            {canEditDiscount && (
              <span className="block text-xs text-muted-foreground">
                Taxa: {money(p.feeAmount ?? 0)} · Líquido: {money(p.netAmount ?? p.amount - (p.feeAmount ?? 0))}
              </span>
            )}
            <span className="block text-xs text-muted-foreground">
              Registrado por: {activityAuthorName(p, activityAuthors)} {p.note && " · " + p.note}
            </span>
          </li>
        ))}
      </ul>
      {!order.payment?.receipts && order.payment && (
        <p className="mt-3 text-sm">
          Registro anterior preservado: {money(order.payment.amount)} · {order.payment.method} ·{" "}
          {order.payment.status}
        </p>
      )}
    </section>
  );
}

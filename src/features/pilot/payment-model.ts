import type { ServiceOrder } from "./pilot-data";
import { roundMoney } from "./financial-model";
export interface ReceiptInput {
  id: string;
  amount: number;
  date: string;
  method: "PIX" | "Cartão" | "Dinheiro";
  note: string;
}
export interface Receipt extends ReceiptInput {
  recordedBy: string;
}
export function receiptDay(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export interface DiscountInput {
  id: string;
  amount: number;
  reason: string;
}
export function discountBlocker(order: ServiceOrder): string | null {
  if (order.cancelledAt) return "Esta OS está cancelada: o desconto é somente leitura.";
  if (order.completedAt || ["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status))
    return "Esta OS já foi concluída ou entregue: o desconto é somente leitura.";
  return null;
}
export function discountError(order: ServiceOrder, amount: number): string | null {
  const blocker = discountBlocker(order);
  if (blocker) return blocker;
  if (!Number.isFinite(amount) || amount < 0 || amount !== roundMoney(amount))
    return "Informe um desconto não negativo, em reais e centavos.";
  const { subtotal, paid } = paymentSummary(order);
  if (amount > subtotal) return "O desconto não pode ser maior que o subtotal aprovado.";
  if (roundMoney(subtotal - amount) < paid)
    return "O desconto deixaria o valor final abaixo do valor já recebido. Trate o crédito/estorno antes.";
  return null;
}
export function paymentSummary(order: Pick<ServiceOrder, "budget" | "payment" | "discountAmount">) {
  const subtotal = roundMoney(
    order.budget.filter((i) => i.approval === "Aprovado").reduce((n, i) => n + i.price, 0),
  );
  const discount = order.discountAmount ?? 0;
  const total = roundMoney(subtotal - discount);
  const paid = roundMoney(
    order.payment?.receipts
      ? order.payment.receipts.reduce((n, p) => n + p.amount, 0)
      : order.payment?.status === "Pago"
        ? order.payment.amount
        : 0,
  );
  const balance = roundMoney(Math.max(0, total - paid));
  return {
    subtotal,
    discount,
    total,
    paid,
    balance,
    credit: roundMoney(Math.max(0, paid - total)),
    status: balance === 0 ? "Pago" : paid > 0 ? "Parcial" : "Em aberto",
  };
}
export function customerDebts(orders: ServiceOrder[], customerId: string) {
  const debts = orders
    .filter((o) => o.customerId === customerId && !o.cancelledAt)
    .map((order) => ({ order, ...paymentSummary(order) }))
    .filter((o) => o.balance > 0);
  return { debts, balance: roundMoney(debts.reduce((n, o) => n + o.balance, 0)) };
}

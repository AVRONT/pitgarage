import type { ServiceOrder } from "./pilot-data";
import { roundMoney } from "./financial-model";
export interface ReceiptInput {
  id: string;
  amount: number;
  date: string;
  method: "PIX" | "Cartão";
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
export function paymentSummary(order: Pick<ServiceOrder, "budget" | "payment">) {
  const total = roundMoney(
    order.budget.filter((i) => i.approval === "Aprovado").reduce((n, i) => n + i.price, 0),
  );
  const paid = roundMoney(
    order.payment?.receipts
      ? order.payment.receipts.reduce((n, p) => n + p.amount, 0)
      : order.payment?.status === "Pago"
        ? order.payment.amount
        : 0,
  );
  const balance = roundMoney(Math.max(0, total - paid));
  return {
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

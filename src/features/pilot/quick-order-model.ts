import type { BudgetItem, Customer, Payment, ServiceOrder, Vehicle } from "./pilot-data";

export type PaymentMethod = Payment["method"];

export interface QuickOrderPart {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
}

export interface QuickOrderDraft {
  requestId: string;
  customerId?: string;
  newCustomer?: Pick<Customer, "name" | "phone"> & Partial<Pick<Customer, "cpf" | "email">>;
  vehicleId?: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  service: string;
  amount: number;
  discountAmount: number;
  discountReason: string;
  receivedAmount: number;
  paymentMethod?: PaymentMethod;
  internalCost?: number;
  parts: QuickOrderPart[];
  cardFee: number;
  warrantyDays: number;
}

export const quickPaymentError = (
  receivedAmount: number,
  method: string | undefined,
  total: number,
  fee = 0,
) => {
  if (!Number.isFinite(receivedAmount) || receivedAmount < 0)
    return "Informe um valor recebido válido.";
  if (receivedAmount > total) return "O valor recebido não pode exceder o total final.";
  if (receivedAmount > 0 && !["Dinheiro", "PIX", "Cartão"].includes(method ?? ""))
    return "Selecione a forma de pagamento.";
  if (!Number.isFinite(fee) || fee < 0 || fee > receivedAmount)
    return "Informe uma taxa válida, entre zero e o valor recebido.";
  if ((method === "PIX" || method === "Dinheiro") && fee !== 0)
    return "PIX e Dinheiro aceitam somente taxa zero.";
  return null;
};

export const quickServiceDescription = (service: string, rescue?: { pickup: string; destination: string; note: string }) =>
  [service.trim(),
    ...(rescue?.pickup.trim() ? [`Retirada: ${rescue.pickup.trim()}`] : []),
    ...(rescue?.destination.trim() ? [`Destino: ${rescue.destination.trim()}`] : []),
    ...(rescue?.note.trim() ? [`Observação: ${rescue.note.trim()}`] : []),
  ].join("\n");

export const quickPaymentStatus = (total: number, received: number) =>
  total > 0 && Math.max(0, total - received) === 0 ? "Pago" : received > 0 ? "Parcial" : "Em aberto";

export const quickOrderBudgetItem = (service: string, amount: number, requestId: string): BudgetItem => ({
  id: `quick-${requestId}`,
  type: "Serviço",
  name: service.trim(),
  price: amount,
  approval: "Aprovado",
  executed: true,
});

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const quickOrderSubtotal = (serviceAmount: number, parts: QuickOrderPart[]) =>
  roundMoney(serviceAmount + parts.reduce((sum, part) => sum + roundMoney(part.quantity * part.unitPrice), 0));

export const quickOrderBudgetItems = (
  service: string,
  amount: number,
  requestId: string,
  parts: QuickOrderPart[],
): BudgetItem[] => [
  quickOrderBudgetItem(service, amount, requestId),
  ...parts.map((part) => ({
    id: part.id,
    type: "Peça" as const,
    name: part.name.trim(),
    quantity: part.quantity,
    unitPrice: part.unitPrice,
    price: roundMoney(part.quantity * part.unitPrice),
    approval: "Aprovado" as const,
    executed: true,
  })),
];

export const orderFlowType = (order: Pick<ServiceOrder, "flowType">) =>
  order.flowType === "quick" ? "quick" : "standard";

export const orderVehicleLabel = (
  order: Pick<ServiceOrder, "quickVehicleBrand" | "quickVehicleModel" | "quickVehicleYear">,
  vehicle?: Pick<Vehicle, "brand" | "model" | "year" | "plate">,
) => {
  if (vehicle)
    return `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` · ${vehicle.year}` : ""}${vehicle.plate ? ` · ${vehicle.plate}` : ""}`;
  const identity = [order.quickVehicleBrand, order.quickVehicleModel].filter(Boolean).join(" ");
  return `${identity}${order.quickVehicleYear ? ` · ${order.quickVehicleYear}` : ""}`.trim();
};

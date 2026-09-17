import type { BudgetItem, Customer, Payment, ServiceOrder, Vehicle } from "./pilot-data";

export type PaymentMethod = Payment["method"];

export interface QuickOrderDraft {
  requestId: string;
  customerId?: string;
  newCustomer?: Pick<Customer, "name" | "phone" | "cpf">;
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
  warrantyDays: number;
}

export const quickPaymentError = (
  receivedAmount: number,
  method: string | undefined,
  total: number,
) => {
  if (!Number.isFinite(receivedAmount) || receivedAmount < 0)
    return "Informe um valor recebido válido.";
  if (receivedAmount > total) return "O valor recebido não pode exceder o total final.";
  if (receivedAmount > 0 && !["Dinheiro", "PIX", "Cartão"].includes(method ?? ""))
    return "Selecione a forma de pagamento.";
  return null;
};

export const quickOrderBudgetItem = (service: string, amount: number, requestId: string): BudgetItem => ({
  id: `quick-${requestId}`,
  type: "Serviço",
  name: service.trim(),
  price: amount,
  approval: "Aprovado",
  executed: true,
});

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

import type { ServiceOrder, Vehicle } from "./pilot-data";

export function historyTimestamp(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function historyDate(value?: string): string {
  const timestamp = historyTimestamp(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "Não registrada";
}

export function historyMileage(value?: number): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString("pt-BR")} km`
    : "Não registrada";
}

export function vehicleHistory(vehicle: Vehicle, orders: ServiceOrder[]) {
  const sorted = orders
    .filter((order) => order.vehicleId === vehicle.id)
    .slice()
    .sort((a, b) => {
      const first = historyTimestamp(a.openedAt);
      const second = historyTimestamp(b.openedAt);
      return first === second ? 0 : first > second ? -1 : 1;
    });
  const mileageOrder = sorted.find(
    (order) =>
      Number.isFinite(historyTimestamp(order.openedAt)) &&
      historyMileage(order.entryMileage) !== "Não registrada",
  );
  return {
    orders: sorted,
    lastVisit: historyDate(sorted[0]?.openedAt),
    mileage: historyMileage(mileageOrder ? mileageOrder.entryMileage : vehicle.mileage),
    mileageSource: mileageOrder ? `Entrada da ${mileageOrder.id}` : "Cadastro do veículo",
  };
}

export function historyEntry(order: ServiceOrder) {
  const budget = Array.isArray(order.budget) ? order.budget.filter(Boolean) : [];
  const approved = budget.filter((item) => item.approval === "Aprovado");
  const total =
    approved.length &&
    approved.every(
      (item) => typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0,
    )
      ? approved.reduce((sum, item) => sum + item.price, 0)
      : null;
  return {
    completed: ["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status),
    services: budget.filter((item) => item.executed === true && item.type === "Serviço"),
    parts: budget.filter((item) => item.executed === true && item.type === "Peça"),
    approvedTotal: total !== null && Number.isFinite(total) ? total : null,
    team: Array.isArray(order.team)
      ? order.team.filter((name) => typeof name === "string" && name.trim()).join(", ")
      : "",
    evidenceCount: Array.isArray(order.evidence) ? order.evidence.filter(Boolean).length : 0,
  };
}

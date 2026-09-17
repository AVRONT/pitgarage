import type { BudgetItem, ServiceOrder } from "./pilot-data";

const budgetStages = ["Recebido", "Em diagnóstico", "Aguardando aprovação"];
const closedStages = ["Serviço concluído", "Aguardando retirada", "Entregue"];

/** Mesmas condições aplicadas em public.remove_budget_item; devolve o motivo real do bloqueio. */
export function budgetItemRemovalBlocker(order: ServiceOrder, item: BudgetItem): string | null {
  if (item.executed)
    return "Este item já foi executado e não pode ser removido; ele permanece no histórico.";
  if (order.cancelledAt) return "Esta OS está cancelada: o orçamento é somente leitura.";
  if (closedStages.includes(order.status) || order.completedAt)
    return "Esta OS já foi concluída ou entregue: o orçamento é somente leitura.";
  if (order.payment)
    return "Esta OS tem pagamento registrado: a remoção precisa de tratamento manual.";
  if (item.approval === "Recusado" || budgetStages.includes(order.status)) return null;
  return `A OS está em “${order.status}”. Nesta etapa só é possível remover itens recusados e nunca executados.`;
}

export function canRemoveBudgetItem(order: ServiceOrder, item: BudgetItem) {
  return budgetItemRemovalBlocker(order, item) === null;
}

export type PartFinancialInput = {
  newItem?: { name: string; type: "Peça" | "Serviço" };
  itemId: string;
  unitCost: number | null;
  markup: number | null;
  quantity: number;
  unitPrice: number;
};
export type BudgetMutation = PartFinancialInput | { removeItem: string } | { receipt: import("./payment-model").ReceiptInput } | { discount: import("./payment-model").DiscountInput };
export type FinancialCorrectionInput = { id: string; type: "receipt" | "discount" | "cost"; payload: Record<string, unknown>; reason: string };
export type FinancialMutation = BudgetMutation | { correction: FinancialCorrectionInput };
export type FinancialRow = {
  orderId: string;
  kind: string;
  completedAt: string | null;
  quantity: number;
  revenue: number;
  unitCost: number | null;
};
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const suggestedPrice = (cost: number | null, markup: number | null) =>
  cost === null || markup === null ? null : roundMoney(cost * (1 + markup / 100));
export function partAmounts(item: Pick<BudgetItem, "price" | "quantity">, cost: number | null) {
  const quantity = item.quantity ?? 1;
  const revenue = roundMoney(item.price);
  const totalCost = cost === null ? null : roundMoney(cost * quantity);
  const profit = totalCost === null ? null : roundMoney(revenue - totalCost);
  return {
    quantity,
    revenue,
    cost: totalCost,
    profit,
    margin: profit === null || revenue === 0 ? null : (profit / revenue) * 100,
  };
}
export function validatePart(input: PartFinancialInput) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100000)
    return "Informe uma quantidade inteira entre 1 e 100.000.";
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0 || input.unitPrice > 100000000)
    return "Informe um preço de venda válido.";
  if (
    input.unitCost !== null &&
    (!Number.isFinite(input.unitCost) || input.unitCost < 0 || input.unitCost > 100000000)
  )
    return "Informe um custo válido ou deixe em branco.";
  if (
    input.markup !== null &&
    (!Number.isFinite(input.markup) || input.markup < 0 || input.markup > 100000)
  )
    return "Informe um acréscimo válido ou deixe em branco.";
  return null;
}
export function dateRange(period: string, now = new Date()) {
  const date = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  if (period === "today") return { start: date(now), end: date(now) };
  if (period === "month")
    return {
      start: date(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: date(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  if (period === "previous")
    return {
      start: date(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      end: date(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  return { start: "", end: "" };
}
export function aggregateFinancial(rows: FinancialRow[], kind = "Todos", start = "", end = "") {
  const typed = rows.filter((row) => kind === "Todos" || row.kind === kind);
  const undated = new Set(typed.filter((row) => !row.completedAt).map((row) => row.orderId)).size;
  const selected = typed.filter(
    (row) =>
      row.completedAt && (!start || row.completedAt >= start) && (!end || row.completedAt <= end),
  );
  const complete = selected.filter(
    (row) => row.unitCost !== null && Number.isFinite(row.unitCost) && row.unitCost >= 0,
  );
  const completeSet = new Set(complete);
  const revenue = roundMoney(selected.reduce((sum, row) => sum + row.revenue, 0));
  const knownRevenue = roundMoney(complete.reduce((sum, row) => sum + row.revenue, 0));
  const cost = roundMoney(
    complete.reduce((sum, row) => sum + roundMoney(row.unitCost! * row.quantity), 0),
  );
  const profit = complete.length ? roundMoney(knownRevenue - cost) : null;
  const groups = (key: (row: FinancialRow) => string) => {
    const map = new Map<string, { name: string; Receita: number; Custo: number; Lucro: number }>();
    for (const row of complete) {
      const name = key(row),
        group = map.get(name) ?? { name, Receita: 0, Custo: 0, Lucro: 0 };
      group.Receita += row.revenue;
      group.Custo += roundMoney(row.unitCost! * row.quantity);
      group.Lucro = group.Receita - group.Custo;
      map.set(name, group);
    }
    return [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({
        ...g,
        Receita: roundMoney(g.Receita),
        Custo: roundMoney(g.Custo),
        Lucro: roundMoney(g.Lucro),
      }));
  };
  return {
    revenue,
    knownRevenue,
    cost: complete.length ? cost : null,
    profit,
    margin: profit === null || knownRevenue === 0 ? null : (profit / knownRevenue) * 100,
    orders: new Set(selected.map((row) => row.orderId)).size,
    incomplete: new Set(selected.filter((row) => !completeSet.has(row)).map((row) => row.orderId))
      .size,
    undated,
    timeline: groups((row) => row.completedAt!),
    vehicles: groups((row) => row.kind),
  };
}

// Report data is a read-only projection; no new persisted financial fields.
export type OrderFinancialRow = {
  orderId: string;
  orderNumber: string;
  vehicle: string | null;
  customer: string | null;
  kind: string | null;
  completedAt: string | null;
  discountAmount?: number;
  paid?: number;
  fees?: number;
  netReceived?: number;
  items: {
    type: "Peça" | "Serviço";
    name?: string | null;
    quantity: number | null;
    revenue: number | null;
    unitCost: number | null;
  }[];
};
const knownAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
export function implicitMarkup(cost: number | null, sale: number | null) {
  return knownAmount(cost) && cost > 0 && knownAmount(sale)
    ? roundMoney(((sale - cost) / cost) * 100)
    : null;
}
export function prefillPart(
  item: Pick<BudgetItem, "price" | "quantity" | "unitPrice">,
  saved: { unitCost: number | null; markup: number | null },
) {
  const quantity = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? item.price / quantity;
  return {
    quantity,
    unitPrice,
    unitCost: saved.unitCost,
    markup: saved.markup,
    implicit: saved.markup === null ? implicitMarkup(saved.unitCost, unitPrice) : null,
  };
}
export function orderAmounts(order: OrderFinancialRow) {
  const parts = order.items.filter((item) => item.type === "Peça"),
    services = order.items.filter((item) => item.type === "Serviço");
  const revenueOf = (items: OrderFinancialRow["items"]) =>
    items.every((item) => knownAmount(item.revenue))
      ? roundMoney(items.reduce((sum, item) => sum + item.revenue!, 0))
      : null;
  const partsRevenue = revenueOf(parts),
    servicesRevenue = revenueOf(services);
  const grossRevenue =
    order.items.length && partsRevenue !== null && servicesRevenue !== null
      ? roundMoney(partsRevenue + servicesRevenue)
      : null;
  const discountAmount = order.discountAmount ?? 0;
  const revenue = grossRevenue === null ? null : roundMoney(grossRevenue - discountAmount);
  const withCost = order.items.filter(
    (item) => knownAmount(item.unitCost) && Number.isInteger(item.quantity) && item.quantity! >= 1,
  );
  const missingPartCosts = parts.filter(
    (item) => !knownAmount(item.unitCost) || !Number.isInteger(item.quantity) || item.quantity! < 1,
  ).length;
  const cost =
    withCost.length === 0 && missingPartCosts === 0
      ? 0
      : withCost.length
        ? roundMoney(
            withCost.reduce((sum, item) => sum + roundMoney(item.unitCost! * item.quantity!), 0),
          )
        : null;
  return {
    ...order,
    grossRevenue,
    discountAmount,
    revenue,
    partsRevenue,
    servicesRevenue,
    cost,
    paid: order.paid ?? 0,
    fees: order.fees ?? 0,
    netReceived: order.netReceived ?? order.paid ?? 0,
    result: revenue === null || cost === null ? null : roundMoney(revenue - cost - (order.fees ?? 0)),
    missingCosts: missingPartCosts,
  };
}
export function aggregateOrders(rows: OrderFinancialRow[], kind = "Todos", start = "", end = "") {
  const typed = rows.filter((row) => kind === "Todos" || row.kind === kind);
  const validDate = (date: string | null) =>
    Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)));
  const selected = typed
    .filter(
      (row) =>
        validDate(row.completedAt) &&
        (!start || row.completedAt! >= start) &&
        (!end || row.completedAt! <= end),
    )
    .map(orderAmounts);
  type Amounts = ReturnType<typeof orderAmounts>;
  const totals = (list: Amounts[]) => {
    const priced = list.filter((row) => row.revenue !== null);
    const sum = (key: "revenue" | "grossRevenue" | "partsRevenue" | "servicesRevenue") =>
      priced.length ? roundMoney(priced.reduce((total, row) => total + row[key]!, 0)) : null;
    const revenue = sum("revenue");
    const costs = priced.filter((row) => row.cost !== null);
    const cost = costs.length
      ? roundMoney(costs.reduce((total, row) => total + row.cost!, 0))
      : null;
    const paid = roundMoney(list.reduce((total, row) => total + row.paid, 0));
    const fees = roundMoney(list.reduce((total, row) => total + row.fees, 0));
    const netReceived = roundMoney(list.reduce((total, row) => total + row.netReceived, 0));
    return {
      revenue,
      grossRevenue: sum("grossRevenue"),
      discountAmount: roundMoney(list.reduce((total, row) => total + row.discountAmount, 0)),
      partsRevenue: sum("partsRevenue"),
      servicesRevenue: sum("servicesRevenue"),
      cost,
      paid,
      fees,
      netReceived,
      result:
        revenue === null || cost === null || costs.length !== priced.length
          ? null
          : roundMoney(revenue - cost),
      ticket: revenue === null ? null : roundMoney(revenue / priced.length),
      pricedOrders: priced.length,
    };
  };
  const groups = (key: (row: Amounts) => string) => {
    const map = new Map<string, Amounts[]>();
    for (const row of selected) {
      const name = key(row);
      const list = map.get(name);
      if (list) list.push(row);
      else map.set(name, [row]);
    }
    return [...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, list]) => {
        const sum = totals(list);
        return { name, Faturamento: sum.revenue, Custo: sum.cost, Resultado: sum.result };
      });
  };
  const timeline = groups((row) => row.completedAt!);
  const vehicles = groups((row) => row.kind ?? "Não informado");
  const byDate = new Map<string, { cars: Amounts[]; bikes: Amounts[] }>();
  for (const row of selected) {
    let group = byDate.get(row.completedAt!);
    if (!group) {
      group = { cars: [], bikes: [] };
      byDate.set(row.completedAt!, group);
    }
    if (row.kind === "Carro") group.cars.push(row);
    else if (row.kind === "Moto") group.bikes.push(row);
  }
  const vehicleTimeline = timeline.map(({ name }) => ({
    name,
    Carros: totals(byDate.get(name)!.cars).result,
    Motos: totals(byDate.get(name)!.bikes).result,
  }));
  const partRows: FinancialRow[] = selected.flatMap((row) =>
    row.items
      .filter(
        (item) =>
          item.type === "Peça" &&
          knownAmount(item.revenue) &&
          Number.isInteger(item.quantity) &&
          item.quantity! >= 1,
      )
      .map((item) => ({
        orderId: row.orderId,
        kind: row.kind ?? "Não informado",
        completedAt: row.completedAt,
        quantity: item.quantity!,
        revenue: item.revenue!,
        unitCost: item.unitCost,
      })),
  );
  return {
    ...totals(selected),
    orders: selected.length,
    unpriced: selected.filter((row) => row.revenue === null).length,
    incompleteCosts: selected.filter((row) => row.missingCosts > 0).length,
    undated: typed.filter((row) => !validDate(row.completedAt)).length,
    rows: selected,
    timeline,
    vehicles,
    vehicleTimeline,
    parts: aggregateFinancial(partRows),
  };
}

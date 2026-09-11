import type { BudgetItem } from "./pilot-data";

export type PartFinancialInput = {
  itemId: string;
  unitCost: number | null;
  markup: number | null;
  quantity: number;
  unitPrice: number;
};
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
    incomplete: new Set(selected.filter((row) => !complete.includes(row)).map((row) => row.orderId))
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
  items: {
    type: "Peça" | "Serviço";
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
  const revenue =
    order.items.length && partsRevenue !== null && servicesRevenue !== null
      ? roundMoney(partsRevenue + servicesRevenue)
      : null;
  const withCost = parts.filter(
    (item) => knownAmount(item.unitCost) && Number.isInteger(item.quantity) && item.quantity! >= 1,
  );
  const cost =
    parts.length === 0
      ? 0
      : withCost.length
        ? roundMoney(
            withCost.reduce((sum, item) => sum + roundMoney(item.unitCost! * item.quantity!), 0),
          )
        : null;
  return {
    ...order,
    revenue,
    partsRevenue,
    servicesRevenue,
    cost,
    result: revenue === null || cost === null ? null : roundMoney(revenue - cost),
    missingCosts: parts.length - withCost.length,
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
    const sum = (key: "revenue" | "partsRevenue" | "servicesRevenue") =>
      priced.length ? roundMoney(priced.reduce((total, row) => total + row[key]!, 0)) : null;
    const revenue = sum("revenue");
    const costs = priced.filter((row) => row.cost !== null);
    const cost = costs.length
      ? roundMoney(costs.reduce((total, row) => total + row.cost!, 0))
      : null;
    return {
      revenue,
      partsRevenue: sum("partsRevenue"),
      servicesRevenue: sum("servicesRevenue"),
      cost,
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
      map.set(name, [...(map.get(name) ?? []), row]);
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
  const vehicleTimeline = timeline.map(({ name }) => ({
    name,
    Carros: totals(selected.filter((row) => row.completedAt === name && row.kind === "Carro"))
      .result,
    Motos: totals(selected.filter((row) => row.completedAt === name && row.kind === "Moto")).result,
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

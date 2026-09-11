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

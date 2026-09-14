import { roundMoney } from "./financial-model";
export interface RevenueCategory {
  id: string;
  name: string;
  parent_id: string | null;
  active: boolean;
}
export interface ExtraRevenue {
  id: string;
  date: string;
  category_id: string;
  subcategory_id: string | null;
  description: string;
  revenue: number;
  cost: number;
  created_by: string;
  created_at: string;
}
export function extraSummary(
  entries: ExtraRevenue[],
  start = "",
  end = "",
  category = "",
  subcategory = "",
) {
  const rows = entries.filter(
    (e) =>
      (!start || e.date >= start) &&
      (!end || e.date <= end) &&
      (!category || e.category_id === category) &&
      (!subcategory || e.subcategory_id === subcategory),
  );
  const revenue = roundMoney(rows.reduce((n, e) => n + Number(e.revenue), 0));
  const cost = roundMoney(rows.reduce((n, e) => n + Number(e.cost ?? 0), 0));
  return { rows, revenue, cost, result: roundMoney(revenue - cost) };
}
export function consolidated(
  os: { revenue: number | null; cost: number | null; result: number | null },
  extra: { revenue: number; cost: number; result: number },
) {
  return {
    revenue: os.revenue === null ? null : roundMoney(os.revenue + extra.revenue),
    cost: os.cost === null ? null : roundMoney(os.cost + extra.cost),
    result: os.result === null ? null : roundMoney(os.result + extra.result),
  };
}

import { financialRpc } from "./financial-api";
import type { ExtraRevenue, RevenueCategory } from "./extra-revenue-model";
import type { Payment } from "./pilot-data";
export interface Receivable {
  id: string;
  number: number;
  customerId: string;
  kind: string;
  date: string;
  total: number;
  paid: number;
  balance: number;
  payment: Payment | null;
}
export const extraRevenueApi = {
  list: () =>
    financialRpc<{ categories: RevenueCategory[]; entries: ExtraRevenue[] }>("list_extra_revenues"),
  receivables: () => financialRpc<Receivable[]>("order_receivables"),
  category: (id: string, name: string, parent: string | null, active: boolean) =>
    financialRpc<RevenueCategory>("save_revenue_category", {
      category_id: id,
      category_name: name,
      parent,
      enabled: active,
    }),
  add: (entry: {
    id: string;
    date: string;
    categoryId: string;
    subcategoryId: string;
    description: string;
    revenue: number;
    cost: number;
  }) => financialRpc<ExtraRevenue>("add_extra_revenue", { entry }),
};

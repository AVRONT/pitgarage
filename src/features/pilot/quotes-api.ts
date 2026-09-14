import { financialRpc } from "./financial-api";
import type { BudgetItem, ServiceOrder } from "./pilot-data";
import type { BudgetMutation } from "./financial-model";

export const quoteStatuses = [
  "Rascunho",
  "Enviado",
  "Aprovado",
  "Recusado",
  "Expirado",
  "Convertido",
] as const;

export type QuoteStatus = (typeof quoteStatuses)[number];

export interface Quote {
  id: string;
  quoteNumber: number;
  customerId: string;
  vehicleId: string | null;
  description: string;
  notes: string;
  status: QuoteStatus;
  items: BudgetItem[];
  warrantyDays: number;
  serviceOrderId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type QuoteRow = {
  id: string;
  quote_number: number;
  customer_id: string;
  vehicle_id: string | null;
  description: string;
  notes: string;
  status: QuoteStatus;
  items: BudgetItem[] | null;
  warranty_days: number;
  service_order_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
};

const mapQuote = (row: QuoteRow): Quote => ({
  id: row.id,
  quoteNumber: row.quote_number,
  customerId: row.customer_id,
  vehicleId: row.vehicle_id,
  description: row.description ?? "",
  notes: row.notes ?? "",
  status: row.status,
  items: row.items ?? [],
  warrantyDays: row.warranty_days,
  serviceOrderId: row.service_order_id,
  convertedAt: row.converted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const quoteLabel = (quote: Pick<Quote, "quoteNumber">) => `ORC-${quote.quoteNumber}`;

export const quoteTotal = (quote: Pick<Quote, "items">) =>
  quote.items.reduce((sum, item) => sum + (item.price ?? 0), 0);

export const quotesApi = {
  list: async () => (await financialRpc<QuoteRow[]>("list_quotes")).map(mapQuote),
  create: async (input: {
    customerId: string;
    vehicleId: string | null;
    description: string;
    notes: string;
  }) =>
    mapQuote(
      await financialRpc<QuoteRow>("create_quote", {
        customer: input.customerId,
        vehicle: input.vehicleId,
        quote_description: input.description,
        quote_notes: input.notes,
      }),
    ),
  update: async (quote: Quote, input: { description: string; notes: string; vehicleId: string | null }) =>
    mapQuote(
      await financialRpc<QuoteRow>("update_quote", {
        quote_id: quote.id,
        expected_version: quote.updatedAt,
        quote_description: input.description,
        quote_notes: input.notes,
        vehicle: input.vehicleId,
      }),
    ),
  setStatus: async (quote: Quote, status: QuoteStatus) =>
    mapQuote(
      await financialRpc<QuoteRow>("set_quote_status", {
        quote_id: quote.id,
        expected_version: quote.updatedAt,
        new_status: status,
      }),
    ),
  /** Mesma camada de domínio usada no orçamento da OS: adicionar ou remover item. */
  mutateItem: async (quote: Quote, mutation: BudgetMutation) => {
    if ("removeItem" in mutation)
      return mapQuote(
        await financialRpc<QuoteRow>("remove_quote_item", {
          quote_id: quote.id,
          expected_version: quote.updatedAt,
          item_id: mutation.removeItem,
        }),
      );
    return mapQuote(
      await financialRpc<QuoteRow>("add_quote_item", {
        quote_id: quote.id,
        expected_version: quote.updatedAt,
        item_id: mutation.itemId,
        item_name: mutation.newItem?.name ?? "",
        item_type: mutation.newItem?.type ?? "Serviço",
        unit_cost: mutation.unitCost,
        markup: mutation.markup,
        quantity: mutation.quantity,
        unit_price: mutation.unitPrice,
      }),
    );
  },
  convert: async (quote: Quote, vehicleId: string | null, entryMileage: number | null) =>
    await financialRpc<{ id: string; order_number: number }>("convert_quote_to_order", {
      quote_id: quote.id,
      expected_version: quote.updatedAt,
      vehicle: vehicleId,
      entry_mileage: entryMileage,
    }),
  part: (quoteId: string, itemId: string) =>
    financialRpc<{ unitCost: number | null; markup: number | null }>("get_quote_part_financial", {
      quote_id: quoteId,
      item_id: itemId,
    }),
};

export type ConvertedOrderRef = Pick<ServiceOrder, "id">;

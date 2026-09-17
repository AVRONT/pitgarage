import { supabase } from "@/integrations/supabase/client";
import type { OrderFinancialRow, FinancialMutation } from "./financial-model";
type RpcError = { message: string; code?: string };
export async function financialRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc(name as never, args as never) as unknown as Promise<{
    data: T;
    error: RpcError | null;
  }>);
  if (error) {
    if (error.code === "42501")
      throw Object.assign(
        new Error(
          /workshop access/i.test(error.message ?? "")
            ? "Você não tem permissão para alterar o orçamento desta OS."
            : "Você não tem permissão financeira. Solicite acesso ao proprietário.",
        ),
        { code: error.code },
      );
    if (error.code === "PGRST202")
      throw new Error("O financeiro ainda precisa ser ativado no ambiente da oficina.");
    throw Object.assign(new Error(error.message || "Não foi possível carregar o financeiro."), {
      code: error.code,
    });
  }

  return data;
}
export type FinancialMember = {
  user_id: string;
  full_name: string;
  allowed: boolean;
  owner: boolean;
};
export const financialApi = {
  access: () => financialRpc<boolean>("can_view_financial"),
  report: () => financialRpc<OrderFinancialRow[]>("financial_order_report"),
  part: (orderId: string, itemId: string) =>
    financialRpc<{ unitCost: number | null; markup: number | null }>("get_part_financial", {
      order_id: orderId,
      item_id: itemId,
    }),
  members: () => financialRpc<FinancialMember[]>("list_financial_members"),
  grant: (userId: string, allowed: boolean) =>
    financialRpc<void>("set_financial_permission", { target_user: userId, allowed }),
};
export type SavePart = (input: FinancialMutation) => Promise<void>;

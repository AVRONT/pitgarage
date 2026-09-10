import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_service_orders",
  title: "Listar ordens de serviço",
  description:
    "Lista as ordens de serviço visíveis para o usuário autenticado, da mais recente para a mais antiga.",
  inputSchema: {
    status: z.string().trim().min(1).optional().describe("Filtra por status exato da OS."),
    limit: z.number().int().min(1).max(50).default(20).describe("Quantidade máxima de OS."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("service_orders")
      .select(
        "id, order_number, status, opened_at, completed_at, complaint, diagnosis, customer_id, vehicle_id",
      )
      .is("deleted_at", null)
      .order("order_number", { ascending: false })
      .limit(limit);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});

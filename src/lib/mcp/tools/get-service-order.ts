import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_service_order",
  title: "Detalhar ordem de serviço",
  description: "Mostra os detalhes de uma ordem de serviço pelo número da OS.",
  inputSchema: {
    order_number: z.number().int().positive().describe("Número da OS."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("service_orders")
      .select(
        "id, order_number, status, opened_at, completed_at, entry_mileage, complaint, diagnosis, findings, notes, team, budget, customer_id, vehicle_id",
      )
      .eq("order_number", order_number)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "OS não encontrada." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { order: data },
    };
  },
});

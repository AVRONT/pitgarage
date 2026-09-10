import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_vehicles",
  title: "Listar veículos",
  description:
    "Lista os veículos visíveis para o usuário autenticado, com busca opcional por placa, marca ou modelo.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Texto para buscar placa, marca ou modelo."),
    limit: z.number().int().min(1).max(50).default(20).describe("Quantidade máxima de veículos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("vehicles")
      .select("id, customer_id, kind, brand, model, year, plate, mileage, color")
      .is("deleted_at", null)
      .limit(limit);
    if (search) {
      const pattern = `%${search.replace(/[%,]/g, "")}%`;
      query = query.or(`plate.ilike.${pattern},brand.ilike.${pattern},model.ilike.${pattern}`);
    }
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { vehicles: data ?? [] },
    };
  },
});

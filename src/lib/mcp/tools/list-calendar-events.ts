import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_calendar_events",
  title: "Listar compromissos da agenda",
  description: "Lista os compromissos da agenda da oficina em um intervalo de datas.",
  inputSchema: {
    range_start: z.string().datetime().describe("Início do intervalo (ISO 8601)."),
    range_end: z.string().datetime().describe("Fim do intervalo (ISO 8601)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ range_start, range_end }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("list_calendar_events", {
      range_start,
      range_end,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { events: data ?? [] },
    };
  },
});

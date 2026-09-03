import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data } = await service.auth.getUser(token);
    if (!data.user) return json({ message: "Não autorizado." }, 401);
    const { data: profile } = await service
      .from("user_profiles")
      .select("access_level,is_active")
      .eq("user_id", data.user.id)
      .single();
    if (!profile?.is_active || profile.access_level !== "owner")
      return json({ message: "Somente o proprietário pode enviar convites." }, 403);
    const { email, fullName } = await request.json();
    if (typeof email !== "string" || !email.includes("@"))
      return json({ message: "Informe um e-mail válido." }, 400);
    const { error } = await service.auth.admin.inviteUserByEmail(email.trim(), {
      data: { full_name: typeof fullName === "string" ? fullName.trim() : "" },
    });
    if (error) return json({ message: error.message }, error.status ?? 400);
    return json({ ok: true });
  } catch {
    return json({ message: "Não foi possível enviar o convite." }, 500);
  }
});

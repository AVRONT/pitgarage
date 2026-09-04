import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, sha256 } from "../_shared/http.ts";
import { supabaseEnv } from "../_shared/supabase-env.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ message: "Método inválido." }, 405);
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const { url, secretKey } = supabaseEnv();
    const service = createClient(url, secretKey);
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
    const { data: allowed, error: limitError } = await service.rpc("reserve_invite_budget", {
      owner_id: data.user.id,
    });
    if (limitError) return json({ message: "Convites temporariamente indisponíveis." }, 503);
    if (!allowed)
      return json({ message: "Limite temporário de convites atingido. Tente mais tarde." }, 429);
    const emailHash = await sha256(email.trim().toLowerCase());
    const inviteToken = crypto.randomUUID();
    const inviteTokenHash = await sha256(inviteToken);
    const { data: exemption, error: exemptionError } = await service
      .from("registration_invite_exemptions")
      .insert({ email_hash: emailHash, token_hash: inviteTokenHash, created_by: data.user.id })
      .select("id")
      .single();
    if (exemptionError || !exemption)
      return json({ message: "Não foi possível preparar o convite." }, 500);
    const { error } = await service.auth.admin.inviteUserByEmail(email.trim(), {
      data: {
        full_name: typeof fullName === "string" ? fullName.trim() : "",
        pitgarage_invite_token: inviteToken,
      },
    });
    if (error) {
      await service.from("registration_invite_exemptions").delete().eq("id", exemption.id);
      return json({ message: error.message }, error.status ?? 400);
    }
    return json({ ok: true });
  } catch {
    return json({ message: "Não foi possível enviar o convite." }, 500);
  }
});

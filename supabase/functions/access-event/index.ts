import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requestIp, sha256 } from "../_shared/http.ts";
import { supabaseEnv } from "../_shared/supabase-env.ts";

const allowed = new Set(["login_succeeded", "session_restored", "logout"]);
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const { url, publishableKey, secretKey } = supabaseEnv();
    const auth = createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data } = await auth.auth.getUser();
    if (!data.user) return json({ message: "Não autorizado." }, 401);
    const { eventType, deviceId } = await request.json();
    if (!allowed.has(eventType) || typeof deviceId !== "string")
      return json({ message: "Evento inválido." }, 400);
    const service = createClient(url, secretKey);
    await service.from("access_events").insert({
      user_id: data.user.id,
      event_type: eventType,
      ip_address: requestIp(request),
      user_agent: request.headers.get("user-agent"),
      device_id_hash: await sha256(deviceId),
    });
    return json({ ok: true });
  } catch {
    return json({ message: "Evento não registrado." }, 500);
  }
});

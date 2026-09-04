import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requestIp, sha256 } from "../_shared/http.ts";
import { supabaseEnv } from "../_shared/supabase-env.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ message: "Método inválido." }, 405);
  try {
    const { fullName, email, password, deviceId, captchaToken } = await request.json();
    if (
      ![fullName, email, password, deviceId].every(
        (value) => typeof value === "string" && value.trim(),
      )
    )
      return json({ message: "Dados de cadastro inválidos." }, 400);
    const { url, publishableKey, secretKey } = supabaseEnv();
    const service = createClient(url, secretKey);
    const ip = requestIp(request);
    if (!ip) return json({ message: "Cadastro temporariamente indisponível." }, 503);
    const deviceHash = await sha256(deviceId);
    const emailHash = await sha256(email.trim().toLowerCase());
    const { data: pendingId, error: pendingError } = await service.rpc(
      "reserve_registration_attempt",
      { client_ip: ip, device_hash: deviceHash, email_hash_value: emailHash },
    );
    if (pendingError) return json({ message: "Cadastro temporariamente indisponível." }, 503);
    if (!pendingId)
      return json(
        { message: "Limite temporário de cadastros atingido. Tente novamente mais tarde." },
        429,
      );
    const auth = createClient(url, publishableKey);
    const { data, error } = await auth.auth.signUp({
      email: email.trim(),
      password,
      options: {
        captchaToken,
        data: { full_name: fullName.trim(), registration_attempt_id: pendingId },
      },
    });
    const created = !error && Boolean(data.user?.identities?.length);
    await service
      .from("registration_attempts")
      .update({
        succeeded: created,
        reason: error ? (error.code ?? "auth_error") : created ? "created" : "sanitized_response",
      })
      .eq("id", pendingId)
      .eq("blocked", false);
    if (error)
      return json({ code: error?.code, message: error?.message ?? "Cadastro indisponível." }, 400);
    if (!created)
      return json({ user: { identities: [] }, session: null, requiresEmailConfirmation: true });
    await service.from("access_events").insert({
      user_id: data.user?.id ?? null,
      event_type: "registration_completed",
      ip_address: ip,
      user_agent: request.headers.get("user-agent"),
      device_id_hash: deviceHash,
    });
    return json({
      user: { identities: [{}] },
      session: null,
      requiresEmailConfirmation: !data.session,
    });
  } catch {
    return json({ message: "Cadastro temporariamente indisponível." }, 500);
  }
});

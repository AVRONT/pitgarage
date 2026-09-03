import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requestIp, sha256 } from "../_shared/http.ts";

const FALLBACK_LIMITS = { device24h: 3, ip1h: 5, ip24h: 10 } as const;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ message: "Método inválido." }, 405);
  try {
    const { fullName, email, password, deviceId, turnstileToken } = await request.json();
    if (
      ![fullName, email, password, deviceId].every(
        (value) => typeof value === "string" && value.trim(),
      )
    )
      return json({ message: "Dados de cadastro inválidos." }, 400);
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = requestIp(request);
    const deviceHash = await sha256(deviceId);
    const emailHash = await sha256(email.trim().toLowerCase());
    const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (secret) {
      const verification = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret, response: turnstileToken, remoteip: ip }),
        },
      ).then((response) => response.json());
      if (!verification.success)
        return json({ message: "Confirme a verificação de segurança." }, 403);
    }
    const since24h = new Date(Date.now() - 86_400_000).toISOString();
    const [{ data: configuredLimits }, { count: device24h }] = await Promise.all([
      service
        .from("registration_rate_limits")
        .select("device_24h,ip_1h,ip_24h")
        .eq("singleton", true)
        .single(),
      service
        .from("registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("device_id_hash", deviceHash)
        .eq("succeeded", true)
        .gte("created_at", since24h),
    ]);
    const limits = {
      device24h: configuredLimits?.device_24h ?? FALLBACK_LIMITS.device24h,
      ip1h: configuredLimits?.ip_1h ?? FALLBACK_LIMITS.ip1h,
      ip24h: configuredLimits?.ip_24h ?? FALLBACK_LIMITS.ip24h,
    };
    if ((device24h ?? 0) >= limits.device24h) {
      await service.from("registration_attempts").insert({
        ip_address: ip,
        device_id_hash: deviceHash,
        email_hash: emailHash,
        blocked: true,
        reason: "device_limit",
      });
      await service.from("access_events").insert({
        event_type: "registration_blocked",
        ip_address: ip,
        user_agent: request.headers.get("user-agent"),
        device_id_hash: deviceHash,
      });
      return json(
        { message: "Limite temporário de cadastros atingido. Tente novamente mais tarde." },
        429,
      );
    }
    const { data: pending, error: pendingError } = await service
      .from("registration_attempts")
      .insert({
        ip_address: ip,
        device_id_hash: deviceHash,
        email_hash: emailHash,
        reason: "pending",
      })
      .select("id")
      .single();
    if (pendingError || !pending)
      return json({ message: "Cadastro temporariamente indisponível." }, 503);
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data, error } = await auth.auth.signUp({
      email: email.trim(),
      password,
      options: {
        captchaToken: turnstileToken,
        data: { full_name: fullName.trim(), registration_attempt_id: pending.id },
      },
    });
    await service
      .from("registration_attempts")
      .update({ succeeded: !error, reason: error ? (error.code ?? "auth_error") : "created" })
      .eq("id", pending.id)
      .eq("blocked", false);
    if (error || !data.user)
      return json({ code: error?.code, message: error?.message ?? "Cadastro indisponível." }, 400);
    await service.from("access_events").insert({
      user_id: data.user.id,
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

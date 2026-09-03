import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requestIp, sha256 } from "../_shared/http.ts";
import { supabaseEnv } from "../_shared/supabase-env.ts";

const FALLBACK_LIMITS = { device24h: 3, ip1h: 5, ip24h: 10 } as const;

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
    const since1h = new Date(Date.now() - 3_600_000).toISOString();
    const since24h = new Date(Date.now() - 86_400_000).toISOString();
    const [limitsResult, deviceResult, ip1hResult, ip24hResult] = await Promise.all([
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
      service
        .from("registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", since1h),
      service
        .from("registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", since24h),
    ]);
    if (limitsResult.error || deviceResult.error || ip1hResult.error || ip24hResult.error)
      return json({ message: "Cadastro temporariamente indisponível." }, 503);
    const limits = {
      device24h: limitsResult.data?.device_24h ?? FALLBACK_LIMITS.device24h,
      ip1h: limitsResult.data?.ip_1h ?? FALLBACK_LIMITS.ip1h,
      ip24h: limitsResult.data?.ip_24h ?? FALLBACK_LIMITS.ip24h,
    };
    const blockReason =
      (ip1hResult.count ?? 0) >= limits.ip1h || (ip24hResult.count ?? 0) >= limits.ip24h
        ? "edge_ip_limit"
        : (deviceResult.count ?? 0) >= limits.device24h
          ? "device_limit"
          : null;
    if (blockReason) {
      await service.from("registration_attempts").insert({
        ip_address: ip,
        device_id_hash: deviceHash,
        email_hash: emailHash,
        blocked: true,
        reason: blockReason,
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
    const auth = createClient(url, publishableKey);
    const { data, error } = await auth.auth.signUp({
      email: email.trim(),
      password,
      options: {
        captchaToken,
        data: { full_name: fullName.trim(), registration_attempt_id: pending.id },
      },
    });
    const created = !error && Boolean(data.user?.identities?.length);
    await service
      .from("registration_attempts")
      .update({
        succeeded: created,
        reason: error ? (error.code ?? "auth_error") : created ? "created" : "sanitized_response",
      })
      .eq("id", pending.id)
      .eq("blocked", false);
    if (error)
      return json({ code: error?.code, message: error?.message ?? "Cadastro indisponível." }, 400);
    if (!created)
      return json({ user: { identities: [] }, session: null, requiresEmailConfirmation: true });
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

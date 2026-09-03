import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requestIp, sha256 } from "../_shared/http.ts";

const LIMITS = { device24h: 3, ip1h: 5, ip24h: 10 } as const;

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
    const since1h = new Date(Date.now() - 3_600_000).toISOString();
    const since24h = new Date(Date.now() - 86_400_000).toISOString();
    const [{ count: device24h }, { count: ip1h }, { count: ip24h }] = await Promise.all([
      service
        .from("registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("device_id_hash", deviceHash)
        .gte("created_at", since24h),
      ip
        ? service
            .from("registration_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_address", ip)
            .gte("created_at", since1h)
        : Promise.resolve({ count: 0 }),
      ip
        ? service
            .from("registration_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_address", ip)
            .gte("created_at", since24h)
        : Promise.resolve({ count: 0 }),
    ]);
    const blocked =
      (device24h ?? 0) >= LIMITS.device24h ||
      (ip1h ?? 0) >= LIMITS.ip1h ||
      (ip24h ?? 0) >= LIMITS.ip24h;
    if (blocked) {
      await service.from("registration_attempts").insert({
        ip_address: ip,
        device_id_hash: deviceHash,
        email_hash: emailHash,
        blocked: true,
        reason: "rate_limit",
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
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data, error } = await auth.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    await service.from("registration_attempts").insert({
      ip_address: ip,
      device_id_hash: deviceHash,
      email_hash: emailHash,
      succeeded: !error,
      reason: error?.code ?? null,
    });
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

function plainKey(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate || candidate.startsWith("{") || candidate.startsWith("[")) return null;
  return candidate;
}

function defaultKeyFromMap(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = (parsed as Record<string, unknown>)["default"];
    return typeof candidate === "string" ? plainKey(candidate) : null;
  } catch {
    return null;
  }
}

export function supabaseEnv() {
  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    plainKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEY")) ??
    defaultKeyFromMap(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) ??
    plainKey(Deno.env.get("SUPABASE_ANON_KEY"));
  const secretKey =
    plainKey(Deno.env.get("SUPABASE_SECRET_KEY")) ??
    defaultKeyFromMap(Deno.env.get("SUPABASE_SECRET_KEYS")) ??
    plainKey(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!url || !publishableKey || !secretKey) throw new Error("Supabase environment unavailable");
  return { url, publishableKey, secretKey };
}

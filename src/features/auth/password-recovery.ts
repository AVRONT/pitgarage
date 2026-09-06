import { supabase } from "@/integrations/supabase/client";

// The recovery screen is only authorized by a callback consumed on this page load.
let recoverySession: { userId: string; accessToken: string } | null = null;
let initialization: Promise<boolean> | undefined;

export const isRecoveryPage = () =>
  typeof window !== "undefined" && window.location.pathname === "/reset-password";

function cleanRecoveryUrl() {
  const url = new URL(window.location.href);
  for (const key of ["code", "token", "token_hash", "type"]) url.searchParams.delete(key);
  url.hash = "";
  window.history.replaceState(window.history.state, "", url.toString());
}

export function preparePasswordRecovery(): Promise<boolean> {
  if (initialization) return initialization;

  // Read the callback synchronously, before the SDK can consume the URL itself.
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const hasError =
    url.searchParams.has("error") ||
    url.searchParams.has("error_code") ||
    hash.has("error") ||
    hash.has("error_code");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token");
  const type = url.searchParams.get("type") ?? hash.get("type");
  const code = url.searchParams.get("code");
  const hadCallback = Boolean(accessToken || tokenHash || code);

  let sawRecoveryEvent = false;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) sawRecoveryEvent = true;
  });

  initialization = (async () => {
    if (hasError) return false;

    // Explicit hash tokens (implicit flow recovery link).
    if (accessToken && refreshToken && type === "recovery") {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!error && data.session) {
        recoverySession = { userId: data.session.user.id, accessToken: data.session.access_token };
        return true;
      }
    }

    // Hashed one-time token (default recovery template / verify redirect).
    if (tokenHash && (!type || type === "recovery")) {
      const { data, error } = await supabase.auth.verifyOtp({
        type: "recovery",
        token_hash: tokenHash,
      });
      if (!error && data.session) {
        recoverySession = { userId: data.session.user.id, accessToken: data.session.access_token };
        return true;
      }
    }

    // PKCE code, when the SDK still holds the matching verifier.
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.session && sawRecoveryEvent) {
        recoverySession = { userId: data.session.user.id, accessToken: data.session.access_token };
        return true;
      }
    }

    // The SDK may have already consumed the callback (detectSessionInUrl).
    if (!hadCallback && !sawRecoveryEvent) return false;
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session && sawRecoveryEvent) {
      recoverySession = { userId: data.session.user.id, accessToken: data.session.access_token };
      return true;
    }
    return false;
  })()
    .then((valid) => {
      if (valid) cleanRecoveryUrl();
      return valid;
    })
    .catch(() => {
      recoverySession = null;
      return false;
    });

  return initialization;
}

export async function validatePasswordRecovery() {
  if (!recoverySession) return false;
  const session = await supabase.auth.getSession();
  if (session.error || session.data.session?.access_token !== recoverySession.accessToken)
    return false;
  const { data, error } = await supabase.auth.getUser();
  return !error && data.user?.id === recoverySession.userId;
}

export function consumePasswordRecovery() {
  recoverySession = null;
}

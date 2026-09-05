import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Intentionally memory-only: a normal/restored session never authorizes this screen.
let recoverySession: Session | null = null;
let initialization: Promise<boolean> | undefined;

export const isRecoveryPage = () =>
  typeof window !== "undefined" && window.location.pathname === "/reset-password";

export function preparePasswordRecovery(): Promise<boolean> {
  if (initialization) return initialization;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const hasCallback =
    Boolean(url.searchParams.get("code")) ||
    (hash.get("type") === "recovery" &&
      Boolean(hash.get("access_token")) &&
      Boolean(hash.get("refresh_token")));
  const hasError =
    url.searchParams.has("error") ||
    hash.has("error") ||
    url.searchParams.has("error_code") ||
    hash.has("error_code");

  initialization = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (valid: boolean) => {
      if (settled) return;
      settled = true;
      resolve(valid);
    };
    // Subscribe before SDK initialization finishes; no Auth calls inside its callback.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && hasCallback && !hasError && !settled) {
        recoverySession = session;
        finish(Boolean(session));
      } else if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        recoverySession = null;
        if (event === "SIGNED_IN") finish(false);
      } else if (event === "TOKEN_REFRESHED" && recoverySession?.user.id === session?.user.id) {
        recoverySession = session;
      }
    });
    void supabase.auth
      .initialize()
      .then(async ({ error }) => {
        const remainingCode = new URL(window.location.href).searchParams.get("code");
        if (
          !settled &&
          !hasError &&
          remainingCode &&
          remainingCode === url.searchParams.get("code")
        ) {
          // The current implicit client rejects PKCE during automatic initialization.
          // Let the SDK exchange it with its stored verifier and emit the recovery event.
          const exchanged = await supabase.auth.exchangeCodeForSession(remainingCode);
          if (!exchanged.error) {
            const cleaned = new URL(window.location.href);
            cleaned.searchParams.delete("code");
            window.history.replaceState(window.history.state, "", cleaned.toString());
          }
          if (exchanged.error || !recoverySession) finish(false);
          return;
        }
        // Successful callback processing removes code/hash; its recovery event settles readiness.
        // An unconsumed code means the SDK lacked a matching PKCE verifier.
        if (
          error ||
          hasError ||
          !hasCallback ||
          new URL(window.location.href).searchParams.has("code")
        ) {
          finish(false);
        }
      })
      .catch(() => finish(false));
  });
  return initialization;
}

export async function validatePasswordRecovery() {
  if (!recoverySession) return false;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.access_token !== recoverySession?.access_token)
    return false;
  const verified = await supabase.auth.getUser();
  return (
    !verified.error &&
    Boolean(recoverySession) &&
    verified.data.user?.id === recoverySession?.user.id
  );
}

export function consumePasswordRecovery() {
  recoverySession = null;
}

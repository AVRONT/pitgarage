import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "./auth-context";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { identity, isLoading, retryProfile, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !identity && !user) void navigate({ to: "/login", replace: true });
    if (!isLoading && identity?.profile.access_level === "customer")
      void navigate({ to: "/cliente", replace: true });
  }, [identity, isLoading, navigate, user]);

  if (!isLoading && user && !identity) {
    return <ProfileRetry onRetry={() => void retryProfile()} />;
  }

  if (isLoading || !identity || identity.profile.access_level === "customer") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="text-center" role="status" aria-live="polite">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Verificando acesso…</p>
        </div>
      </main>
    );
  }

  return children;
}

export function CustomerAuthGuard({ children }: { children: ReactNode }) {
  const { identity, isLoading, retryProfile, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !identity && !user) void navigate({ to: "/login", replace: true });
    if (!isLoading && identity && identity.profile.access_level !== "customer")
      void navigate({ to: "/", replace: true });
  }, [identity, isLoading, navigate, user]);

  if (!isLoading && user && !identity) {
    return <ProfileRetry onRetry={() => void retryProfile()} />;
  }

  if (isLoading || !identity || identity.profile.access_level !== "customer") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="text-center" role="status" aria-live="polite">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Verificando acesso…</p>
        </div>
      </main>
    );
  }

  return children;
}

function ProfileRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <p className="font-semibold">Não foi possível carregar seu perfil.</p>
        <p className="mt-1 text-sm text-muted-foreground">Sua sessão foi mantida.</p>
        <button className="mt-4 text-sm font-semibold text-primary underline" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    </main>
  );
}

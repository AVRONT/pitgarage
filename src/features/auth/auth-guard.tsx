import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "./auth-context";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { identity, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !identity) void navigate({ to: "/login", replace: true });
  }, [identity, isLoading, navigate]);

  if (isLoading || !identity) {
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

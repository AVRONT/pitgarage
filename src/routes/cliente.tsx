import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { CustomerAuthGuard } from "@/features/auth/auth-guard";

export const Route = createFileRoute("/cliente")({
  component: CustomerRoute,
});

function CustomerRoute() {
  return (
    <CustomerAuthGuard>
      <CustomerArea />
    </CustomerAuthGuard>
  );
}

function CustomerArea() {
  const { identity, logout } = useAuth();
  const navigate = useNavigate();
  if (!identity) return null;

  const name = identity.profile.full_name ?? identity.email?.split("@")[0] ?? "Cliente";

  const handleLogout = async () => {
    await logout();
    await navigate({ to: "/login", replace: true });
  };

  return (
    <main className="auth-page grid min-h-screen place-items-center px-4 py-8 sm:px-6">
      <section className="auth-card w-full max-w-xl rounded-lg border bg-card p-6 shadow-lg sm:p-8">
        <div className="flex items-center gap-3 border-b pb-5">
          <span className="brand-mark grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-semibold">PitGarage</p>
            <p className="text-sm text-muted-foreground">Área do Cliente</p>
          </div>
        </div>

        <div className="py-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
            <UserRound className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Área do Cliente</h1>
          <p className="mt-3 font-medium">{name}</p>
          {identity.email && <p className="text-sm text-muted-foreground">{identity.email}</p>}
          <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-muted-foreground">
            Seus veículos e serviços aparecerão aqui futuramente.
          </p>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut /> Sair
        </Button>
      </section>
    </main>
  );
}

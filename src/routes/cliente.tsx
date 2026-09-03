import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CarFront, ClipboardList, LoaderCircle, LogOut, UserRound, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { CustomerAuthGuard } from "@/features/auth/auth-guard";
import { loadCustomerPortal } from "@/features/pilot/operational-repository";
import type { Customer, ServiceOrder, Vehicle } from "@/features/pilot/pilot-data";

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
  const [portal, setPortal] = useState<{
    customer: Customer;
    vehicles: Vehicle[];
    orders: ServiceOrder[];
  } | null>();
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void loadCustomerPortal()
      .then(setPortal)
      .catch(() => {
        setLoadError("Não foi possível carregar seus dados agora. Tente novamente mais tarde.");
        setPortal(null);
      });
  }, []);
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
          <p className="mt-3 font-medium">{portal?.customer.name ?? name}</p>
          {identity.email && <p className="text-sm text-muted-foreground">{identity.email}</p>}
          {portal === undefined ? (
            <LoaderCircle className="mx-auto mt-6 h-5 w-5 animate-spin text-primary" />
          ) : loadError ? (
            <p className="mx-auto mt-6 max-w-md text-sm text-red-700">{loadError}</p>
          ) : !portal ? (
            <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-muted-foreground">
              Quando sua oficina vincular seu cadastro, seus veículos e serviços aparecerão aqui.
            </p>
          ) : (
            <div className="mt-7 grid gap-4 text-left sm:grid-cols-2">
              <section className="rounded-md border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                  <CarFront className="h-4 w-4" /> Veículos
                </h2>
                <div className="mt-3 space-y-2 text-sm">
                  {portal.vehicles.length ? (
                    portal.vehicles.map((vehicle) => (
                      <p key={vehicle.id}>
                        {vehicle.brand} {vehicle.model} · {vehicle.plate}
                      </p>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Nenhum veículo vinculado.</p>
                  )}
                </div>
              </section>
              <section className="rounded-md border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                  <ClipboardList className="h-4 w-4" /> Serviços
                </h2>
                <div className="mt-3 space-y-2 text-sm">
                  {portal.orders.length ? (
                    portal.orders.map((order) => (
                      <p key={order.id}>
                        {order.id} · {order.status}
                      </p>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Nenhuma ordem de serviço vinculada.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut /> Sair
        </Button>
      </section>
    </main>
  );
}

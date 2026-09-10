import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CarFront, ClipboardList, LoaderCircle, LogOut, UserRound, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { CustomerAuthGuard } from "@/features/auth/auth-guard";
import { loadCustomerPortal } from "@/features/pilot/operational-repository";
import type { Customer, ServiceOrder, Vehicle } from "@/features/pilot/pilot-data";
import { ChatWidget } from "@/features/platform/chat-widget";
import { NotificationBell } from "@/features/platform/notification-bell";

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
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setPortal(undefined);
    setLoadError("");
    void loadCustomerPortal()
      .then((data) => {
        if (active) setPortal(data);
      })
      .catch(() => {
        if (!active) return;
        setLoadError("Não foi possível carregar seus dados agora. Tente novamente mais tarde.");
        setPortal(null);
      });
    return () => {
      active = false;
    };
  }, [identity?.userId, attempt]);
  if (!identity) return null;

  const name = identity.profile.full_name ?? identity.email?.split("@")[0] ?? "Cliente";
  const openOrders = portal?.orders.filter((order) => order.status !== "Entregue").length ?? 0;
  const completedOrders = portal?.orders.filter((order) => order.status === "Entregue").length ?? 0;

  const handleLogout = async () => {
    await logout();
    await navigate({ to: "/login", replace: true });
  };

  return (
    <main className="client-portal-shell min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <section className="mx-auto w-full max-w-6xl overflow-hidden rounded-lg border bg-card">
        <header className="flex items-center gap-3 border-b px-5 py-4 sm:px-7">
          <span className="brand-mark grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-semibold">PitGarage</p>
            <p className="text-sm text-muted-foreground">Área do Cliente</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Button type="button" variant="outline" onClick={handleLogout}>
              <LogOut /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        <div className="p-5 sm:p-7 lg:p-9">
          <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-secondary text-primary">
              <UserRound className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">Área do Cliente</p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950">
                Olá, {portal?.customer.name ?? name}
              </h1>
              {identity.email && (
                <p className="break-words text-sm text-muted-foreground">{identity.email}</p>
              )}
            </div>
          </div>
          {portal === undefined ? (
            <div
              role="status"
              className="grid min-h-64 place-items-center text-sm text-muted-foreground"
            >
              <div className="text-center">
                <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
                Carregando seus dados…
              </div>
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="mt-8 rounded-md border border-red-200 bg-red-50 p-5 text-center"
            >
              <p className="text-sm text-red-700">{loadError}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Tentar novamente
              </Button>
            </div>
          ) : !portal ? (
            <div className="mt-8 grid min-h-64 place-items-center rounded-md border border-dashed bg-slate-50 p-6 text-center">
              <div className="max-w-md">
                <CarFront className="mx-auto h-8 w-8 text-primary" />
                <h2 className="mt-3 text-lg font-semibold">Cadastro aguardando vínculo</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Quando a oficina vincular esta conta ao seu cadastro, seus veículos e serviços
                  aparecerão aqui automaticamente.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
                <div className="bg-white p-4">
                  <strong className="text-2xl tabular-nums text-primary">
                    {portal.vehicles.length}
                  </strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Veículos vinculados
                  </span>
                </div>
                <div className="bg-white p-4">
                  <strong className="text-2xl tabular-nums text-amber-700">{openOrders}</strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Serviços em andamento
                  </span>
                </div>
                <div className="bg-white p-4">
                  <strong className="text-2xl tabular-nums text-emerald-700">
                    {completedOrders}
                  </strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Serviços concluídos
                  </span>
                </div>
              </div>
              <div className="mt-6 grid gap-5 text-left lg:grid-cols-2">
                <section className="overflow-hidden rounded-md border">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <span className="flex w-full items-center gap-2 border-b bg-slate-50 px-4 py-3">
                      <CarFront className="h-4 w-4 text-primary" /> Veículos
                    </span>
                  </h2>
                  <div className="divide-y text-sm">
                    {portal.vehicles.length ? (
                      portal.vehicles.map((vehicle) => (
                        <p
                          key={vehicle.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <span className="font-medium">
                            {vehicle.brand} {vehicle.model}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {vehicle.plate}
                          </span>
                        </p>
                      ))
                    ) : (
                      <p className="p-5 text-muted-foreground">Nenhum veículo vinculado.</p>
                    )}
                  </div>
                </section>
                <section className="overflow-hidden rounded-md border">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <span className="flex w-full items-center gap-2 border-b bg-slate-50 px-4 py-3">
                      <ClipboardList className="h-4 w-4 text-primary" /> Serviços
                    </span>
                  </h2>
                  <div className="divide-y text-sm">
                    {portal.orders.length ? (
                      portal.orders.map((order) => (
                        <p
                          key={order.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <span className="font-medium">{order.id}</span>
                          <span className="text-xs font-semibold text-primary">{order.status}</span>
                        </p>
                      ))
                    ) : (
                      <p className="p-5 text-muted-foreground">
                        Nenhuma ordem de serviço vinculada.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </section>
      <ChatWidget />
    </main>
  );
}

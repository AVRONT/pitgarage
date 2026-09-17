import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CarFront,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Gauge,
  PackageCheck,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { platformApi, type CalendarEvent } from "@/features/platform/platform-api";
import { cn } from "@/lib/utils";
import { type Customer, type ServiceOrder, type Vehicle } from "./pilot-data";
import { evaluateOrderWorkflow } from "./pilot-workflow";

type DashboardTarget =
  { screen: "calendar" | "orders" } | { screen: "order" | "vehicle"; id: string; tab?: string };

const statusTone: Record<string, string> = {
  Recebido: "border-slate-200 bg-slate-50 text-slate-700",
  "Em diagnóstico": "border-blue-200 bg-blue-50 text-blue-800",
  "Aguardando aprovação": "border-amber-200 bg-amber-50 text-amber-800",
  "Aguardando peça": "border-amber-200 bg-amber-50 text-amber-800",
  "Em manutenção": "border-blue-200 bg-blue-50 text-blue-800",
  "Serviço concluído": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Aguardando retirada": "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const statusIcon: Record<string, ElementType> = {
  Recebido: ClipboardList,
  "Em diagnóstico": Gauge,
  "Aguardando aprovação": Clock3,
  "Aguardando peça": PackageCheck,
  "Em manutenção": Wrench,
  "Serviço concluído": CheckCircle2,
  "Aguardando retirada": CarFront,
};

const priorityByStatus: Record<string, number> = {
  "Aguardando aprovação": 0,
  "Aguardando peça": 1,
  "Em diagnóstico": 2,
  Recebido: 3,
  "Em manutenção": 4,
  "Serviço concluído": 5,
  "Aguardando retirada": 5,
};

const plural = (value: number, singular: string, pluralValue = `${singular}s`) =>
  `${value} ${value === 1 ? singular : pluralValue}`;

function knownDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function orderQueue(orders: ServiceOrder[]) {
  return orders
    .filter((order) => order.status !== "Entregue")
    .map((order) => ({ order, workflow: evaluateOrderWorkflow(order) }))
    .sort(
      (left, right) =>
        (left.workflow.inconsistency ? -1 : 0) - (right.workflow.inconsistency ? -1 : 0) ||
        (priorityByStatus[left.order.status] ?? 99) -
          (priorityByStatus[right.order.status] ?? 99) ||
        knownDate(left.order.openedAt) - knownDate(right.order.openedAt),
    );
}

function relevantBlocker(order: ServiceOrder, workflow: ReturnType<typeof evaluateOrderWorkflow>) {
  if (workflow.inconsistency) return workflow.inconsistency;
  if (workflow.waitingApprovalCount)
    return plural(workflow.waitingApprovalCount, "item aguardando aprovação");
  if (workflow.blockingPartCount)
    return plural(workflow.blockingPartCount, "peça bloqueando o serviço");
  if (!order.team.length) return "Responsável ainda não definido";
  return "";
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.toISOString(), end.toISOString()] as const;
}

function formatEventTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "Horário não informado";
}

const tabLabel: Record<string, string> = {
  overview: "Resumo",
  diagnosis: "Diagnóstico",
  budget: "Orçamento",
  execution: "Execução",
  payment: "Pagamento",
};

function TodayPanel({
  localOnly,
  orders,
  vehicles,
  onNavigate,
}: {
  localOnly: boolean;
  orders: ServiceOrder[];
  vehicles: Vehicle[];
  onNavigate: (target: DashboardTarget) => void;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">(
    localOnly ? "ready" : "loading",
  );

  useEffect(() => {
    if (localOnly) return;
    let active = true;
    const [start, end] = todayRange();
    setState("loading");
    void platformApi
      .calendar(start, end)
      .then((items) => {
        if (!active) return;
        setEvents(Array.isArray(items) ? items : []);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [localOnly]);
  const deliveries = events.filter((event) => event.category === "delivery");

  return (
    <>
      <Card className="dashboard-surface h-full bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <CalendarDays className="h-5 w-5 text-primary" /> Hoje
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Compromissos definidos na Agenda.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate({ screen: "calendar" })}>
              Abrir Agenda <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {state === "loading" && (
            <div className="mt-3 space-y-2" role="status" aria-label="Carregando agenda de hoje">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-10 animate-pulse rounded bg-slate-100 motion-reduce:animate-none"
                />
              ))}
            </div>
          )}
          {state === "error" && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              Não foi possível carregar os compromissos de hoje. Consulte a Agenda.
            </p>
          )}
          {state === "ready" && !events.length && (
            <p className="mt-3 rounded-md border border-dashed bg-slate-50 p-3 text-sm text-muted-foreground">
              {localOnly
                ? "A Agenda requer uma sessão cloud para mostrar compromissos."
                : "Nenhum compromisso registrado para hoje."}
            </p>
          )}
          {state === "ready" && events.length > 0 && (
            <ol className="dashboard-agenda mt-3 ml-2 border-l border-blue-200 pl-4">
              {events
                .slice()
                .sort((a, b) => knownDate(a.starts_at) - knownDate(b.starts_at))
                .slice(0, 5)
                .map((event) => {
                  const linkedOrder = orders.find(
                    (order) => order.databaseId === event.service_order_id,
                  );
                  const vehicle = vehicles.find((item) => item.id === event.vehicle_id);
                  return (
                    <li key={event.id} className="relative flex gap-3 py-2.5">
                      <span className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />
                      <time className="w-12 shrink-0 text-sm font-bold text-primary">
                        {formatEventTime(event.starts_at)}
                      </time>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{event.title}</p>
                        {(vehicle || linkedOrder) && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : ""}
                            {vehicle && linkedOrder ? " · " : ""}
                            {linkedOrder?.id ?? ""}
                          </p>
                        )}
                        {event.notes && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {event.notes}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ol>
          )}
        </CardContent>
      </Card>
      <Card className="dashboard-surface h-full bg-white">
        <CardContent className="p-4">
          <h2 className="text-lg font-bold">Entregas de hoje</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Somente eventos registrados como entrega na Agenda.
          </p>
          {state === "loading" && (
            <div className="mt-3 h-14 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          )}
          {state === "error" && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              Não foi possível confirmar as entregas de hoje.
            </p>
          )}
          {state === "ready" && !deliveries.length && (
            <div className="mt-3 flex items-center gap-3 rounded-md border border-dashed bg-slate-50 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-muted-foreground">
                <CarFront className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Nenhuma entrega programada com horário</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Somente registros reais da Agenda aparecem aqui.
                </p>
              </div>
            </div>
          )}
          {state === "ready" && deliveries.length > 0 && (
            <ol className="mt-4 divide-y">
              {deliveries
                .slice()
                .sort((a, b) => knownDate(a.starts_at) - knownDate(b.starts_at))
                .map((event) => {
                  const linkedOrder = orders.find(
                    (order) => order.databaseId === event.service_order_id,
                  );
                  const vehicle = vehicles.find((item) => item.id === event.vehicle_id);
                  return (
                    <li key={event.id}>
                      <button
                        className="dashboard-action flex min-h-16 w-full items-center gap-3 py-3 text-left"
                        onClick={() =>
                          linkedOrder
                            ? onNavigate({ screen: "order", id: linkedOrder.id })
                            : onNavigate({ screen: "calendar" })
                        }
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm">{event.title}</strong>
                          <span className="text-xs text-muted-foreground">
                            {formatEventTime(event.starts_at)}
                          </span>
                          {(vehicle || linkedOrder) && (
                            <span className="mt-0.5 block truncate text-xs font-medium text-slate-700">
                              {vehicle
                                ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`
                                : ""}
                              {vehicle && linkedOrder ? " · " : ""}
                              {linkedOrder?.id ?? ""}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function OperationalDashboard({
  orders,
  vehicles,
  customers,
  onNavigate,
  onNewOrder,
  onNewQuickOrder,
}: {
  orders: ServiceOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  onNavigate: (target: DashboardTarget) => void;
  onNewOrder: () => void;
  onNewQuickOrder: () => void;
}) {
  const { isLocalBypass } = useAuth();
  const queue = useMemo(() => orderQueue(orders), [orders]);
  const byVehicle = (order: ServiceOrder) => vehicles.find((item) => item.id === order.vehicleId);
  const byCustomer = (order: ServiceOrder) =>
    customers.find((item) => item.id === order.customerId);

  const context = [
    { label: "Aguardando aprovação", statuses: ["Aguardando aprovação"], icon: Clock3 },
    { label: "Aguardando peça", statuses: ["Aguardando peça"], icon: PackageCheck },
    { label: "Em diagnóstico", statuses: ["Em diagnóstico"], icon: Gauge },
    {
      label: "Prontos para retirada",
      statuses: ["Serviço concluído", "Aguardando retirada"],
      icon: CheckCircle2,
    },
  ].map((item) => ({
    ...item,
    orders: queue.filter(({ order }) => item.statuses.includes(order.status)),
  }));

  const openContext = (items: typeof queue) => {
    const first = items[0];
    if (items.length === 1 && first) {
      onNavigate({
        screen: "order",
        id: first.order.id,
        tab: first.workflow.nextAction.tab,
      });
      return;
    }
    onNavigate({ screen: "orders" });
  };

  return (
    <div className="dashboard-premium">
      <header className="mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Visão geral</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
            Central operacional
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Situação atual da oficina e caminhos diretos para o próximo passo.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            onClick={onNewQuickOrder}
            variant="outline"
            className="h-10 w-full gap-2 px-5 sm:w-auto"
          >
            <Sparkles className="h-4 w-4" /> OS Rápida
          </Button>
          <Button
            onClick={onNewOrder}
            className="create-order-action h-10 w-full gap-2 px-5 sm:w-auto"
          >
            <Plus className="h-4 w-4" /> Nova ordem de serviço
          </Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="order-2 min-w-0 xl:order-1" aria-labelledby="active-orders-title">
          <Card className="dashboard-surface overflow-hidden bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div>
                <h2 id="active-orders-title" className="text-lg font-bold">
                  Em atendimento
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {queue.length
                    ? plural(queue.length, "ordem ativa")
                    : "A oficina não tem ordens ativas neste momento."}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate({ screen: "orders" })}>
                Ver todas <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!queue.length ? (
              <div className="p-3">
                <div className="flex items-center gap-3 rounded-md border border-dashed bg-slate-50 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">Nenhum atendimento em andamento</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Uma nova OS aparecerá aqui assim que for registrada.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2.5 p-3 md:grid-cols-2 2xl:grid-cols-3">
                {queue.slice(0, 9).map(({ order, workflow }) => {
                  const vehicle = byVehicle(order);
                  const customer = byCustomer(order);
                  const Icon = statusIcon[order.status] ?? ClipboardList;
                  const blocker = relevantBlocker(order, workflow);
                  return (
                    <article
                      key={order.id}
                      className="dashboard-interactive flex min-w-0 flex-col rounded-md border bg-white p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={cn(
                            "grid h-9 w-9 place-items-center rounded-md border",
                            statusTone[order.status],
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("max-w-[11rem] truncate", statusTone[order.status])}
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <button
                        className="mt-3 min-h-10 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={() => vehicle && onNavigate({ screen: "vehicle", id: vehicle.id })}
                        disabled={!vehicle}
                      >
                        <strong className="block truncate text-base">
                          {vehicle ? `${vehicle.brand} ${vehicle.model}` : "Veículo não disponível"}
                        </strong>
                        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                          {vehicle?.plate ?? "Placa não informada"}
                        </span>
                      </button>
                      <button
                        className="mt-2 w-fit text-left text-xs font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        onClick={() =>
                          onNavigate({
                            screen: "order",
                            id: order.id,
                            tab: workflow.nextAction.tab,
                          })
                        }
                      >
                        {order.id} · abrir ordem
                      </button>
                      <dl className="mt-3 space-y-2 border-t pt-2.5 text-sm">
                        <div>
                          <dt className="text-xs text-muted-foreground">Responsável</dt>
                          <dd className="mt-0.5 font-medium">
                            {order.team.join(", ") || "Não definido"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Próxima ação</dt>
                          <dd className="mt-0.5 font-semibold">{workflow.nextAction.label}</dd>
                        </div>
                        {blocker && (
                          <div>
                            <dt className="text-xs text-muted-foreground">
                              {workflow.inconsistency ? "Atenção" : "Bloqueio / pendência"}
                            </dt>
                            <dd
                              className={cn(
                                "mt-0.5 text-xs font-medium",
                                workflow.inconsistency ? "text-rose-700" : "text-amber-800",
                              )}
                            >
                              {blocker}
                            </dd>
                          </div>
                        )}
                      </dl>
                      <Button
                        variant="outline"
                        className="mt-3 min-h-9 w-full justify-between"
                        onClick={() =>
                          onNavigate({
                            screen: "order",
                            id: order.id,
                            tab: workflow.nextAction.tab,
                          })
                        }
                      >
                        Resolver próxima ação <ChevronRight className="h-4 w-4" />
                      </Button>
                      {customer && (
                        <span className="mt-2 truncate text-center text-[11px] text-muted-foreground">
                          Cliente: {customer.name}
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        <section className="order-1 min-w-0 xl:order-2" aria-labelledby="next-actions-title">
          <Card className="dashboard-surface overflow-hidden border-primary/20 bg-white xl:sticky xl:top-20">
            <div className="border-b border-l-4 border-l-primary bg-primary/[.035] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="next-actions-title" className="text-lg font-bold">
                  Próximas ações
                </h2>
                <Badge className="bg-primary text-primary-foreground">
                  {plural(queue.length, "pendente")}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ordenadas por etapa do workflow, não por urgência ou atraso.
              </p>
            </div>
            {!queue.length ? (
              <div className="flex items-center gap-3 p-4 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-foreground">Tudo em dia</p>
                  <p className="text-xs text-muted-foreground">
                    Nenhuma ação operacional pendente.
                  </p>
                </div>
              </div>
            ) : (
              <ol className="divide-y">
                {queue.slice(0, 6).map(({ order, workflow }, index) => {
                  const vehicle = byVehicle(order);
                  const inconsistent = Boolean(workflow.inconsistency);
                  const ready = ["Serviço concluído", "Aguardando retirada"].includes(order.status);
                  return (
                    <li key={order.id}>
                      <button
                        onClick={() =>
                          onNavigate({
                            screen: "order",
                            id: order.id,
                            tab: workflow.nextAction.tab,
                          })
                        }
                        className="dashboard-action group flex min-h-18 w-full items-start gap-3 border-l-2 border-l-transparent px-4 py-3 text-left hover:border-l-primary"
                      >
                        <span
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-bold",
                            inconsistent
                              ? "border-rose-300 bg-rose-50 text-rose-700"
                              : ready
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : "border-blue-200 bg-blue-50 text-primary",
                          )}
                        >
                          {inconsistent ? <AlertTriangle className="h-4 w-4" /> : index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block text-sm">{workflow.nextAction.label}</strong>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {vehicle
                              ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate} · ${order.id}`
                              : order.id}
                          </span>
                          <span
                            className={cn(
                              "mt-1 block text-[11px] font-semibold",
                              inconsistent
                                ? "text-rose-700"
                                : ready
                                  ? "text-emerald-700"
                                  : order.status.includes("Aguardando")
                                    ? "text-amber-700"
                                    : "text-primary",
                            )}
                          >
                            {workflow.inconsistency ? "Inconsistência real do fluxo" : order.status}
                          </span>
                          <span className="mt-1 block text-[11px] font-bold text-primary">
                            Abrir em {tabLabel[workflow.nextAction.tab] ?? "Resumo"}
                          </span>
                        </span>
                        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            {queue.length > 6 && (
              <Button
                variant="ghost"
                className="w-full rounded-none border-t"
                onClick={() => onNavigate({ screen: "orders" })}
              >
                Ver todas as ações ({queue.length}) <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </Card>
        </section>
      </div>

      <section className="order-3 mt-4" aria-labelledby="day-context-title">
        <Card className="dashboard-surface bg-white">
          <CardContent className="p-4">
            <h2 id="day-context-title" className="text-lg font-bold">
              Contexto do dia
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estados operacionais das ordens ativas.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {context.map((item, index) => (
                <button
                  key={item.label}
                  onClick={() => openContext(item.orders)}
                  className={cn(
                    "dashboard-context flex min-h-14 items-center gap-2.5 rounded-md border bg-slate-50 px-3 py-2 text-left",
                    index < 2 && "border-l-2 border-l-amber-400",
                    index === 2 && "border-l-2 border-l-blue-500",
                    index === 3 && "border-l-2 border-l-emerald-500",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white shadow-sm",
                      index < 2 && "text-amber-700",
                      index === 2 && "text-primary",
                      index === 3 && "text-emerald-700",
                    )}
                  >
                    <item.icon className="h-4.5 w-4.5" />
                  </span>
                  <span>
                    <strong className="block text-lg leading-none tabular-nums">
                      {item.orders.length}
                    </strong>
                    <span className="block text-xs text-muted-foreground">{item.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="order-4 mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]">
        <TodayPanel
          localOnly={isLocalBypass}
          orders={orders}
          vehicles={vehicles}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Bike,
  CalendarDays,
  Camera,
  CarFront,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  Gauge,
  History,
  Eye,
  ImagePlus,
  LayoutDashboard,
  Menu,
  MessageCircle,
  PackageCheck,
  Phone,
  Play,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Video,
  WalletCards,
  Wrench,
  AlertTriangle,
  Settings2,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { TeamSettings } from "@/features/auth/team-settings";
import { InviteForm } from "@/features/auth/invite-form";
import { UserMenu } from "@/features/auth/user-menu";
import { CalendarScreen } from "@/features/platform/calendar-screen";
import { ChatWidget } from "@/features/platform/chat-widget";
import { NotificationBell } from "@/features/platform/notification-bell";
import { cn } from "@/lib/utils";
import { WorkshopSettings } from "./workshop-settings";
import { WorkshopIdentity } from "./workshop-document-header";
import { defaultWorkshop, readWorkshop, type Workshop } from "./workshop-data";
import { FinalOrderSummary } from "./final-order-summary";
import {
  formatDate,
  logicallyDeleteCustomer,
  logicallyDeleteVehicle,
  money,
  orderStatuses,
  type ApprovalStatus,
  type Customer,
  type OrderActivity,
  type ServiceOrder,
  type Vehicle,
} from "./pilot-data";
import { createOperationalRepository } from "./operational-repository";
import {
  isBasicCpfValid,
  isBasicEmailValid,
  nextOrderId,
  normalizeCpf,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizePlate,
} from "./pilot-validation";
import {
  evaluateOrderWorkflow,
  getWorkflowReversal,
  getStatusPrerequisites,
  reverseOrderWorkflow,
  type WorkflowAction,
  type WorkflowReversalPlan,
} from "./pilot-workflow";

type OrderUpdater = (current: ServiceOrder) => ServiceOrder;
type PendingWorkflowConfirmation = {
  title: string;
  description: string;
  onConfirm: () => void;
};

const orderTimestamp = () => new Date().toISOString();

const migrateOrder = (order: ServiceOrder): ServiceOrder => {
  const createdAt = `${order.openedAt}T12:00:00-03:00`;
  return {
    ...order,
    statusHistory: order.statusHistory ?? [],
    activities: order.activities ?? [
      { id: `a-${order.id}-created`, type: "created", description: "OS criada", at: createdAt },
    ],
    updatedAt: order.updatedAt ?? createdAt,
  };
};

const withActivity = (
  order: ServiceOrder,
  type: OrderActivity["type"],
  description: string,
  patch: Partial<ServiceOrder> = {},
) => {
  const at = orderTimestamp();
  return {
    ...order,
    ...patch,
    activities: [
      ...(order.activities ?? []),
      { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, description, at },
    ],
    updatedAt: at,
  };
};

const withStatusTransition = (
  order: ServiceOrder,
  status: ServiceOrder["status"],
  description: string,
  completion = false,
  workshop?: Workshop,
) => {
  if (order.status === status) return order;
  const at = orderTimestamp();
  return {
    ...withActivity(order, "status", description, {
      status,
      ...(completion && !order.completedAt
        ? { completedAt: new Date().toISOString().slice(0, 10) }
        : {}),
      ...(completion && workshop && !order.workshopSnapshot
        ? { workshopSnapshot: { ...workshop } }
        : {}),
    }),
    statusHistory: [
      ...(order.statusHistory ?? []),
      { id: `s-${Date.now()}`, from: order.status, to: status, at },
    ],
  };
};

type Screen =
  | "dashboard"
  | "calendar"
  | "customers"
  | "vehicles"
  | "orders"
  | "customer"
  | "vehicle"
  | "order"
  | "settings";

const navItems = [
  { id: "dashboard" as Screen, label: "Visão geral", icon: LayoutDashboard },
  { id: "calendar" as Screen, label: "Agenda", icon: CalendarDays },
  { id: "customers" as Screen, label: "Clientes", icon: Users },
  { id: "vehicles" as Screen, label: "Veículos", icon: CarFront },
  { id: "orders" as Screen, label: "Ordens de serviço", icon: ClipboardList },
  { id: "settings" as Screen, label: "Configurações da oficina", icon: Settings2 },
];

const formatActivityDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const countOrdersByStatus = (orders: ServiceOrder[], statuses: ServiceOrder["status"][]) =>
  orders.filter((order) => statuses.includes(order.status)).length;

const statusStyles: Record<string, string> = {
  Recebido: "status-neutral",
  "Em diagnóstico": "status-active",
  "Aguardando aprovação": "status-warning",
  "Aguardando peça": "status-warning",
  "Em manutenção": "status-active",
  "Serviço concluído": "status-success",
  "Aguardando retirada": "status-warning",
  Entregue: "status-success",
  Aprovado: "status-success",
  Recusado: "status-error",
  Pago: "status-success",
  Pendente: "status-warning",
  ATIVA: "status-success",
  EXPIRADA: "status-neutral",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap", statusStyles[status] ?? statusStyles["Recebido"])}
    >
      {status}
    </Badge>
  );
}

function OrderProgress({
  order,
  onStep,
}: {
  order: ServiceOrder;
  onStep: (index: number) => void;
}) {
  const status = order.status;
  const currentStepIndex = orderStatuses.indexOf(status);
  return (
    <section
      className="order-progress mb-5 rounded-lg border bg-white p-4 md:p-5"
      aria-label="Progresso provisório da ordem de serviço"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fluxo da ordem
          </p>
          <p className="text-lg font-bold text-slate-900">
            Etapa {currentStepIndex + 1} de {orderStatuses.length}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-orange-700">{status}</p>
        </div>
        <span className="text-xs text-muted-foreground">Estados ainda sujeitos à validação</span>
      </div>
      <div className="relative overflow-x-auto pb-1">
        <div className="min-w-[760px] px-2">
          <div
            role="progressbar"
            aria-label={`Etapa ${currentStepIndex + 1} de ${orderStatuses.length}: ${status}`}
            aria-valuemin={1}
            aria-valuemax={orderStatuses.length}
            aria-valuenow={currentStepIndex + 1}
            className="grid grid-cols-8 items-center"
          >
            {orderStatuses.map((step, index) => {
              const completed = index < currentStepIndex;
              const current = index === currentStepIndex;
              return (
                <div key={step} className="relative flex justify-center">
                  {index < orderStatuses.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[calc(50%+0.875rem)] top-1/2 h-px w-[calc(100%-1.75rem)] -translate-y-1/2 overflow-hidden bg-slate-300"
                    >
                      <span
                        className={cn(
                          "block h-full origin-left bg-emerald-500 transition-transform duration-300 ease-out motion-reduce:transition-none",
                          index < currentStepIndex ? "scale-x-100" : "scale-x-0",
                        )}
                      />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onStep(index)}
                    aria-label={`${step}: ${completed ? "concluída" : current ? "atual" : "futura"}`}
                    className={cn(
                      "relative z-10 grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] font-bold transition-colors delay-300 duration-150 motion-reduce:delay-0 motion-reduce:transition-none",
                      completed && "border-emerald-600 bg-emerald-600 text-white",
                      current &&
                        "h-7 w-7 border-orange-500 bg-white text-orange-700 ring-4 ring-orange-100",
                      !completed && !current && "border-slate-300 bg-white text-slate-400",
                    )}
                  >
                    {completed ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-8 gap-2">
            {orderStatuses.map((step, index) => (
              <div key={step} className="text-center">
                <p
                  className={cn(
                    "text-[10px] leading-tight",
                    index < currentStepIndex && "font-semibold text-emerald-700",
                    index === currentStepIndex && "font-bold text-orange-700",
                    index > currentStepIndex && "text-muted-foreground",
                  )}
                >
                  {step}
                </p>
                <span className="sr-only">
                  {index < currentStepIndex
                    ? "Concluída"
                    : index === currentStepIndex
                      ? "Atual"
                      : "Futura"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function VehicleIcon({ kind, className }: { kind: Vehicle["kind"]; className?: string }) {
  const Icon = kind === "Moto" ? Bike : CarFront;
  return <Icon className={className} />;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="pilot-empty-state" role="status">
      <FileText aria-hidden="true" className="mx-auto h-6 w-6 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function PilotApp() {
  const { isLocalBypass } = useAuth();
  const repository = useMemo(() => createOperationalRepository(isLocalBypass), [isLocalBypass]);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const ordersRef = useRef(orders);
  const writeQueue = useRef(Promise.resolve());
  const writeFailed = useRef(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newVehicleOpen, setNewVehicleOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [workshop, setWorkshop] = useState<Workshop>(defaultWorkshop);

  useEffect(() => {
    setWorkshop(readWorkshop());
  }, []);

  useEffect(() => {
    let active = true;
    setDataLoading(true);
    setDataError("");
    void repository
      .load()
      .then((data) => {
        if (!active) return;
        setCustomers(data.customers);
        setVehicles(data.vehicles);
        setOrders(data.orders.map(migrateOrder));
        setSelectedCustomerId(data.customers[0]?.id ?? "");
        setSelectedVehicleId(data.vehicles[0]?.id ?? "");
        setSelectedOrderId(data.orders[0]?.id ?? "");
      })
      .catch(() => {
        if (active)
          setDataError("Não foi possível carregar os dados operacionais. Tente novamente.");
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository]);

  useEffect(() => {
    if (!notice || pendingWrites > 0) return;
    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice, pendingWrites]);

  const navigate = (next: Screen, id?: string) => {
    if (next === "customer" && id) setSelectedCustomerId(id);
    if (next === "vehicle" && id) setSelectedVehicleId(id);
    if (next === "order" && id) setSelectedOrderId(id);
    setScreen(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
  const activeCustomers = customers.filter((customer) => !customer.deletedAt);
  const activeVehicles = vehicles.filter(
    (vehicle) =>
      !vehicle.deletedAt && activeCustomers.some((customer) => customer.id === vehicle.customerId),
  );
  const operationalOrders = orders.filter(
    (order) =>
      activeCustomers.some((customer) => customer.id === order.customerId) &&
      activeVehicles.some((vehicle) => vehicle.id === order.vehicleId),
  );
  const persist = (operation: () => Promise<void>) => {
    if (writeFailed.current) return;
    setPendingWrites((count) => count + 1);
    writeQueue.current = writeQueue.current
      .then(async () => {
        if (writeFailed.current) return;
        try {
          await operation();
        } catch {
          writeFailed.current = true;
          setNotice("");
          setDataError(
            "Não foi possível confirmar a gravação. A OS pode ter mudado ou seu acesso pode ter expirado. Recarregue para conferir os dados salvos antes de continuar.",
          );
        }
      })
      .finally(() => setPendingWrites((count) => count - 1));
  };
  const updateOrder = (id: string, updater: OrderUpdater) => {
    if (writeFailed.current) return;
    const order = ordersRef.current.find((item) => item.id === id);
    if (!order) return;
    const updated = updater(order);
    ordersRef.current = ordersRef.current.map((item) => (item.id === id ? updated : item));
    setOrders(ordersRef.current);
    persist(() => repository.saveOrder(updated));
  };

  const globalResults = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const phoneTerm = normalizePhone(query);
    const plateTerm = normalizePlate(query);
    if (!term) return [];
    const customerResults = activeCustomers
      .filter(
        (customer) =>
          `${customer.name} ${customer.email}`.toLocaleLowerCase("pt-BR").includes(term) ||
          (phoneTerm.length >= 4 && normalizePhone(customer.phone).includes(phoneTerm)) ||
          (normalizeCpf(query).length > 0 &&
            customer.cpf &&
            normalizeCpf(customer.cpf).includes(normalizeCpf(query))),
      )
      .map((customer) => ({ type: "customer" as const, customer }));
    const vehicleResults = activeVehicles
      .filter((vehicle) => {
        const owner = customers.find((customer) => customer.id === vehicle.customerId);
        return (
          `${vehicle.brand} ${vehicle.model} ${owner?.name}`
            .toLocaleLowerCase("pt-BR")
            .includes(term) ||
          (plateTerm.length >= 3 && normalizePlate(vehicle.plate).includes(plateTerm)) ||
          (phoneTerm.length >= 4 && normalizePhone(owner?.phone ?? "").includes(phoneTerm))
        );
      })
      .map((vehicle) => ({ type: "vehicle" as const, vehicle }));
    const orderResults = orders
      .filter((order) => order.id.toLocaleLowerCase("pt-BR").includes(term))
      .map((order) => ({ type: "order" as const, order }));
    return [...orderResults, ...customerResults, ...vehicleResults].slice(0, 6);
  }, [query, activeVehicles, activeCustomers, customers, orders]);

  if (dataLoading) {
    return (
      <main className="grid min-h-screen place-items-center">Carregando dados operacionais…</main>
    );
  }

  if (dataError) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="font-semibold">{dataError}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="pilot-shell min-h-screen bg-[#f4f3ef]">
      <Sidebar
        active={screen}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigate}
        onReset={() => setResetOpen(true)}
        showDevelopmentTools={isLocalBypass}
      />
      {menuOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-[#f4f3ef]/95 px-4 backdrop-blur-sm md:px-8">
          <Button
            className="lg:hidden"
            size="icon"
            variant="outline"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 border-slate-300 bg-white pl-10 shadow-none"
              placeholder="Buscar cliente, placa, veículo ou OS..."
            />
            {query.trim() && globalResults.length === 0 && (
              <div
                className="absolute left-0 right-0 top-11 z-50 rounded-md border bg-white p-3 text-sm text-muted-foreground shadow-sm"
                role="status"
              >
                Nenhum resultado encontrado. Tente outro nome, placa ou número da OS.
              </div>
            )}
            {globalResults.length > 0 && (
              <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden border bg-white shadow-lg">
                {globalResults.map((result) => {
                  if (result.type === "order") {
                    const order = result.order;
                    const vehicle = vehicles.find((item) => item.id === order.vehicleId);
                    return (
                      <button
                        key={`order-${order.id}`}
                        onClick={() => {
                          setQuery("");
                          navigate("order", order.id);
                        }}
                        className="flex w-full items-center gap-3 border-b p-3 text-left last:border-0 hover:bg-orange-50"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white">
                          <ClipboardList className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Ordem de serviço
                          </span>
                          <strong className="block text-sm">{order.id}</strong>
                          <span className="text-xs text-muted-foreground">
                            {vehicle
                              ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`
                              : order.status}
                          </span>
                        </span>
                      </button>
                    );
                  }
                  if (result.type === "customer") {
                    const customer = result.customer;
                    return (
                      <button
                        key={`customer-${customer.id}`}
                        onClick={() => {
                          setQuery("");
                          navigate("customer", customer.id);
                        }}
                        className="flex w-full items-center gap-3 border-b p-3 text-left last:border-0 hover:bg-orange-50"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-100 text-orange-700">
                          <UserRound className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-orange-600">
                            Cliente
                          </span>
                          <strong className="block truncate text-sm">{customer.name}</strong>
                          <span className="text-xs text-muted-foreground">{customer.phone}</span>
                        </span>
                      </button>
                    );
                  }
                  const vehicle = result.vehicle;
                  const owner = customers.find((customer) => customer.id === vehicle.customerId);
                  return (
                    <button
                      key={`vehicle-${vehicle.id}`}
                      onClick={() => {
                        setQuery("");
                        navigate("vehicle", vehicle.id);
                      }}
                      className="flex w-full items-center gap-3 border-b p-3 text-left last:border-0 hover:bg-orange-50"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100">
                        <VehicleIcon kind={vehicle.kind} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {vehicle.kind}
                        </span>
                        <strong className="block text-sm">
                          {vehicle.brand} {vehicle.model} · {vehicle.plate}
                        </strong>
                        <span className="text-xs text-muted-foreground">{owner?.name}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {!isLocalBypass && <NotificationBell />}
          <UserMenu />
        </header>
        {pendingWrites > 0 && (
          <div className="pilot-action-feedback" role="status">
            Salvando alterações… Aguarde a confirmação.
          </div>
        )}
        {notice && pendingWrites === 0 && (
          <div
            className="pilot-action-feedback"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-400" />
            {notice}
          </div>
        )}
        <div className="mx-auto max-w-[1600px] p-4 md:p-7 lg:p-8">
          {screen === "settings" && (
            <>
              <WorkshopSettings
                key={JSON.stringify(workshop)}
                workshop={workshop}
                onSave={setWorkshop}
              />
              <section className="mt-7 rounded-lg border bg-white p-5 sm:p-6">
                <h2 className="font-semibold">Backup dos dados operacionais</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isLocalBypass
                    ? "Este ambiente usa dados locais de desenvolvimento isolados. O backup legado do piloto não é carregado automaticamente."
                    : "O backup JSON legado não inclui nem protege clientes, veículos ou ordens armazenados no Supabase. Backup cloud ainda não está disponível."}
                </p>
              </section>
              <TeamSettings />
            </>
          )}
          {screen === "calendar" &&
            (isLocalBypass ? (
              <p className="rounded-lg border bg-white p-6">Agenda cloud requer uma sessão real.</p>
            ) : (
              <CalendarScreen />
            ))}
          {screen === "dashboard" && (
            <Dashboard
              orders={operationalOrders}
              vehicles={activeVehicles}
              customers={activeCustomers}
              onNavigate={navigate}
              onNewOrder={() => setNewOrderOpen(true)}
            />
          )}
          {screen === "customers" && (
            <CustomersScreen
              customers={activeCustomers}
              vehicles={activeVehicles}
              orders={orders}
              onOpen={(id) => navigate("customer", id)}
              onNew={() => setNewOrderOpen(true)}
            />
          )}
          {screen === "vehicles" && (
            <VehiclesScreen
              vehicles={activeVehicles}
              customers={activeCustomers}
              orders={orders}
              onOpen={(id) => navigate("vehicle", id)}
              onNew={() => setNewOrderOpen(true)}
            />
          )}
          {screen === "orders" && (
            <OrdersScreen
              orders={orders}
              vehicles={vehicles}
              customers={customers}
              onOpen={(id) => navigate("order", id)}
              onNew={() => setNewOrderOpen(true)}
            />
          )}
          {screen === "customer" && (
            <CustomerDetail
              customer={customers.find((item) => item.id === selectedCustomerId)!}
              vehicles={vehicles.filter((item) => item.customerId === selectedCustomerId)}
              orders={orders}
              onBack={() => navigate("customers")}
              onVehicle={(id) => navigate("vehicle", id)}
              onOrder={(id) => navigate("order", id)}
              onDelete={() => {
                const at = orderTimestamp();
                const deleted = logicallyDeleteCustomer(
                  customers,
                  vehicles,
                  selectedCustomerId,
                  at,
                );
                persist(async () => {
                  await repository.deleteCustomer(selectedCustomerId, at);
                  setCustomers(deleted.customers);
                  setVehicles(deleted.vehicles);
                  setNotice("Cliente e veículos vinculados removidos das áreas operacionais");
                  navigate("customers");
                });
              }}
            />
          )}
          {screen === "vehicle" && (
            <VehicleDetail
              vehicle={vehicles.find((item) => item.id === selectedVehicleId)!}
              customer={customers.find(
                (item) =>
                  item.id ===
                  vehicles.find((vehicle) => vehicle.id === selectedVehicleId)?.customerId,
              )!}
              orders={orders.filter((item) => item.vehicleId === selectedVehicleId)}
              onBack={() => navigate("vehicles")}
              onCustomer={(id) => navigate("customer", id)}
              onOrder={(id) => navigate("order", id)}
              onNewOrder={() => setNewOrderOpen(true)}
              onDelete={() => {
                const at = orderTimestamp();
                persist(async () => {
                  await repository.deleteVehicle(selectedVehicleId, at);
                  setVehicles((current) => logicallyDeleteVehicle(current, selectedVehicleId, at));
                  setNotice("Veículo removido das áreas operacionais; histórico preservado");
                  navigate("vehicles");
                });
              }}
            />
          )}
          {screen === "order" && selectedOrder && (
            <OrderDetail
              order={selectedOrder}
              workshop={workshop}
              vehicle={vehicles.find((item) => item.id === selectedOrder.vehicleId)!}
              customer={customers.find((item) => item.id === selectedOrder.customerId)!}
              onBack={() => navigate("orders")}
              onVehicle={(id) => navigate("vehicle", id)}
              onUpdate={(updater) => updateOrder(selectedOrder.id, updater)}
              notify={setNotice}
            />
          )}
        </div>
      </main>
      <NewCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        customers={customers}
        onExisting={(id) => {
          setNewCustomerOpen(false);
          navigate("customer", id);
        }}
        onCreate={(customer) => {
          setCustomers((current) => [...current, customer]);
          setNewCustomerOpen(false);
          setNotice("Cliente criado para demonstração");
          navigate("customer", customer.id);
        }}
      />
      <NewVehicleDialog
        open={newVehicleOpen}
        onOpenChange={setNewVehicleOpen}
        customers={customers}
        vehicles={vehicles}
        onExisting={(id) => {
          setNewVehicleOpen(false);
          navigate("vehicle", id);
        }}
        onCreate={(vehicle) => {
          setVehicles((current) => [...current, vehicle]);
          setNewVehicleOpen(false);
          setNotice("Veículo criado para demonstração");
          navigate("vehicle", vehicle.id);
        }}
      />
      <NewOrderDialog
        open={newOrderOpen}
        onOpenChange={setNewOrderOpen}
        customers={activeCustomers}
        vehicles={activeVehicles}
        allCustomers={customers}
        allVehicles={vehicles}
        orders={orders}
        onCreate={async (bundle) => {
          await writeQueue.current;
          if (writeFailed.current) throw new Error("Recarregue os dados antes de criar outra OS.");
          await repository.createOrder(bundle).then((data) => {
            setCustomers(data.customers);
            setVehicles(data.vehicles);
            setOrders(data.orders.map(migrateOrder));
            const createdOrder = data.orders[0];
            setNewOrderOpen(false);
            setNotice("Ordem de serviço criada");
            if (createdOrder) navigate("order", createdOrder.id);
          });
        }}
      />
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar dados locais de desenvolvimento?</DialogTitle>
            <DialogDescription>
              Clientes, veículos e ordens deste ambiente local isolado serão removidos. Os dados
              cloud não serão acessados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void repository.reset().then((data) => {
                  setCustomers(data.customers);
                  setVehicles(data.vehicles);
                  setOrders(data.orders);
                  setSelectedCustomerId("");
                  setSelectedVehicleId("");
                  setSelectedOrderId("");
                  setResetOpen(false);
                  setNotice("Dados locais removidos");
                  navigate("dashboard");
                });
              }}
            >
              Limpar dados locais
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {!isLocalBypass && <ChatWidget />}
    </div>
  );
}

function Sidebar({
  active,
  open,
  onClose,
  onNavigate,
  onReset,
  showDevelopmentTools,
}: {
  active: Screen;
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen) => void;
  onReset: () => void;
  showDevelopmentTools: boolean;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-[#17202d] text-white transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <button className="flex items-center gap-3" onClick={() => onNavigate("dashboard")}>
          <span
            className="brand-mark grid h-9 w-9 place-items-center rounded-md bg-orange-600"
            aria-hidden="true"
          >
            <Wrench className="h-5 w-5" />
          </span>
          <span className="text-left">
            <strong className="block text-lg tracking-tight">PitGarage</strong>
            <span className="text-xs text-slate-400">Piloto v0.1.15</span>
          </span>
        </button>
        <Button
          className="lg:hidden"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="space-y-1 px-3 py-4" aria-label="Navegação principal">
        <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Operação
        </p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "relative flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-transparent",
              active === item.id ||
                (item.id === "customers" && active === "customer") ||
                (item.id === "vehicles" && active === "vehicle") ||
                (item.id === "orders" && active === "order")
                ? "bg-white/8 text-white before:bg-orange-500"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon
              className={cn(
                "h-4.5 w-4.5",
                active === item.id ? "text-orange-400" : "text-slate-500",
              )}
            />
            {item.label}
          </button>
        ))}
      </nav>
      {showDevelopmentTools && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <div className="border-l-2 border-orange-500/70 bg-white/[.035] p-3">
            <p className="text-sm font-medium">Ambiente local isolado</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Dados de desenvolvimento, sem acesso ao ambiente cloud.
            </p>
            <button
              onClick={onReset}
              className="mt-3 flex items-center gap-2 text-xs font-semibold text-orange-300 hover:text-orange-200"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Limpar dados locais
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function PageTitle({
  eyebrow,
  title,
  text,
  action,
  back,
}: {
  eyebrow?: string;
  title: string;
  text: string;
  action?: ReactNode;
  back?: () => void;
}) {
  return (
    <div className="page-heading mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <button
            onClick={back}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        )}
        {eyebrow && (
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-600">
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{text}</p>
      </div>
      {action}
    </div>
  );
}

function Dashboard({
  orders,
  vehicles,
  customers,
  onNavigate,
  onNewOrder,
}: {
  orders: ServiceOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  onNavigate: (screen: Screen, id?: string) => void;
  onNewOrder: () => void;
}) {
  const activeOrders = orders.filter((order) => order.status !== "Entregue");
  const cards = [
    {
      label: "Na oficina",
      value: activeOrders.length,
      icon: CarFront,
      tone: "bg-slate-900 text-white",
    },
    {
      label: "Em diagnóstico",
      value: countOrdersByStatus(orders, ["Em diagnóstico"]),
      icon: Gauge,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Aguardando aprovação",
      value: countOrdersByStatus(orders, ["Aguardando aprovação"]),
      icon: Clock3,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Aguardando peça",
      value: countOrdersByStatus(orders, ["Aguardando peça"]),
      icon: PackageCheck,
      tone: "status-warning",
    },
    {
      label: "Em manutenção",
      value: countOrdersByStatus(orders, ["Em manutenção"]),
      icon: Wrench,
      tone: "status-active",
    },
    {
      label: "Prontos para retirada",
      value: countOrdersByStatus(orders, ["Serviço concluído", "Aguardando retirada"]),
      icon: CheckCircle2,
      tone: "status-success",
    },
  ];
  const pendingValue = orders
    .flatMap((o) => o.budget)
    .filter((item) => item.approval === "Aguardando aprovação")
    .reduce((sum, item) => sum + item.price, 0);
  return (
    <>
      <PageTitle
        eyebrow="Visão geral da oficina"
        title="Bom trabalho, equipe."
        text="Aqui está o ritmo da oficina neste momento."
        action={
          <Button
            onClick={onNewOrder}
            className="h-10 gap-2 bg-orange-600 px-5 hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" /> Criar ordem de serviço
          </Button>
        }
      />
      <section className="grid grid-cols-2 gap-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate("orders")}
            className="border border-slate-200 bg-white text-left transition-colors hover:border-orange-300 hover:bg-orange-50/30"
          >
            <CardContent className="flex min-w-0 items-center gap-3 p-3.5 sm:p-4">
              <div className={cn("grid h-9 w-9 place-items-center rounded-md", item.tone)}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-xl tracking-tight">{item.value}</strong>
                <span className="block text-[11px] leading-tight text-muted-foreground sm:text-xs">
                  {item.label}
                </span>
              </div>
            </CardContent>
          </button>
        ))}
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden bg-white">
          <div className="flex items-center justify-between border-b p-4 md:px-5">
            <div>
              <h2 className="text-lg font-bold">Serviços em andamento</h2>
              <p className="text-sm text-muted-foreground">Prioridades e últimas movimentações</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => onNavigate("orders")}
              className="gap-1 text-orange-600"
            >
              Ver todas <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <div className="pilot-table-header hidden grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)_150px_24px] px-5 md:grid">
              <span>Veículo</span>
              <span>Placa</span>
              <span>Cliente</span>
              <span>Status</span>
              <span />
            </div>
            {activeOrders.length === 0 && (
              <EmptyState
                title={orders.length ? "Nenhuma OS ativa" : "Nenhuma ordem de serviço cadastrada"}
                text="Use Criar ordem de serviço para registrar um atendimento. Cliente e veículo são cadastrados no mesmo fluxo."
              />
            )}
            {activeOrders.slice(0, 5).map((order) => {
              const vehicle = vehicles.find((v) => v.id === order.vehicleId)!;
              const customer = customers.find((c) => c.id === order.customerId)!;
              return (
                <button
                  key={order.id}
                  onClick={() => onNavigate("order", order.id)}
                  className="pilot-table-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-3 text-left md:grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)_150px_24px] md:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
                      <VehicleIcon kind={vehicle.kind} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">
                        {vehicle.brand} {vehicle.model} {vehicle.year}
                      </strong>
                      <p className="truncate text-xs text-muted-foreground">{order.id}</p>
                    </div>
                  </div>
                  <span className="hidden font-mono text-xs font-semibold md:block">
                    {vehicle.plate}
                  </span>
                  <span className="hidden truncate text-sm md:block">{customer.name}</span>
                  <div className="hidden md:block">
                    <StatusBadge status={order.status} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </Card>
        <Card className="attention-panel border-slate-800 bg-slate-900 text-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
                  Atenção agora
                </p>
                <h2 className="mt-2 text-xl font-bold">
                  {orders.some((order) =>
                    order.budget.some((item) => item.approval === "Aguardando aprovação"),
                  )
                    ? "Aprovações pendentes"
                    : "Nenhuma aprovação pendente"}
                </h2>
              </div>
              <Clock3 className="h-6 w-6 text-orange-400" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {orders.some((order) =>
                order.budget.some((item) => item.approval === "Aguardando aprovação"),
              )
                ? `Há ${money(pendingValue)} em itens aguardando retorno dos clientes.`
                : "Quando um orçamento precisar de aprovação, ele aparecerá aqui."}
            </p>
            <div className="mt-6 space-y-3">
              {orders
                .filter((o) => o.budget.some((i) => i.approval === "Aguardando aprovação"))
                .slice(0, 2)
                .map((order) => {
                  const vehicle = vehicles.find((v) => v.id === order.vehicleId)!;
                  return (
                    <button
                      key={order.id}
                      onClick={() => onNavigate("order", order.id)}
                      className="w-full border-l-2 border-orange-500 bg-white/[.055] p-3 text-left hover:bg-white/10"
                    >
                      <p className="text-sm font-semibold">
                        {vehicle.brand} {vehicle.model} · {vehicle.plate}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{order.id} · revisar orçamento</p>
                    </button>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function CustomersScreen({
  customers,
  vehicles,
  orders,
  onOpen,
  onNew,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
  orders: ServiceOrder[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState("");
  const visible = customers.filter((c) =>
    `${c.name} ${c.phone}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="Relacionamento"
        title="Clientes"
        text="Encontre rapidamente quem chegou à oficina e os veículos relacionados."
        action={
          <Button onClick={onNew} className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4" /> Criar ordem de serviço
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Clientes ativos", customers.length],
          [
            "Com veículos",
            customers.filter((customer) =>
              vehicles.some((vehicle) => vehicle.customerId === customer.id),
            ).length,
          ],
          [
            "Com OS em aberto",
            customers.filter((customer) =>
              orders.some(
                (order) => order.customerId === customer.id && order.status !== "Entregue",
              ),
            ).length,
          ],
          ["Veículos vinculados", vehicles.length],
        ].map(([label, value]) => (
          <Card key={label} className="bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <strong className="mt-1 block text-2xl">{value}</strong>
          </Card>
        ))}
      </div>
      <div className="mb-5 max-w-md">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-11 rounded-xl bg-white"
          placeholder="Pesquisar por nome ou telefone"
        />
      </div>
      <div className="pilot-table">
        <div className="pilot-table-header grid-cols-[minmax(0,1.4fr)_190px_160px_120px_28px] px-4 md:grid">
          <span>Cliente</span>
          <span>Contato</span>
          <span>Relacionamento</span>
          <span>Veículos</span>
          <span />
        </div>
        {visible.length === 0 && (
          <div>
            <EmptyState
              title={customers.length ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              text={
                customers.length
                  ? "Tente outro nome ou telefone."
                  : "Comece por Criar ordem de serviço para cadastrar o primeiro cliente."
              }
            />
          </div>
        )}
        {visible.map((customer) => {
          const related = vehicles.filter((v) => v.customerId === customer.id);
          return (
            <button
              key={customer.id}
              onClick={() => onOpen(customer.id)}
              className="pilot-table-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-3 text-left md:grid-cols-[minmax(0,1.4fr)_190px_160px_120px_28px] md:px-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-orange-100 text-sm font-bold text-orange-700">
                  {customer.name
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")}
                </div>
                <h2 className="truncate font-bold">{customer.name}</h2>
              </div>
              <p className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </p>
              <span className="hidden text-sm text-muted-foreground md:block">
                Desde {customer.since}
              </span>
              <span className="hidden text-sm font-semibold md:block">
                {related.length} veículo{related.length !== 1 && "s"}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          );
        })}
      </div>
    </>
  );
}

function VehiclesScreen({
  vehicles,
  customers,
  orders,
  onOpen,
  onNew,
}: {
  vehicles: Vehicle[];
  customers: Customer[];
  orders: ServiceOrder[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState("");
  const visible = vehicles.filter((v) =>
    `${v.brand} ${v.model} ${v.plate} ${customers.find((c) => c.id === v.customerId)?.name}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="Histórico centralizado"
        title="Veículos"
        text="Carros e motos com informações, serviços atuais e histórico em um só lugar."
        action={
          <Button onClick={onNew} className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4" /> Criar ordem de serviço
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Veículos ativos", vehicles.length],
          ["Carros", vehicles.filter((vehicle) => vehicle.kind === "Carro").length],
          ["Motos", vehicles.filter((vehicle) => vehicle.kind === "Moto").length],
          [
            "Com OS em aberto",
            vehicles.filter((vehicle) =>
              orders.some((order) => order.vehicleId === vehicle.id && order.status !== "Entregue"),
            ).length,
          ],
        ].map(([label, value]) => (
          <Card key={label} className="bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <strong className="mt-1 block text-2xl">{value}</strong>
          </Card>
        ))}
      </div>
      <div className="mb-5 max-w-md">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-11 rounded-xl bg-white"
          placeholder="Pesquisar placa, modelo ou proprietário"
        />
      </div>
      <div className="pilot-table">
        <div className="pilot-table-header grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)_130px_160px_28px] px-4 md:grid">
          <span>Veículo</span>
          <span>Placa</span>
          <span>Proprietário</span>
          <span>Tipo</span>
          <span>Status</span>
          <span />
        </div>
        {visible.length === 0 && (
          <div>
            <EmptyState
              title={vehicles.length ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado"}
              text={
                vehicles.length
                  ? "Tente outra placa, modelo ou proprietário."
                  : "Cadastre o primeiro veículo ao criar uma ordem de serviço."
              }
            />
          </div>
        )}
        {visible.map((vehicle) => {
          const owner = customers.find((c) => c.id === vehicle.customerId)!;
          const current = orders.find((o) => o.vehicleId === vehicle.id && o.status !== "Entregue");
          return (
            <button
              key={vehicle.id}
              onClick={() => onOpen(vehicle.id)}
              className="pilot-table-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-3 text-left md:grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)_130px_160px_28px] md:px-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-900 text-white">
                  <VehicleIcon kind={vehicle.kind} className="h-6 w-6" />
                </div>
                <span className="min-w-0">
                  <strong className="block truncate">
                    {vehicle.brand} {vehicle.model}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {vehicle.year} · {vehicle.color} · {vehicle.mileage.toLocaleString("pt-BR")} km
                  </span>
                </span>
              </div>
              <span className="hidden font-mono text-xs font-semibold md:block">
                {vehicle.plate}
              </span>
              <span className="hidden truncate text-sm md:block">{owner.name}</span>
              <span className="hidden text-sm md:block">{vehicle.kind}</span>
              <span className="hidden md:block">
                {current ? (
                  <StatusBadge status={current.status} />
                ) : (
                  <Badge variant="outline">Sem OS atual</Badge>
                )}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          );
        })}
      </div>
    </>
  );
}

function OrdersScreen({
  orders,
  vehicles,
  customers,
  onOpen,
  onNew,
}: {
  orders: ServiceOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState("Todas");
  const visible = filter === "Todas" ? orders : orders.filter((o) => o.status === filter);
  return (
    <>
      <PageTitle
        eyebrow="Núcleo operacional"
        title="Ordens de serviço"
        text="Acompanhe diagnóstico, aprovação, execução e entrega sem perder o histórico."
        action={
          <Button onClick={onNew} className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4" /> Criar ordem de serviço
          </Button>
        }
      />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b pb-0">
        {["Todas", ...orderStatuses].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              "whitespace-nowrap border-b-2 border-x-0 border-t-0 px-3 py-2.5 text-xs font-semibold",
              filter === status
                ? "border-orange-600 bg-orange-50/60 text-orange-800"
                : "border-transparent bg-transparent text-muted-foreground hover:text-slate-900",
            )}
          >
            {status}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden bg-white">
        <div>
          <div className="pilot-table-header hidden grid-cols-[90px_1.2fr_1fr_160px_120px_24px] px-6 md:grid">
            <span>OS</span>
            <span>Veículo</span>
            <span>Cliente</span>
            <span>Status</span>
            <span className="text-right">Valor</span>
            <span />
          </div>
          {visible.length === 0 && (
            <EmptyState
              title={orders.length ? "Nenhuma OS neste estado" : "Nenhuma ordem de serviço"}
              text={
                orders.length
                  ? "Escolha outro filtro para consultar as ordens."
                  : "Crie uma ordem de serviço para registrar o primeiro atendimento."
              }
            />
          )}
          {visible.map((order) => {
            const vehicle = vehicles.find((v) => v.id === order.vehicleId)!;
            const customer = customers.find((c) => c.id === order.customerId)!;
            const total = order.budget.reduce((sum, item) => sum + item.price, 0);
            return (
              <button
                key={order.id}
                onClick={() => onOpen(order.id)}
                className="pilot-table-row grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 p-3 text-left md:grid-cols-[90px_1.2fr_1fr_160px_120px_24px] md:px-6"
              >
                <strong className="hidden text-sm md:block">{order.id}</strong>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100">
                    <VehicleIcon kind={vehicle.kind} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">
                      {vehicle.brand} {vehicle.model}
                    </strong>
                    <span className="text-xs text-muted-foreground">{vehicle.plate}</span>
                  </span>
                </div>
                <span className="hidden truncate text-sm md:block">{customer.name}</span>
                <span className="hidden md:block">
                  <StatusBadge status={order.status} />
                </span>
                <strong className="hidden text-right text-sm tabular-nums md:block">
                  {money(total)}
                </strong>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function CustomerDetail({
  customer,
  vehicles,
  orders,
  onBack,
  onVehicle,
  onOrder,
  onDelete,
}: {
  customer: Customer;
  vehicles: Vehicle[];
  orders: ServiceOrder[];
  onBack: () => void;
  onVehicle: (id: string) => void;
  onOrder: (id: string) => void;
  onDelete: () => void;
}) {
  const { accessLevel, isLocalBypass } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const relatedOrders = orders.filter((o) => o.customerId === customer.id);
  return (
    <>
      <PageTitle
        back={onBack}
        eyebrow="Cliente"
        title={customer.name}
        text={`${customer.phone} · ${customer.email}`}
        action={
          customer.deletedAt ? (
            <Badge variant="outline">Cliente excluído</Badge>
          ) : (
            <Button
              variant="outline"
              className="gap-2 text-rose-700"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> Excluir cliente
            </Button>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {accessLevel === "owner" && !isLocalBypass && (
          <section className="rounded-lg border bg-white p-5 xl:col-span-2">
            <h2 className="font-semibold">
              {customer.authUserId ? "Conta vinculada" : "Sem conta"}
            </h2>
            {!customer.authUserId && customer.email && (
              <InviteForm initialEmail={customer.email} fullName={customer.name} />
            )}
          </section>
        )}
        <section>
          <h2 className="mb-3 text-lg font-bold">Veículos relacionados</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {vehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                onClick={() => onVehicle(vehicle.id)}
                className="flex items-center gap-4 rounded-2xl border bg-white p-5 text-left hover:border-orange-200"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-white">
                  <VehicleIcon kind={vehicle.kind} className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <strong className="block">
                    {vehicle.brand} {vehicle.model} {vehicle.year}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    {vehicle.plate} · {vehicle.mileage.toLocaleString("pt-BR")} km
                  </span>
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </div>
        </section>
        <Card className="border-0 bg-white">
          <CardContent className="p-6">
            <h2 className="font-bold">Atendimentos recentes</h2>
            <div className="mt-4 space-y-3">
              {relatedOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => onOrder(order.id)}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-3 text-left"
                >
                  <span>
                    <strong className="block text-sm">{order.id}</strong>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(order.openedAt)}
                    </span>
                  </span>
                  <StatusBadge status={order.status} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cliente das áreas operacionais?</DialogTitle>
            <DialogDescription>
              {customer.name} e seus {vehicles.length} veículo(s) deixarão de aparecer nas listagens
              e na Nova OS. As ordens e todo o histórico permanecerão identificáveis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              Confirmar exclusão lógica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VehicleDetail({
  vehicle,
  customer,
  orders,
  onBack,
  onCustomer,
  onOrder,
  onNewOrder,
  onDelete,
}: {
  vehicle: Vehicle;
  customer: Customer;
  orders: ServiceOrder[];
  onBack: () => void;
  onCustomer: (id: string) => void;
  onOrder: (id: string) => void;
  onNewOrder: () => void;
  onDelete: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const current = orders.find((o) => o.status !== "Entregue");
  return (
    <>
      <PageTitle
        back={onBack}
        eyebrow={vehicle.kind}
        title={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
        text={`${vehicle.plate} · ${vehicle.mileage.toLocaleString("pt-BR")} km · ${vehicle.color}`}
        action={
          <div className="flex flex-wrap gap-2">
            {vehicle.deletedAt ? (
              <Badge variant="outline">Veículo excluído</Badge>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="gap-2 text-rose-700"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" /> Excluir veículo
                </Button>
                <Button
                  onClick={onNewOrder}
                  className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600"
                >
                  <Plus className="h-4 w-4" /> Criar ordem de serviço
                </Button>
              </>
            )}
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="border-0 bg-slate-900 text-white">
            <CardContent className="p-6">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-500">
                <VehicleIcon kind={vehicle.kind} className="h-7 w-7" />
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-400">Placa</dt>
                  <dd className="mt-1 font-mono font-bold">{vehicle.plate}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Ano</dt>
                  <dd className="mt-1 font-bold">{vehicle.year}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Quilometragem</dt>
                  <dd className="mt-1 font-bold">{vehicle.mileage.toLocaleString("pt-BR")} km</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Cor</dt>
                  <dd className="mt-1 font-bold">{vehicle.color}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <button
            onClick={() => onCustomer(customer.id)}
            className="flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-orange-100 font-semibold text-orange-700">
              {customer.name[0]}
            </span>
            <span className="flex-1">
              <span className="block text-xs text-muted-foreground">Proprietário</span>
              <strong className="text-sm">{customer.name}</strong>
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <section>
          {current && (
            <button
              onClick={() => onOrder(current.id)}
              className="mb-6 w-full rounded-2xl border border-orange-200 bg-orange-50 p-5 text-left"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-orange-700">
                    Ordem atual · {current.id}
                  </p>
                  <h2 className="mt-1 font-bold">{current.complaint}</h2>
                </div>
                <StatusBadge status={current.status} />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Wrench className="h-4 w-4" />
                Responsáveis: {current.team.join(", ") || "A definir"}
              </p>
            </button>
          )}
          <h2 className="mb-4 text-xl font-bold">Histórico do veículo</h2>
          {orders.length === 0 && (
            <EmptyState
              title="Nenhum histórico encontrado"
              text="A primeira ordem deste veículo aparecerá aqui."
            />
          )}
          <div className="relative ml-3 space-y-4 border-l-2 border-slate-200 pl-7">
            {orders.map((order) => {
              const total = order.budget
                .filter((i) => i.approval === "Aprovado")
                .reduce((sum, i) => sum + i.price, 0);
              const warrantyEnd = order.completedAt
                ? new Date(`${order.completedAt}T12:00:00Z`)
                : null;
              if (warrantyEnd) warrantyEnd.setUTCDate(warrantyEnd.getUTCDate() + 30);
              const warrantyActive = warrantyEnd && warrantyEnd >= new Date("2026-09-01T12:00:00Z");
              return (
                <button
                  key={order.id}
                  onClick={() => onOrder(order.id)}
                  className="relative w-full rounded-2xl border bg-white p-5 text-left hover:border-orange-200"
                >
                  <span className="absolute -left-[37px] top-6 h-4 w-4 rounded-full border-4 border-[#f6f4ef] bg-orange-500" />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-orange-600">
                        {formatDate(order.openedAt)} · {order.entryMileage.toLocaleString("pt-BR")}{" "}
                        km
                      </p>
                      <h3 className="mt-1 font-bold">
                        {order.id} · {order.complaint}
                      </h3>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-4 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Diagnóstico</span>
                      <p className="line-clamp-2 font-medium">
                        {order.diagnosis || "Ainda não registrado"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Serviços e peças</span>
                      <p className="line-clamp-2 font-medium">
                        {order.budget
                          .filter((i) => i.approval === "Aprovado")
                          .map((i) => i.name)
                          .join(", ") || "Sem itens aprovados"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Responsáveis</span>
                      <p className="font-medium">{order.team.join(", ") || "A definir"}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Valor e garantia</span>
                      <p className="font-bold">{money(total)}</p>
                      <p
                        className={cn(
                          "mt-1 text-xs font-semibold",
                          warrantyActive ? "text-emerald-700" : "text-muted-foreground",
                        )}
                      >
                        {warrantyEnd
                          ? warrantyActive
                            ? "Garantia ativa"
                            : "Garantia expirada"
                          : "Garantia após conclusão"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir veículo das áreas operacionais?</DialogTitle>
            <DialogDescription>
              {vehicle.brand} {vehicle.model} deixará de aparecer nas listagens e na Nova OS. Todas
              as ordens anteriores permanecerão preservadas e identificáveis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              Confirmar exclusão lógica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrderDetail({
  order,
  workshop,
  vehicle,
  customer,
  onBack,
  onVehicle,
  onUpdate,
  notify,
}: {
  order: ServiceOrder;
  workshop: Workshop;
  vehicle: Vehicle;
  customer: Customer;
  onBack: () => void;
  onVehicle: (id: string) => void;
  onUpdate: (updater: OrderUpdater) => void;
  notify: (text: string) => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [manualStatusOpen, setManualStatusOpen] = useState(false);
  const [manualStatus, setManualStatus] = useState<ServiceOrder["status"]>(order.status);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingWorkflowConfirmation>();
  const [reversalPlan, setReversalPlan] = useState<WorkflowReversalPlan>();
  const [futureMessage, setFutureMessage] = useState("");
  const workflow = evaluateOrderWorkflow(order);
  const availableReversal = getWorkflowReversal(order);
  const approved = order.budget
    .filter((item) => item.approval === "Aprovado")
    .reduce((sum, item) => sum + item.price, 0);
  const total = order.budget.reduce((sum, item) => sum + item.price, 0);
  const waitingApprovalCount = order.budget.filter(
    (item) => item.approval === "Aguardando aprovação",
  ).length;
  const updateItem = (id: string, patch: Partial<ServiceOrder["budget"][number]>) =>
    onUpdate((current) => {
      const item = current.budget.find((entry) => entry.id === id);
      const budget = current.budget.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      );
      if (typeof patch.executed === "boolean") {
        return withActivity(
          current,
          "execution",
          `${item?.name ?? "Serviço"} marcado como ${patch.executed ? "executado" : "pendente"}`,
          { budget },
        );
      }
      return { ...current, budget };
    });
  const warrantyEnd = order.completedAt ? new Date(`${order.completedAt}T12:00:00Z`) : null;
  if (warrantyEnd) warrantyEnd.setUTCDate(warrantyEnd.getUTCDate() + 30);
  const transitionStatus = (
    status: ServiceOrder["status"],
    description: string,
    completion = false,
  ) =>
    onUpdate((current) =>
      withStatusTransition(
        current,
        status,
        description,
        completion,
        completion ? workshop : undefined,
      ),
    );
  const executeAction = (action: WorkflowAction) => {
    setActiveTab(action.tab);
    if (!action.targetStatus) return;
    const descriptions: Partial<Record<WorkflowAction["id"], string>> = {
      "start-diagnosis": `Fluxo iniciado: ${order.status} → ${action.targetStatus}`,
      "submit-approval": `Orçamento colocado em aprovação: ${order.status} → ${action.targetStatus}`,
      "resolve-parts": `Peça pendente identificada: ${order.status} → ${action.targetStatus}`,
      "start-maintenance": `Peças necessárias disponíveis: ${order.status} → ${action.targetStatus}`,
      "complete-service": `Serviço concluído: ${order.status} → ${action.targetStatus}`,
      "prepare-pickup": `Veículo preparado para retirada: ${order.status} → ${action.targetStatus}`,
      "confirm-delivery": `Entrega confirmada: ${order.status} → ${action.targetStatus}`,
    };
    transitionStatus(
      action.targetStatus,
      descriptions[action.id] ?? `Fluxo atualizado: ${order.status} → ${action.targetStatus}`,
      action.id === "complete-service",
    );
    notify(action.label);
  };
  const requestAction = (action: WorkflowAction) => {
    if (!action.confirmation) return executeAction(action);
    setPendingConfirmation({
      title: action.label,
      description: action.confirmation,
      onConfirm: () => executeAction(action),
    });
  };
  return (
    <>
      <PageTitle
        back={onBack}
        eyebrow={`Ordem de serviço · ${order.id}`}
        title={`${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`}
        text={`${customer.name} · entrada com ${order.entryMileage.toLocaleString("pt-BR")} km`}
        action={
          <div className="flex min-w-52 flex-col items-end gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Status atual · provisório
            </span>
            <StatusBadge status={order.status} />
            {["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status) && (
              <Button variant="outline" size="sm" onClick={() => setSummaryOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Resumo final
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="gap-2 text-muted-foreground"
              onClick={() => {
                setManualStatus(order.status);
                setManualStatusOpen(true);
              }}
            >
              <Settings2 className="h-4 w-4" /> Ajustar status manualmente
            </Button>
          </div>
        }
      />
      <div className="order-metadata mb-5 flex flex-wrap gap-2">
        <FinalOrderSummary
          order={order}
          customer={customer}
          vehicle={vehicle}
          workshop={order.workshopSnapshot ?? workshop}
          open={
            summaryOpen &&
            ["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status)
          }
          onOpenChange={setSummaryOpen}
        />
        {customer.deletedAt && <Badge variant="outline">Cliente excluído</Badge>}
        {vehicle.deletedAt && <Badge variant="outline">Veículo excluído</Badge>}
        <Badge variant="outline" className="bg-white">
          Responsáveis: {order.team.join(", ") || "A definir"}
        </Badge>
        <Badge variant="outline" className="bg-white">
          Aberta em {formatDate(order.openedAt)}
        </Badge>
        <Badge variant="outline" className="bg-white">
          Última atualização:{" "}
          {formatActivityDate(order.updatedAt ?? `${order.openedAt}T12:00:00-03:00`)}
        </Badge>
      </div>
      <dl
        className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4"
        aria-label="Valores da ordem"
      >
        {[
          ["Orçado", money(total)],
          ["Aprovado", money(approved)],
          ["Pago", money(order.payment?.status === "Pago" ? order.payment.amount : 0)],
          [
            "Saldo aprovado",
            money(
              Math.max(approved - (order.payment?.status === "Pago" ? order.payment.amount : 0), 0),
            ),
          ],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <OrderProgress
        order={order}
        onStep={(index) => {
          if (index === workflow.currentIndex) {
            requestAction(workflow.nextAction);
            return;
          }
          if (index > workflow.currentIndex) {
            const target = orderStatuses[index];
            if (!target) return;
            const missing = getStatusPrerequisites(order, target);
            setFutureMessage(
              missing.length
                ? `Antes de chegar a “${target}”, é necessário ${missing.join(", ")}.`
                : `A etapa “${target}” deve ser alcançada pelas ações da OS.`,
            );
          }
        }}
      />
      {workflow.inconsistency && workflow.recommendedStatus && (
        <div className="mb-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-950">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="flex-1">
              <p className="font-bold">Inconsistência no fluxo</p>
              <p className="mt-1 text-sm">{workflow.inconsistency}</p>
              <Button
                size="sm"
                className="mt-3 bg-rose-700 hover:bg-rose-800"
                onClick={() => {
                  const target = workflow.recommendedStatus!;
                  setPendingConfirmation({
                    title: `Corrigir status para ${target}?`,
                    description: `A OS passará de ${order.status} para ${target}. A correção será registrada no histórico.`,
                    onConfirm: () =>
                      transitionStatus(
                        target,
                        `Correção de consistência: ${order.status} → ${target}`,
                      ),
                  });
                }}
              >
                Corrigir para {workflow.recommendedStatus}
              </Button>
            </div>
          </div>
        </div>
      )}
      {waitingApprovalCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <Clock3 className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="font-semibold">
            {waitingApprovalCount}{" "}
            {waitingApprovalCount === 1 ? "item aguardando" : "itens aguardando"} aprovação do
            cliente
          </p>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border-l-4 border-l-orange-500 bg-white p-4">
        <div className="mr-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Próxima ação
          </p>
          <p className="text-sm text-muted-foreground">Continue o atendimento pela ação ao lado.</p>
        </div>
        <Button
          className="bg-orange-500 hover:bg-orange-600"
          onClick={() => requestAction(workflow.nextAction)}
        >
          {workflow.nextAction.label}
        </Button>
        {availableReversal && (
          <Button
            variant="ghost"
            className="gap-2 text-muted-foreground"
            onClick={() => setReversalPlan(availableReversal)}
          >
            <RotateCcw className="h-4 w-4" /> Voltar etapa
          </Button>
        )}
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-white px-1">
          <TabsTrigger value="overview" className="gap-2 py-2">
            <ClipboardList className="h-4 w-4" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="diagnosis" className="gap-2 py-2">
            <Gauge className="h-4 w-4" />
            Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="budget" className="gap-2 py-2">
            <ReceiptText className="h-4 w-4" />
            Orçamento
          </TabsTrigger>
          <TabsTrigger value="execution" className="gap-2 py-2">
            <ClipboardCheck className="h-4 w-4" />
            Execução
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2 py-2">
            <WalletCards className="h-4 w-4" />
            Pagamento e garantia
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <OrderOverview
            order={order}
            vehicle={vehicle}
            customer={customer}
            onVehicle={onVehicle}
            approved={approved}
            total={total}
            onQuickAction={setActiveTab}
            workflow={workflow}
          />
        </TabsContent>
        <TabsContent value="diagnosis" className="mt-6">
          <DiagnosisPanel order={order} onUpdate={onUpdate} notify={notify} />
        </TabsContent>
        <TabsContent value="budget" className="mt-6">
          <BudgetPanel
            order={order}
            workshop={order.workshopSnapshot ?? workshop}
            vehicle={vehicle}
            customer={customer}
            updateItem={updateItem}
            onUpdate={onUpdate}
            notify={notify}
          />
        </TabsContent>
        <TabsContent value="execution" className="mt-6">
          <ExecutionPanel order={order} updateItem={updateItem} notify={notify} />
        </TabsContent>
        <TabsContent value="payment" className="mt-6">
          <PaymentPanel
            order={order}
            onUpdate={onUpdate}
            warrantyEnd={warrantyEnd}
            notify={notify}
          />
        </TabsContent>
      </Tabs>
      <Dialog
        open={Boolean(pendingConfirmation)}
        onOpenChange={(open) => !open && setPendingConfirmation(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingConfirmation?.title}</DialogTitle>
            <DialogDescription>{pendingConfirmation?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingConfirmation(undefined)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                pendingConfirmation?.onConfirm();
                setPendingConfirmation(undefined);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(reversalPlan)}
        onOpenChange={(open) => !open && setReversalPlan(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voltar para {reversalPlan?.to}?</DialogTitle>
            <DialogDescription>
              A OS voltará de {reversalPlan?.from} para {reversalPlan?.to}. Esta ação não poderá ser
              desfeita automaticamente.
            </DialogDescription>
          </DialogHeader>
          {reversalPlan && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              {reversalPlan.losses.length > 0 ? (
                <>
                  <strong>Dados que serão removidos ou resetados:</strong>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {reversalPlan.losses.map((loss) => (
                      <li key={loss}>{loss}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <strong>Nenhum registro operacional será removido.</strong>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversalPlan(undefined)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onUpdate((current) => reverseOrderWorkflow(current));
                setReversalPlan(undefined);
                notify("Etapa anterior restaurada e registrada no histórico");
              }}
            >
              Confirmar retorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(futureMessage)} onOpenChange={(open) => !open && setFutureMessage("")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Etapa ainda não disponível</DialogTitle>
            <DialogDescription>{futureMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setFutureMessage("")}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={manualStatusOpen} onOpenChange={setManualStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar status manualmente</DialogTitle>
            <DialogDescription>
              Confirme a mudança de {order.status} para {manualStatus}. A alteração será registrada
              no histórico.
            </DialogDescription>
          </DialogHeader>
          <select
            value={manualStatus}
            onChange={(event) => setManualStatus(event.target.value as ServiceOrder["status"])}
            className="h-11 w-full rounded-xl border bg-white px-3"
          >
            {orderStatuses.map((status) => (
              <option
                key={status}
                disabled={
                  orderStatuses.indexOf(status) < orderStatuses.indexOf(order.status) &&
                  status !== availableReversal?.to
                }
              >
                {status}
              </option>
            ))}
          </select>
          {getStatusPrerequisites(order, manualStatus).length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <strong>Atenção:</strong> esta alteração ignora:{" "}
              {getStatusPrerequisites(order, manualStatus).join(", ")}.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualStatusOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (
                  orderStatuses.indexOf(manualStatus) < orderStatuses.indexOf(order.status) &&
                  manualStatus === availableReversal?.to
                ) {
                  setManualStatusOpen(false);
                  setReversalPlan(availableReversal);
                  return;
                }
                transitionStatus(
                  manualStatus,
                  `Correção manual de fluxo: ${order.status} → ${manualStatus}`,
                );
                setManualStatusOpen(false);
                notify("Status ajustado manualmente e registrado");
              }}
              disabled={manualStatus === order.status}
            >
              Confirmar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrderOverview({
  order,
  vehicle,
  customer,
  onVehicle,
  approved,
  total,
  onQuickAction,
  workflow,
}: {
  order: ServiceOrder;
  vehicle: Vehicle;
  customer: Customer;
  onVehicle: (id: string) => void;
  approved: number;
  total: number;
  onQuickAction: (tab: string) => void;
  workflow: ReturnType<typeof evaluateOrderWorkflow>;
}) {
  const refused = order.budget
    .filter((item) => item.approval === "Recusado")
    .reduce((sum, item) => sum + item.price, 0);
  const paid = order.payment?.status === "Pago" ? order.payment.amount : 0;
  const paymentPending = Math.max(approved - paid, 0);
  const sections = [
    { icon: MessageCircle, label: "Problema relatado", text: order.complaint },
    {
      icon: Gauge,
      label: "Diagnóstico",
      text: order.diagnosis || "Diagnóstico ainda não registrado.",
    },
    {
      icon: Sparkles,
      label: "Problema adicional",
      text: order.findings || "Nenhum problema adicional registrado.",
    },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
      <div className="space-y-4">
        <Card className="border-0 bg-white">
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <span className="text-xs text-muted-foreground">Cliente</span>
              <p className="font-semibold">{customer.name}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Veículo</span>
              <p className="font-semibold">
                {vehicle.brand} {vehicle.model} · {vehicle.plate}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Quilometragem</span>
              <p className="font-semibold">{order.entryMileage.toLocaleString("pt-BR")} km</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Responsável</span>
              <p className="font-semibold">{order.team.join(", ") || "A definir"}</p>
            </div>
          </CardContent>
        </Card>
        {sections.map((section) => (
          <Card key={section.label} className="border-0 bg-white">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
                  <section.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </p>
                  <p className="mt-2 leading-relaxed">{section.text}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="border-0 bg-white">
          <CardContent className="p-6">
            <h2 className="font-bold">Evidências do diagnóstico</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {order.evidence.length ? (
                order.evidence.map((evidence) => (
                  <div
                    key={evidence.id}
                    className="relative overflow-hidden rounded-xl bg-slate-900 p-4 text-white"
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/10">
                        {evidence.kind === "Foto" ? (
                          <Camera className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </span>
                      <Badge className="bg-white/10 text-white">{evidence.kind}</Badge>
                    </div>
                    <p className="text-sm font-semibold">{evidence.caption}</p>
                    <p className="mt-1 text-xs text-slate-400">{evidence.name}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="Sem evidências" text="Fotos e vídeos aparecerão aqui." />
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">Atividades</h2>
              <span className="text-xs text-muted-foreground">
                Última: {formatActivityDate(order.updatedAt ?? `${order.openedAt}T12:00:00-03:00`)}
              </span>
            </div>
            <div className="mt-5 space-y-4 border-l-2 border-slate-200 pl-5">
              {[...(order.activities ?? [])].reverse().map((activity) => (
                <div key={activity.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-orange-500" />
                  <p className="text-xs text-muted-foreground">{formatActivityDate(activity.at)}</p>
                  <p className="mt-1 text-sm font-medium">{activity.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <aside className="space-y-4">
        <button
          onClick={() => onVehicle(vehicle.id)}
          className="w-full rounded-2xl bg-slate-900 p-5 text-left text-white"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500">
              <VehicleIcon kind={vehicle.kind} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-400">Veículo</p>
              <strong>
                {vehicle.brand} {vehicle.model}
              </strong>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400">Placa</dt>
              <dd className="font-mono">{vehicle.plate}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Proprietário</dt>
              <dd>{customer.name}</dd>
            </div>
          </dl>
        </button>
        <Card className="border-0 bg-white">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Resumo financeiro
            </p>
            <div className="mt-3 flex justify-between">
              <span>Orçado</span>
              <strong>{money(total)}</strong>
            </div>
            <div className="mt-2 flex justify-between text-emerald-700">
              <span>Aprovado</span>
              <strong>{money(approved)}</strong>
            </div>
            <div className="mt-2 flex justify-between text-rose-700">
              <span>Recusado</span>
              <strong>{money(refused)}</strong>
            </div>
            <div className="mt-2 flex justify-between text-sky-700">
              <span>Pago</span>
              <strong>{money(paid)}</strong>
            </div>
            <div className="mt-2 flex justify-between text-amber-700">
              <span>Pendente</span>
              <strong>{money(paymentPending)}</strong>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${total ? (approved / total) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Pendências</p>
            <div className="mt-3 space-y-2">
              {workflow.blockers.length ? (
                workflow.blockers.map((item) => (
                  <p key={item} className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900">
                    <strong>Bloqueio:</strong> {item}
                  </p>
                ))
              ) : (
                <p className="text-sm text-emerald-700">
                  Nenhuma pendência operacional identificada.
                </p>
              )}
              {workflow.warnings.map((item) => (
                <p key={item} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                  <strong>Aviso:</strong> {item}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-slate-900 text-white">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase text-orange-400">Próxima ação sugerida</p>
            <p className="mt-2 font-semibold">{workflow.nextAction.label}</p>
            {order.status === "Recebido" && (
              <Button
                onClick={() => onQuickAction("diagnosis")}
                className="mt-4 w-full bg-orange-500 hover:bg-orange-600"
              >
                Registrar diagnóstico
              </Button>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function DiagnosisPanel({
  order,
  onUpdate,
  notify,
}: {
  order: ServiceOrder;
  onUpdate: (updater: OrderUpdater) => void;
  notify: (text: string) => void;
}) {
  const [diagnosis, setDiagnosis] = useState(order.diagnosis);
  const [findings, setFindings] = useState(order.findings);
  const [notes, setNotes] = useState(order.notes);
  const [pendingDiagnosisChange, setPendingDiagnosisChange] =
    useState<PendingWorkflowConfirmation>();
  const addEvidence = (kind: "Foto" | "Vídeo") => {
    const evidence = {
      id: `e-${Date.now()}`,
      kind,
      name: kind === "Foto" ? "evidencia-local.jpg" : "video-diagnostico.mp4",
      caption: kind === "Foto" ? "Nova foto do diagnóstico" : "Novo vídeo do diagnóstico",
    };
    onUpdate((current) =>
      withActivity(current, "diagnosis", `${kind} adicionada ao diagnóstico`, {
        evidence: [...current.evidence, evidence],
      }),
    );
    notify(`${kind} adicionada em modo demonstração`);
  };
  const saveDiagnosis = () => {
    onUpdate((current) =>
      withActivity(current, "diagnosis", "Diagnóstico atualizado", {
        diagnosis,
        findings,
        notes,
      }),
    );
    notify("Diagnóstico salvo");
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="border-0 bg-white">
        <CardContent className="space-y-5 p-6">
          <div>
            <label className="text-sm font-semibold">Descrição do diagnóstico</label>
            <Textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="mt-2 min-h-28 rounded-xl"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Problema adicional encontrado</label>
            <Textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              className="mt-2 min-h-24 rounded-xl"
              placeholder="Registre algo que surgiu durante o serviço"
            />
            <p className="mt-2 text-xs text-amber-700">
              Um novo serviço deverá começar como “Aguardando aprovação”.
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold">Observações</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 min-h-20 rounded-xl"
            />
          </div>
          <Button
            onClick={() => {
              setPendingDiagnosisChange({
                title: "Confirmar atualização do diagnóstico?",
                description:
                  "O diagnóstico, as constatações e as observações atuais serão salvos na OS.",
                onConfirm: saveDiagnosis,
              });
            }}
            className="rounded-xl bg-orange-500 hover:bg-orange-600"
          >
            Salvar diagnóstico
          </Button>
        </CardContent>
      </Card>
      <Card className="border-0 bg-slate-900 text-white">
        <CardContent className="p-6">
          <h2 className="font-bold">Fotos e vídeos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Experiência simulada; nenhum arquivo é enviado.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              onClick={() =>
                setPendingDiagnosisChange({
                  title: "Confirmar inclusão da foto?",
                  description: "Uma evidência fotográfica demonstrativa será adicionada à OS.",
                  onConfirm: () => addEvidence("Foto"),
                })
              }
              className="h-24 flex-col gap-2 bg-white/10 hover:bg-white/15"
            >
              <ImagePlus className="h-6 w-6 text-orange-400" />
              Adicionar foto
            </Button>
            <Button
              onClick={() =>
                setPendingDiagnosisChange({
                  title: "Confirmar inclusão do vídeo?",
                  description: "Uma evidência em vídeo demonstrativa será adicionada à OS.",
                  onConfirm: () => addEvidence("Vídeo"),
                })
              }
              className="h-24 flex-col gap-2 bg-white/10 hover:bg-white/15"
            >
              <Video className="h-6 w-6 text-orange-400" />
              Adicionar vídeo
            </Button>
          </div>
          <div className="mt-5 space-y-2">
            {order.evidence.map((evidence) => (
              <div key={evidence.id} className="flex items-center gap-3 rounded-xl bg-white/7 p-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                  {evidence.kind === "Foto" ? (
                    <Camera className="h-4 w-4" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{evidence.caption}</strong>
                  <span className="text-xs text-slate-400">{evidence.name}</span>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(pendingDiagnosisChange)}
        onOpenChange={(open) => !open && setPendingDiagnosisChange(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingDiagnosisChange?.title}</DialogTitle>
            <DialogDescription>{pendingDiagnosisChange?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDiagnosisChange(undefined)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                pendingDiagnosisChange?.onConfirm();
                setPendingDiagnosisChange(undefined);
              }}
            >
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientQuotePreview({
  order,
  workshop,
  vehicle,
  customer,
  onPrint,
}: {
  order: ServiceOrder;
  workshop: Workshop;
  vehicle: Vehicle;
  customer: Customer;
  onPrint: () => void;
}) {
  const sumByApproval = (approval: ApprovalStatus) =>
    order.budget
      .filter((item) => item.approval === approval)
      .reduce((sum, item) => sum + item.price, 0);
  const total = order.budget.reduce((sum, item) => sum + item.price, 0);
  const totals = [
    { label: "Total do orçamento", value: total, className: "text-slate-950" },
    { label: "Aprovado", value: sumByApproval("Aprovado"), className: "text-emerald-700" },
    {
      label: "Aguardando aprovação",
      value: sumByApproval("Aguardando aprovação"),
      className: "text-amber-700",
    },
    { label: "Recusado", value: sumByApproval("Recusado"), className: "text-rose-700" },
  ];

  return (
    <article className="document-paper bg-white text-slate-900">
      <header className="document-header bg-slate-900 px-6 py-7 text-white md:px-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <WorkshopIdentity workshop={workshop} />
          <div className="pr-8 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
              Orçamento · {order.id}
            </p>
            <p className="mt-1 text-sm text-slate-300">Preparado para {customer.name}</p>
          </div>
        </div>
        <div className="mt-7 rounded-2xl bg-white/8 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Status do veículo</p>
          <p className="mt-1 text-lg font-semibold">
            Seu veículo está: {order.status.toLowerCase()}
          </p>
        </div>
      </header>

      <div className="space-y-6 p-6 md:p-9">
        <div className="no-print flex justify-end">
          <Button onClick={onPrint} variant="outline" className="gap-2 bg-white">
            <Printer className="h-4 w-4" /> Imprimir orçamento
          </Button>
        </div>

        <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Veículo</p>
            <p className="font-bold">
              {vehicle.brand} {vehicle.model}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Placa</p>
            <p className="font-mono font-bold">{vehicle.plate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ano / modelo</p>
            <p className="font-bold">
              {vehicle.year} · {vehicle.model}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Quilometragem na entrada</p>
            <p className="font-bold">{order.entryMileage.toLocaleString("pt-BR")} km</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
              O que você relatou
            </p>
            <p className="mt-2 leading-relaxed">{order.complaint}</p>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
              O que encontramos
            </p>
            <p className="mt-2 leading-relaxed">
              {order.diagnosis || "Diagnóstico ainda não registrado."}
            </p>
            {order.findings && <p className="mt-3 text-sm text-slate-600">{order.findings}</p>}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-lg font-bold">Evidências do diagnóstico</h2>
            <p className="text-sm text-muted-foreground">Fotos e vídeos registrados pela oficina</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {order.evidence.length ? (
              order.evidence.map((evidence) => (
                <div key={evidence.id} className="rounded-2xl bg-slate-800 p-4 text-white">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                    {evidence.kind === "Foto" ? (
                      <Camera className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </span>
                  <p className="mt-6 font-semibold">{evidence.caption}</p>
                  <p className="mt-1 text-xs text-slate-400">Prévia simulada · {evidence.kind}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed bg-white p-5 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                Nenhuma foto ou vídeo disponível para esta ordem.
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b p-5">
            <h2 className="text-lg font-bold">Serviços e peças recomendados</h2>
            <p className="text-sm text-muted-foreground">Cada item mantém a decisão registrada</p>
          </div>
          {order.budget.length ? (
            <div className="divide-y">
              {order.budget.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                  <strong>{money(item.price)}</strong>
                  <StatusBadge status={item.approval} />
                </div>
              ))}
            </div>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">Nenhum item incluído no orçamento.</p>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totals.map((item) => (
            <div key={item.label} className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={cn("mt-1 text-xl font-bold", item.className)}>{money(item.value)}</p>
            </div>
          ))}
        </section>

        <p className="no-print text-center text-xs text-muted-foreground">
          Visualização demonstrativa local. Aprovações e recusas continuam sendo registradas pela
          oficina.
        </p>
      </div>
    </article>
  );
}

function BudgetPanel({
  order,
  workshop,
  vehicle,
  customer,
  updateItem,
  onUpdate,
  notify,
}: {
  order: ServiceOrder;
  workshop: Workshop;
  vehicle: Vehicle;
  customer: Customer;
  updateItem: (id: string, patch: Partial<ServiceOrder["budget"][number]>) => void;
  onUpdate: (updater: OrderUpdater) => void;
  notify: (text: string) => void;
}) {
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [clientPreviewOpen, setClientPreviewOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemType, setItemType] = useState<"Serviço" | "Peça">("Serviço");
  const [itemValue, setItemValue] = useState("");
  const [budgetError, setBudgetError] = useState("");
  const [pendingBudgetChange, setPendingBudgetChange] = useState<PendingWorkflowConfirmation>();
  const total = order.budget.reduce((sum, item) => sum + item.price, 0);
  const approved = order.budget
    .filter((i) => i.approval === "Aprovado")
    .reduce((sum, item) => sum + item.price, 0);
  const setApproval = (id: string, approval: ApprovalStatus) => {
    onUpdate((current) => {
      const item = current.budget.find((entry) => entry.id === id);
      const updated = withActivity(
        current,
        "budget",
        `${item?.name ?? "Item"} marcado como ${approval.toLowerCase()}`,
        {
          budget: current.budget.map((entry) => (entry.id === id ? { ...entry, approval } : entry)),
        },
      );
      const flow = evaluateOrderWorkflow(updated);
      if (
        current.status === "Aguardando aprovação" &&
        flow.waitingApprovalCount === 0 &&
        flow.approvedCount > 0
      ) {
        const nextStatus = flow.blockingPartCount > 0 ? "Aguardando peça" : "Em manutenção";
        return withStatusTransition(
          updated,
          nextStatus,
          flow.blockingPartCount > 0
            ? `Decisões registradas; peças pendentes: Aguardando aprovação → ${nextStatus}`
            : `Decisões registradas e peças disponíveis: Aguardando aprovação → ${nextStatus}`,
        );
      }
      return updated;
    });
    notify(`Item marcado como ${approval.toLowerCase()}`);
  };
  const setAvailability = (
    id: string,
    availability: NonNullable<ServiceOrder["budget"][number]["availability"]>,
  ) => {
    onUpdate((current) => {
      const item = current.budget.find((entry) => entry.id === id);
      const updated = withActivity(
        current,
        "budget",
        `Disponibilidade de ${item?.name ?? "peça"}: ${availability}`,
        {
          budget: current.budget.map((entry) =>
            entry.id === id ? { ...entry, availability } : entry,
          ),
        },
      );
      const flow = evaluateOrderWorkflow(updated);
      if (current.status === "Aguardando peça" && flow.blockingPartCount === 0) {
        return withStatusTransition(
          updated,
          "Em manutenção",
          "Peças necessárias disponíveis: Aguardando peça → Em manutenção",
        );
      }
      return updated;
    });
    notify("Disponibilidade da peça atualizada");
  };
  const requestApproval = (id: string, approval: ApprovalStatus) => {
    const item = order.budget.find((entry) => entry.id === id);
    if (!item || item.approval === approval) return;
    const projected = evaluateOrderWorkflow({
      ...order,
      budget: order.budget.map((entry) => (entry.id === id ? { ...entry, approval } : entry)),
    });
    const nextStatus =
      order.status === "Aguardando aprovação" &&
      projected.waitingApprovalCount === 0 &&
      projected.approvedCount > 0
        ? projected.blockingPartCount > 0
          ? "Aguardando peça"
          : "Em manutenção"
        : undefined;
    const action =
      approval === "Aprovado"
        ? "aprovação"
        : approval === "Recusado"
          ? "recusa"
          : "retorno para aguardando aprovação";
    setPendingBudgetChange({
      title: `Confirmar ${action} de ${item.name}?`,
      description: nextStatus
        ? `A decisão será registrada e, por concluir as decisões pendentes, a OS passará de ${order.status} para ${nextStatus}.`
        : `A decisão do item será alterada de ${item.approval} para ${approval}.`,
      onConfirm: () => setApproval(id, approval),
    });
  };
  const requestAvailability = (
    id: string,
    availability: NonNullable<ServiceOrder["budget"][number]["availability"]>,
  ) => {
    const item = order.budget.find((entry) => entry.id === id);
    if (!item || item.availability === availability) return;
    const projected = evaluateOrderWorkflow({
      ...order,
      budget: order.budget.map((entry) => (entry.id === id ? { ...entry, availability } : entry)),
    });
    const advances = order.status === "Aguardando peça" && projected.blockingPartCount === 0;
    setPendingBudgetChange({
      title: `Confirmar disponibilidade de ${item.name}?`,
      description: advances
        ? `A peça será marcada como ${availability} e a OS passará de Aguardando peça para Em manutenção.`
        : `A disponibilidade da peça será alterada de ${item.availability ?? "não informada"} para ${availability}.`,
      onConfirm: () => setAvailability(id, availability),
    });
  };
  const addAdditional = () => {
    const cleanName = name.trim();
    const value = Number(price);
    if (!cleanName) return setBudgetError("Informe a descrição do serviço adicional.");
    if (!price || !Number.isFinite(value) || value < 0)
      return setBudgetError("Informe um valor válido, igual ou maior que zero.");
    onUpdate((current) =>
      withActivity(current, "budget", `Problema adicional incluído: ${cleanName}`, {
        budget: [
          ...current.budget,
          {
            id: `i-${Date.now()}`,
            type: "Serviço",
            name: cleanName,
            price: value,
            approval: "Aguardando aprovação",
            additional: true,
            executed: false,
          },
        ],
      }),
    );
    setName("");
    setPrice("");
    setBudgetError("");
    setAdditionalOpen(false);
    notify("Problema adicional aguardando aprovação");
  };
  const addBudgetItem = () => {
    const cleanName = itemName.trim();
    const value = Number(itemValue);
    if (!cleanName) return setBudgetError("Informe a descrição do item.");
    if (!itemValue || !Number.isFinite(value) || value < 0)
      return setBudgetError("Informe um valor válido, igual ou maior que zero.");
    onUpdate((current) =>
      withActivity(current, "budget", `Item incluído no orçamento: ${cleanName}`, {
        budget: [
          ...current.budget,
          {
            id: `i-${Date.now()}`,
            type: itemType,
            name: cleanName,
            price: itemType === "Peça" ? Number((value * 1.3).toFixed(2)) : value,
            approval: "Aguardando aprovação",
            ...(itemType === "Peça" ? { cost: value, availability: "Disponível" as const } : {}),
            executed: false,
          },
        ],
      }),
    );
    setItemName("");
    setItemValue("");
    setBudgetError("");
    setItemOpen(false);
    notify("Item adicionado ao orçamento");
  };
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden border-0 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="font-bold">Itens do orçamento</h2>
              <p className="text-sm text-muted-foreground">Cada item possui sua própria decisão.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setClientPreviewOpen(true)}
                variant="outline"
                className="gap-2 rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <Eye className="h-4 w-4" /> Visualizar como cliente
              </Button>
              <Button
                onClick={() => setItemOpen(true)}
                className="gap-2 rounded-xl bg-slate-900 hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" /> Adicionar item
              </Button>
              <Button
                onClick={() => setAdditionalOpen(true)}
                variant="outline"
                className="gap-2 rounded-xl"
              >
                <Sparkles className="h-4 w-4" /> Problema adicional
              </Button>
            </div>
          </div>
          <div className="divide-y">
            {order.budget.length === 0 && (
              <EmptyState
                title="Orçamento ainda vazio"
                text="Adicione uma peça ou serviço para iniciar a proposta."
              />
            )}
            {order.budget.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "border-l-4 p-5",
                  item.approval === "Aprovado" && "border-l-emerald-500",
                  item.approval === "Recusado" && "border-l-rose-500",
                  item.approval === "Aguardando aprovação" && "border-l-amber-500",
                  item.additional && "bg-amber-50/60",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <span
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                        item.type === "Peça"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-sky-100 text-sky-700",
                      )}
                    >
                      {item.type === "Peça" ? (
                        <PackageCheck className="h-5 w-5" />
                      ) : (
                        <Wrench className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <strong>{item.name}</strong>
                        {item.additional && (
                          <Badge className="bg-amber-200 text-amber-900">Novo problema</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.type}
                        {item.cost !== undefined &&
                          ` · custo ${money(item.cost)} + 30% = ${money(item.price)}`}
                        {item.availability && ` · ${item.availability}`}
                      </p>
                    </div>
                  </div>
                  <strong className="text-lg">{money(item.price)}</strong>
                  <StatusBadge status={item.approval} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
                  {item.type === "Peça" && item.approval === "Aprovado" && (
                    <label className="mr-auto flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      Disponibilidade
                      <select
                        value={item.availability ?? "Disponível"}
                        onChange={(event) =>
                          requestAvailability(
                            item.id,
                            event.target.value as NonNullable<typeof item.availability>,
                          )
                        }
                        className="h-9 rounded-lg border bg-white px-2 text-sm text-slate-900"
                      >
                        <option>Disponível</option>
                        <option>Solicitada</option>
                        <option>Aguardando peça</option>
                      </select>
                    </label>
                  )}
                  <Button
                    size="sm"
                    variant={item.approval === "Aprovado" ? "default" : "outline"}
                    className={cn(
                      "gap-1",
                      item.approval === "Aprovado" && "bg-emerald-600 hover:bg-emerald-700",
                    )}
                    onClick={() => requestApproval(item.id, "Aprovado")}
                  >
                    <Check className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant={item.approval === "Recusado" ? "destructive" : "outline"}
                    className="gap-1"
                    onClick={() => requestApproval(item.id, "Recusado")}
                  >
                    <X className="h-3.5 w-3.5" /> Recusar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => requestApproval(item.id, "Aguardando aprovação")}
                  >
                    Aguardar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <aside className="space-y-4">
          <Card className="border-0 bg-slate-900 text-white">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Resumo do orçamento
              </p>
              <div className="mt-5 flex justify-between">
                <span>Total apresentado</span>
                <strong>{money(total)}</strong>
              </div>
              <div className="mt-3 flex justify-between text-emerald-400">
                <span>Total aprovado</span>
                <strong>{money(approved)}</strong>
              </div>
              <div className="mt-3 flex justify-between text-rose-300">
                <span>Total recusado</span>
                <strong>
                  {money(
                    order.budget
                      .filter((i) => i.approval === "Recusado")
                      .reduce((s, i) => s + i.price, 0),
                  )}
                </strong>
              </div>
              <div className="mt-3 flex justify-between text-amber-300">
                <span>Aguardando</span>
                <strong>
                  {money(
                    order.budget
                      .filter((i) => i.approval === "Aguardando aprovação")
                      .reduce((s, i) => s + i.price, 0),
                  )}
                </strong>
              </div>
            </CardContent>
          </Card>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong className="block">Regra demonstrada</strong>
            <p className="mt-1">
              Serviços não autorizados não podem ser executados. Novos problemas começam aguardando
              aprovação.
            </p>
          </div>
        </aside>
      </div>
      <Dialog open={clientPreviewOpen} onOpenChange={setClientPreviewOpen}>
        <DialogContent className="client-quote-print max-h-[92vh] max-w-5xl overflow-y-auto p-0">
          <DialogTitle className="sr-only no-print">Orçamento · {order.id}</DialogTitle>
          <DialogDescription className="sr-only no-print">
            Visão do cliente, somente leitura.
          </DialogDescription>
          <ClientQuotePreview
            order={order}
            workshop={workshop}
            vehicle={vehicle}
            customer={customer}
            onPrint={() => window.print()}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar item ao orçamento</DialogTitle>
            <DialogDescription>
              O item será criado aguardando a decisão do cliente. Para peças, o piloto demonstra o
              custo acrescido de 30%.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Tipo do item</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as "Serviço" | "Peça")}
                className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option>Serviço</option>
                <option>Peça</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Descrição</label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="mt-2"
                placeholder={
                  itemType === "Peça" ? "Ex.: Bobina de ignição" : "Ex.: Diagnóstico eletrônico"
                }
              />
            </div>
            <div>
              <label className="text-sm font-semibold">
                {itemType === "Peça" ? "Custo da peça" : "Valor da mão de obra"}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={itemValue}
                onChange={(e) => setItemValue(e.target.value)}
                className="mt-2"
                placeholder="0,00"
              />
              {itemType === "Peça" && Number(itemValue) > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Valor demonstrado ao cliente: <strong>{money(Number(itemValue) * 1.3)}</strong>
                </p>
              )}
            </div>
            {budgetError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {budgetError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addBudgetItem} className="bg-orange-500 hover:bg-orange-600">
              Adicionar ao orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={additionalOpen} onOpenChange={setAdditionalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar problema adicional</DialogTitle>
            <DialogDescription>
              O novo item será criado sem autorização e aguardará a decisão do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Serviço recomendado</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
                placeholder="Ex.: Substituir correia auxiliar"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Valor estimado</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-2"
                placeholder="0,00"
              />
            </div>
            {budgetError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {budgetError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdditionalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addAdditional} className="bg-orange-500 hover:bg-orange-600">
              Adicionar aguardando aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pendingBudgetChange)}
        onOpenChange={(open) => !open && setPendingBudgetChange(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingBudgetChange?.title}</DialogTitle>
            <DialogDescription>{pendingBudgetChange?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBudgetChange(undefined)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                pendingBudgetChange?.onConfirm();
                setPendingBudgetChange(undefined);
              }}
            >
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExecutionPanel({
  order,
  updateItem,
  notify,
}: {
  order: ServiceOrder;
  updateItem: (id: string, patch: Partial<ServiceOrder["budget"][number]>) => void;
  notify: (text: string) => void;
}) {
  const approved = order.budget.filter((item) => item.approval === "Aprovado");
  const blocked = order.budget.filter((item) => item.approval !== "Aprovado");
  const [pendingExecution, setPendingExecution] = useState<ServiceOrder["budget"][number]>();
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
      <Card className="border-0 bg-white">
        <CardContent className="p-6">
          <h2 className="font-bold">Serviços autorizados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque o que foi efetivamente executado.
          </p>
          <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-800">
            {approved.filter((item) => item.executed).length} de {approved.length} serviços
            aprovados concluídos
          </p>
          <div className="mt-5 space-y-3">
            {approved.length === 0 && (
              <EmptyState
                title="Nenhum item autorizado"
                text="A execução ficará disponível depois da aprovação do cliente."
              />
            )}
            {approved.map((item) => (
              <button
                key={item.id}
                onClick={() => setPendingExecution(item)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-xl border p-4 text-left",
                  item.executed ? "border-emerald-200 bg-emerald-50" : "bg-white",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border-2",
                    item.executed
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300",
                  )}
                >
                  {item.executed && <Check className="h-4 w-4" />}
                </span>
                <span className="flex-1">
                  <strong className="block text-sm">{item.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {item.type} · {money(item.price)}
                  </span>
                </span>
                <span className="text-xs font-semibold">
                  {item.executed ? "EXECUTADO" : "PENDENTE"}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <aside>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-center gap-2 text-rose-800">
            <XCircle className="h-5 w-5" />
            <h2 className="font-bold">Itens bloqueados</h2>
          </div>
          <p className="mt-2 text-sm text-rose-700">
            Não podem ser marcados como executados sem aprovação.
          </p>
          <div className="mt-4 space-y-2">
            {blocked.length === 0 && (
              <p className="text-sm text-rose-700">Nenhum item bloqueado.</p>
            )}
            {blocked.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  notify(
                    item.approval === "Recusado"
                      ? "Este serviço foi recusado pelo cliente e não pode ser executado."
                      : "Este serviço ainda não foi aprovado pelo cliente.",
                  )
                }
                className="w-full rounded-xl bg-white/70 p-3 text-left hover:bg-white"
              >
                <strong className="block text-sm">{item.name}</strong>
                <StatusBadge status={item.approval} />
              </button>
            ))}
          </div>
        </div>
      </aside>
      <Dialog
        open={Boolean(pendingExecution)}
        onOpenChange={(open) => !open && setPendingExecution(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingExecution?.executed ? "Reabrir item executado?" : "Confirmar execução?"}
            </DialogTitle>
            <DialogDescription>
              {pendingExecution?.executed
                ? `${pendingExecution.name} voltará a ficar pendente e impedirá a conclusão do serviço.`
                : `${pendingExecution?.name ?? "O item"} será registrado como executado nesta OS.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingExecution(undefined)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                if (pendingExecution)
                  updateItem(pendingExecution.id, { executed: !pendingExecution.executed });
                setPendingExecution(undefined);
              }}
            >
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentPanel({
  order,
  onUpdate,
  warrantyEnd,
  notify,
}: {
  order: ServiceOrder;
  onUpdate: (updater: OrderUpdater) => void;
  warrantyEnd: Date | null;
  notify: (text: string) => void;
}) {
  const approved = order.budget
    .filter((i) => i.approval === "Aprovado")
    .reduce((sum, item) => sum + item.price, 0);
  const [method, setMethod] = useState<"PIX" | "Cartão">(order.payment?.method ?? "PIX");
  const [status, setStatus] = useState<"Pendente" | "Pago">(order.payment?.status ?? "Pendente");
  const [amount, setAmount] = useState(order.payment?.amount.toString() ?? approved.toString());
  const [paymentError, setPaymentError] = useState("");
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const today = new Date("2026-09-01T12:00:00Z");
  const warrantyStatus = warrantyEnd && warrantyEnd >= today ? "ATIVA" : "EXPIRADA";
  const registerPayment = () => {
    const numericAmount = Number(amount);
    onUpdate((current) =>
      withActivity(
        current,
        "payment",
        `Pagamento ${status.toLowerCase()} registrado por ${method}`,
        { payment: { amount: numericAmount, method, status, date: "2026-09-01" } },
      ),
    );
    setPaymentError("");
    notify("Pagamento registrado");
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-0 bg-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <CircleDollarSign className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold">Registrar pagamento</h2>
              <p className="text-sm text-muted-foreground">
                Sem integração bancária ou com máquina.
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <span className="text-xs text-muted-foreground">Valor aprovado</span>
            <strong className="block text-2xl">{money(approved)}</strong>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-sm font-semibold">Valor registrado</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Forma</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "PIX" | "Cartão")}
                className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
              >
                <option>PIX</option>
                <option>Cartão</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "Pendente" | "Pago")}
                className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
              >
                <option>Pendente</option>
                <option>Pago</option>
              </select>
            </div>
          </div>
          {paymentError && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {paymentError}
            </p>
          )}
          <Button
            onClick={() => {
              const numericAmount = Number(amount);
              if (
                (status === "Pago" && amount.trim() === "") ||
                !Number.isFinite(numericAmount) ||
                numericAmount < 0
              ) {
                setPaymentError(
                  status === "Pago" && amount.trim() === ""
                    ? "Informe o valor antes de confirmar o pagamento."
                    : "O valor do pagamento não pode ser negativo ou inválido.",
                );
                return;
              }
              if (!(["PIX", "Cartão"] as string[]).includes(method)) {
                setPaymentError("Selecione PIX ou Cartão como forma de pagamento.");
                return;
              }
              setPaymentError("");
              setPaymentConfirmationOpen(true);
            }}
            className="mt-5 w-full rounded-xl bg-orange-500 hover:bg-orange-600"
          >
            Registrar pagamento
          </Button>
          {order.payment && (
            <div className="mt-4 flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm">
                {order.payment.method} · {formatDate(order.payment.date)}
              </span>
              <StatusBadge status={order.payment.status} />
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="border-0 bg-slate-900 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold">Garantia do serviço</h2>
              <p className="text-sm text-slate-400">Regra piloto sujeita a exceções.</p>
            </div>
          </div>
          {order.completedAt && warrantyEnd ? (
            <div className="mt-6">
              <StatusBadge status={warrantyStatus} />
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-400">Data do serviço</dt>
                  <dd className="mt-1 font-semibold">{formatDate(order.completedAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Período padrão</dt>
                  <dd className="mt-1 font-semibold">30 dias</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">Encerramento estimado</dt>
                  <dd className="mt-1 text-lg font-bold">
                    {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(warrantyEnd)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-white/7 p-4 text-sm text-slate-300">
              A garantia será calculada quando a OS for marcada como “Serviço concluído”.
            </div>
          )}
          <p className="mt-5 text-xs leading-relaxed text-slate-400">
            O início na conclusão ou entrega e possíveis variações dos 30 dias ainda precisam ser
            validados.
          </p>
        </CardContent>
      </Card>
      <Dialog open={paymentConfirmationOpen} onOpenChange={setPaymentConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar registro do pagamento?</DialogTitle>
            <DialogDescription>
              Será registrado {money(Number(amount))} por {method}, com status {status}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentConfirmationOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                registerPayment();
                setPaymentConfirmationOpen(false);
              }}
            >
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewCustomerDialog({
  open,
  onOpenChange,
  customers,
  onExisting,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customers: Customer[];
  onExisting: (id: string) => void;
  onCreate: (customer: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState<{ field: string; message: string; existingId?: string }>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanName = normalizeName(name);
    const cleanPhone = normalizePhone(phone);
    const cleanEmail = normalizeEmail(email);
    const cleanCpf = normalizeCpf(cpf);
    if (!cleanName) return setError({ field: "name", message: "Informe o nome do cliente." });
    if (cleanPhone.length < 10 || cleanPhone.length > 11)
      return setError({ field: "phone", message: "Informe um telefone válido com DDD." });
    if (cleanCpf && !isBasicCpfValid(cleanCpf))
      return setError({ field: "cpf", message: "Informe um CPF com 11 dígitos válidos." });
    if (!isBasicEmailValid(cleanEmail))
      return setError({ field: "email", message: "Informe um e-mail válido." });
    const duplicateCpf =
      cleanCpf && customers.find((item) => normalizeCpf(item.cpf ?? "") === cleanCpf);
    const duplicatePhone = customers.find((item) => normalizePhone(item.phone) === cleanPhone);
    const duplicateEmail =
      cleanEmail && customers.find((item) => normalizeEmail(item.email) === cleanEmail);
    const duplicate = duplicateCpf || duplicatePhone || duplicateEmail;
    if (duplicate) {
      const field = duplicateCpf ? "CPF" : duplicatePhone ? "telefone" : "e-mail";
      return setError({
        field: field.toLowerCase(),
        message: `Já existe um cliente cadastrado com este ${field}.`,
        existingId: duplicate.id,
      });
    }
    onCreate({
      id: `c-${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      ...(cleanCpf ? { cpf: cleanCpf } : {}),
      since: "2026",
    });
    setName("");
    setPhone("");
    setEmail("");
    setCpf("");
    setError(undefined);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>
              Cadastro simplificado para demonstrar o fluxo do piloto.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-4">
            <div>
              <label className="text-sm font-semibold">Nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
                aria-invalid={error?.field === "name"}
              />
              {error?.field === "name" && (
                <p className="mt-1 text-sm text-rose-600">{error.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-semibold">Telefone</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2"
                aria-invalid={error?.field === "telefone" || error?.field === "phone"}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">E-mail</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-semibold">
                CPF <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="mt-2"
                inputMode="numeric"
              />
            </div>
            {error && error.field !== "name" && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <p>{error.message}</p>
                {error.existingId && (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-rose-700"
                    onClick={() => onExisting(error.existingId!)}
                  >
                    Abrir cliente existente
                  </Button>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
              Criar cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewVehicleDialog({
  open,
  onOpenChange,
  customers,
  vehicles,
  onExisting,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customers: Customer[];
  vehicles: Vehicle[];
  onExisting: (id: string) => void;
  onCreate: (vehicle: Vehicle) => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [kind, setKind] = useState<Vehicle["kind"]>("Carro");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState<{ message: string; existingId?: string }>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanPlate = normalizePlate(plate);
    const existing = vehicles.find((item) => normalizePlate(item.plate) === cleanPlate);
    if (!customerId) return setError({ message: "Selecione o proprietário do veículo." });
    if (!brand.trim() || !model.trim() || cleanPlate.length !== 7)
      return setError({ message: "Informe marca, modelo e uma placa com 7 caracteres." });
    if (existing)
      return setError({
        message: `A placa ${cleanPlate} já pertence a ${existing.brand} ${existing.model}.`,
        existingId: existing.id,
      });
    const numericYear = Number(year);
    const numericMileage = Number(mileage);
    if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 2027)
      return setError({ message: "Informe um ano válido para o veículo." });
    if (!Number.isFinite(numericMileage) || numericMileage < 0 || numericMileage > 2_000_000)
      return setError({ message: "Informe uma quilometragem válida entre 0 e 2.000.000 km." });
    onCreate({
      id: `v-${Date.now()}`,
      customerId,
      kind,
      brand: normalizeName(brand),
      model: normalizeName(model),
      year: numericYear,
      plate: cleanPlate,
      mileage: numericMileage,
      color: normalizeName(color) || "Não informada",
    });
    setBrand("");
    setModel("");
    setPlate("");
    setYear("");
    setMileage("");
    setColor("");
    setError(undefined);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Novo veículo</DialogTitle>
            <DialogDescription>
              Cadastre um carro ou moto e vincule ao proprietário.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold">Proprietário</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Tipo</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Vehicle["kind"])}
                className="mt-2 h-10 w-full rounded-lg border bg-white px-3"
              >
                <option>Carro</option>
                <option>Moto</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Placa</label>
              <Input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="mt-2 uppercase"
                placeholder="ABC1D23"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Marca</label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-semibold">Modelo</label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-semibold">Ano</label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Quilometragem</label>
              <Input
                type="number"
                min="0"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold">Cor</label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="mt-2" />
            </div>
            {error && (
              <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <p>{error.message}</p>
                {error.existingId && (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-rose-700"
                    onClick={() => onExisting(error.existingId!)}
                  >
                    Abrir veículo existente
                  </Button>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
              Criar veículo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewOrderDialog({
  open,
  onOpenChange,
  customers,
  vehicles,
  allCustomers,
  allVehicles,
  orders,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customers: Customer[];
  vehicles: Vehicle[];
  allCustomers: Customer[];
  allVehicles: Vehicle[];
  orders: ServiceOrder[];
  onCreate: (result: {
    customer?: Customer | undefined;
    vehicle?: Vehicle | undefined;
    order: ServiceOrder;
  }) => Promise<void>;
}) {
  const creating = useRef(false);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [draftCustomer, setDraftCustomer] = useState<Customer>();
  const [vehicleId, setVehicleId] = useState("");
  const [newVehicle, setNewVehicle] = useState(false);
  const [kind, setKind] = useState<Vehicle["kind"]>("Carro");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [year, setYear] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");
  const [color, setColor] = useState("");
  const [draftVehicle, setDraftVehicle] = useState<Vehicle>();
  const [entryMileage, setEntryMileage] = useState("");
  const [complaint, setComplaint] = useState("");
  const [error, setError] = useState("");
  const [mileageWarningAccepted, setMileageWarningAccepted] = useState(false);

  const selectedCustomer = draftCustomer ?? customers.find((item) => item.id === customerId);
  const customerVehicles = selectedCustomer
    ? vehicles.filter((vehicle) => vehicle.customerId === selectedCustomer.id)
    : [];
  const selectedVehicle = draftVehicle ?? customerVehicles.find((item) => item.id === vehicleId);
  const filteredCustomers = customers.filter((customer) => {
    const term = customerSearch.toLocaleLowerCase("pt-BR").trim();
    if (!term) return true;
    return (
      `${customer.name} ${customer.phone} ${customer.email} ${customer.cpf ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(term) ||
      (normalizePhone(customerSearch).length > 0 &&
        normalizePhone(customer.phone).includes(normalizePhone(customerSearch))) ||
      (normalizeCpf(customerSearch).length > 0 &&
        normalizeCpf(customer.cpf ?? "").includes(normalizeCpf(customerSearch)))
    );
  });

  const duplicateCustomer =
    allCustomers.find(
      (item) => customerCpf.trim() && normalizeCpf(item.cpf ?? "") === normalizeCpf(customerCpf),
    ) ??
    allCustomers.find(
      (item) =>
        (customerPhone.trim() && normalizePhone(item.phone) === normalizePhone(customerPhone)) ||
        (customerEmail.trim() && normalizeEmail(item.email) === normalizeEmail(customerEmail)),
    );
  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setNewCustomer(false);
    setDraftCustomer(undefined);
    setVehicleId("");
    setDraftVehicle(undefined);
    setEntryMileage("");
    setMileageWarningAccepted(false);
    setError("");
  };

  const reset = () => {
    setStep(0);
    setCustomerSearch("");
    setCustomerId("");
    setNewCustomer(false);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerCpf("");
    setDraftCustomer(undefined);
    setVehicleId("");
    setNewVehicle(false);
    setKind("Carro");
    setBrand("");
    setModel("");
    setPlate("");
    setYear("");
    setVehicleMileage("");
    setColor("");
    setDraftVehicle(undefined);
    setEntryMileage("");
    setComplaint("");
    setError("");
    setMileageWarningAccepted(false);
  };
  const close = () => {
    if (creating.current) return;
    reset();
    onOpenChange(false);
  };
  const confirmCustomer = () => {
    if (!newCustomer) {
      if (!selectedCustomer) return setError("Selecione um cliente ou cadastre um novo.");
      setVehicleId("");
      setDraftVehicle(undefined);
      setNewVehicle(false);
      setError("");
      setStep(1);
      return;
    }
    const cleanName = normalizeName(customerName);
    const cleanPhone = normalizePhone(customerPhone);
    const cleanEmail = normalizeEmail(customerEmail);
    const cleanCpf = normalizeCpf(customerCpf);
    if (!cleanName) return setError("Informe o nome do cliente.");
    if (cleanPhone.length < 10 || cleanPhone.length > 11)
      return setError("Informe um telefone válido com DDD.");
    if (cleanCpf && !isBasicCpfValid(cleanCpf)) return setError("Informe um CPF válido.");
    if (!isBasicEmailValid(cleanEmail)) return setError("Informe um e-mail válido.");
    const duplicate = duplicateCustomer;
    if (duplicate)
      return setError(
        `${cleanCpf && normalizeCpf(duplicate.cpf ?? "") === cleanCpf ? "CPF" : normalizePhone(duplicate.phone) === cleanPhone ? "Telefone" : "E-mail"} já cadastrado para ${duplicate.name}.${duplicate.deletedAt ? " Este cadastro está excluído. Consulte o responsável pela oficina; ele não pode ser usado em uma nova OS." : " Use o cadastro existente para evitar duplicidade."}`,
      );
    const customer: Customer = {
      id: `c-${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      ...(cleanCpf ? { cpf: cleanCpf } : {}),
      since: "2026",
    };
    setDraftCustomer(customer);
    setCustomerId(customer.id);
    setVehicleId("");
    setDraftVehicle(undefined);
    setNewVehicle(false);
    setError("");
    setStep(1);
  };
  const confirmVehicle = () => {
    if (!selectedCustomer) return setError("Defina o cliente antes do veículo.");
    if (!newVehicle) {
      const vehicle = customerVehicles.find((item) => item.id === vehicleId);
      if (!vehicle) return setError("Selecione um veículo deste cliente ou cadastre um novo.");
      setDraftVehicle(undefined);
      setError("");
      setStep(2);
      return;
    }
    const cleanPlate = normalizePlate(plate);
    const existing = allVehicles.find((item) => normalizePlate(item.plate) === cleanPlate);
    if (!brand.trim() || !model.trim() || cleanPlate.length !== 7)
      return setError("Informe marca, modelo e uma placa com 7 caracteres.");
    if (existing)
      return setError(
        `A placa ${cleanPlate} já está cadastrada: ${existing.brand} ${existing.model}, cliente ${allCustomers.find((item) => item.id === existing.customerId)?.name ?? "não identificado"}.${existing.deletedAt ? " Este veículo está excluído e não pode ser usado em uma nova OS." : existing.customerId === selectedCustomer.id ? " Escolha-o em Selecionar veículo." : " Volte à etapa Cliente para selecionar o proprietário correto."}`,
      );
    const numericYear = Number(year);
    const numericMileage = Number(vehicleMileage);
    if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 2027)
      return setError("Informe um ano válido para o veículo.");
    if (!Number.isFinite(numericMileage) || numericMileage < 0 || numericMileage > 2_000_000)
      return setError("Informe uma quilometragem válida entre 0 e 2.000.000 km.");
    const vehicle: Vehicle = {
      id: `v-${Date.now()}`,
      customerId: selectedCustomer.id,
      kind,
      brand: normalizeName(brand),
      model: normalizeName(model),
      year: numericYear,
      plate: cleanPlate,
      mileage: numericMileage,
      color: normalizeName(color) || "Não informada",
    };
    setDraftVehicle(vehicle);
    setVehicleId(vehicle.id);
    setEntryMileage(numericMileage.toString());
    setError("");
    setStep(2);
  };
  const confirmOrderData = () => {
    if (!selectedVehicle) return setError("Defina o veículo antes dos dados da OS.");
    const cleanComplaint = complaint.trim();
    if (!cleanComplaint) return setError("Informe o problema relatado pelo cliente.");
    const numericMileage = entryMileage === "" ? selectedVehicle.mileage : Number(entryMileage);
    if (!Number.isFinite(numericMileage) || numericMileage < 0 || numericMileage > 2_000_000)
      return setError("Informe uma quilometragem válida entre 0 e 2.000.000 km.");
    const lastMileage = Math.max(
      selectedVehicle.mileage,
      ...orders
        .filter((item) => item.vehicleId === selectedVehicle.id)
        .map((item) => item.entryMileage),
    );
    if (numericMileage < lastMileage && !mileageWarningAccepted) {
      setMileageWarningAccepted(true);
      return setError(
        `A quilometragem informada é menor que a última registrada (${lastMileage.toLocaleString("pt-BR")} km). Confira o valor e clique novamente para continuar.`,
      );
    }
    setError("");
    setStep(3);
  };
  const createAll = async () => {
    if (creating.current) return;
    if (!selectedCustomer || !selectedVehicle) return;
    if (
      selectedVehicle.customerId !== selectedCustomer.id ||
      selectedCustomer.deletedAt ||
      selectedVehicle.deletedAt
    ) {
      setError("Confira o cliente e selecione um veículo ativo que pertença a ele.");
      return;
    }
    const orderId = nextOrderId(orders.map((order) => order.id));
    creating.current = true;
    setIsCreating(true);
    setError("");
    try {
      await onCreate({
        customer: draftCustomer,
        vehicle: draftVehicle,
        order: {
          id: orderId,
          customerId: selectedCustomer.id,
          vehicleId: selectedVehicle.id,
          status: "Recebido",
          openedAt: "2026-09-01",
          entryMileage: entryMileage === "" ? selectedVehicle.mileage : Number(entryMileage),
          complaint: complaint.trim(),
          diagnosis: "",
          findings: "",
          notes: "",
          team: [],
          budget: [],
          evidence: [],
        },
      });
      reset();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível confirmar a criação. Confira a lista antes de tentar novamente; seus dados preenchidos foram mantidos.",
      );
    } finally {
      creating.current = false;
      setIsCreating(false);
    }
  };
  const stages = ["Cliente", "Veículo", "Dados da OS", "Confirmar"];
  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <div>
          <DialogHeader>
            <DialogTitle>Nova ordem de serviço</DialogTitle>
            <DialogDescription>
              Cadastre ou selecione cliente e veículo antes de confirmar a entrada.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 grid grid-cols-4 gap-2">
            {stages.map((label, index) => (
              <div key={label} className="text-center">
                <span
                  className={cn(
                    "mx-auto grid h-7 w-7 place-items-center rounded-full border text-xs font-bold",
                    index <= step
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-slate-300 text-slate-400",
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-[10px] font-semibold",
                    index === step ? "text-orange-700" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="min-h-72 space-y-4">
            {step === 0 && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={!newCustomer ? "default" : "outline"}
                    onClick={() => {
                      setNewCustomer(false);
                      setDraftCustomer(undefined);
                    }}
                  >
                    Selecionar existente
                  </Button>
                  <Button
                    variant={newCustomer ? "default" : "outline"}
                    onClick={() => {
                      setNewCustomer(true);
                      setCustomerId("");
                      setDraftCustomer(undefined);
                      setError("");
                      if (customerSearch.trim()) {
                        if (/^[\d\s()+.-]+$/.test(customerSearch)) {
                          if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(customerSearch))
                            setCustomerCpf(customerSearch);
                          else setCustomerPhone(customerSearch);
                        } else setCustomerName(customerSearch.trim());
                      }
                    }}
                  >
                    Cadastrar novo cliente
                  </Button>
                </div>
                {!newCustomer ? (
                  <>
                    <Command shouldFilter={false} className="rounded-md border">
                      <CommandInput
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                        aria-label="Buscar cliente por nome, CPF ou telefone"
                        placeholder="Digite nome, CPF ou telefone"
                      />
                      <CommandList className="max-h-48">
                        <CommandEmpty>
                          Nenhum cliente encontrado. Use Cadastrar novo cliente acima.
                        </CommandEmpty>
                        {filteredCustomers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.id}
                            onSelect={() => selectCustomer(customer)}
                            className={cn(
                              "flex flex-col items-start rounded-none border-b p-3 text-left last:border-b-0",
                              customerId === customer.id && "border-orange-500 bg-orange-50",
                            )}
                          >
                            <strong className="block text-sm">{customer.name}</strong>
                            <span className="text-xs text-muted-foreground">
                              {customer.phone} · CPF: {customer.cpf || "não informado"}
                            </span>
                            {customer.email && (
                              <span className="text-xs text-muted-foreground">
                                {customer.email}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                    {selectedCustomer && (
                      <div
                        className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm"
                        role="status"
                      >
                        <strong>Cliente selecionado: {selectedCustomer.name}</strong>
                        <p>
                          {selectedCustomer.phone} · CPF: {selectedCustomer.cpf || "não informado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Os veículos deste cliente serão exibidos na próxima etapa.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm font-medium">
                      Nome
                      <Input
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        placeholder="Nome"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      Telefone com DDD
                      <Input
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        placeholder="Telefone com DDD"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      E-mail (opcional)
                      <Input
                        value={customerEmail}
                        onChange={(event) => setCustomerEmail(event.target.value)}
                        placeholder="E-mail"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      CPF (opcional)
                      <Input
                        value={customerCpf}
                        onChange={(event) => setCustomerCpf(event.target.value)}
                        placeholder="CPF (opcional)"
                      />
                    </label>
                  </div>
                )}
                {newCustomer && error && duplicateCustomer && !duplicateCustomer.deletedAt && (
                  <Button variant="outline" onClick={() => selectCustomer(duplicateCustomer)}>
                    Usar cadastro de {duplicateCustomer.name}
                  </Button>
                )}
              </>
            )}

            {step === 1 && selectedCustomer && (
              <>
                <p className="rounded-lg bg-slate-100 p-3 text-sm">
                  <strong>Cliente:</strong> {selectedCustomer.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={!newVehicle ? "default" : "outline"}
                    onClick={() => {
                      setNewVehicle(false);
                      setDraftVehicle(undefined);
                    }}
                  >
                    Selecionar veículo
                  </Button>
                  <Button
                    variant={newVehicle ? "default" : "outline"}
                    onClick={() => {
                      setNewVehicle(true);
                      setVehicleId("");
                      setDraftVehicle(undefined);
                    }}
                  >
                    Cadastrar outro veículo
                  </Button>
                </div>
                {!newVehicle ? (
                  <div className="space-y-2">
                    {customerVehicles.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        type="button"
                        onClick={() => setVehicleId(vehicle.id)}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left",
                          vehicleId === vehicle.id && "border-orange-500 bg-orange-50",
                        )}
                      >
                        <strong>
                          {vehicle.brand} {vehicle.model}
                        </strong>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {vehicle.plate} · {vehicle.mileage.toLocaleString("pt-BR")} km
                        </span>
                      </button>
                    ))}
                    {customerVehicles.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Este cliente ainda não possui veículo ativo. Cadastre um novo.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={kind}
                      onChange={(event) => setKind(event.target.value as Vehicle["kind"])}
                      className="h-10 rounded-lg border bg-white px-3"
                    >
                      <option>Carro</option>
                      <option>Moto</option>
                    </select>
                    <Input
                      value={plate}
                      onChange={(event) => setPlate(event.target.value)}
                      placeholder="Placa"
                      className="uppercase"
                    />
                    <Input
                      value={brand}
                      onChange={(event) => setBrand(event.target.value)}
                      placeholder="Marca"
                    />
                    <Input
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="Modelo"
                    />
                    <Input
                      type="number"
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                      placeholder="Ano"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={vehicleMileage}
                      onChange={(event) => setVehicleMileage(event.target.value)}
                      placeholder="Quilometragem atual"
                    />
                    <Input
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                      placeholder="Cor"
                      className="sm:col-span-2"
                    />
                  </div>
                )}
              </>
            )}

            {step === 2 && selectedVehicle && (
              <>
                <p className="rounded-lg bg-slate-100 p-3 text-sm">
                  <strong>{selectedCustomer?.name}</strong> · {selectedVehicle.brand}{" "}
                  {selectedVehicle.model} · {selectedVehicle.plate}
                </p>
                <div>
                  <label className="text-sm font-semibold">Quilometragem de entrada</label>
                  <Input
                    type="number"
                    min="0"
                    max="2000000"
                    value={entryMileage}
                    onChange={(event) => {
                      setEntryMileage(event.target.value);
                      setMileageWarningAccepted(false);
                    }}
                    placeholder={selectedVehicle.mileage.toString()}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Problema relatado</label>
                  <Textarea
                    value={complaint}
                    onChange={(event) => setComplaint(event.target.value)}
                    className="mt-2 min-h-28"
                    placeholder="Descreva com as palavras do cliente"
                  />
                </div>
              </>
            )}

            {step === 3 && selectedCustomer && selectedVehicle && (
              <div className="space-y-3 rounded-lg border bg-slate-50 p-5 text-sm">
                <div>
                  <span className="text-muted-foreground">Cliente</span>
                  <strong className="block">
                    {selectedCustomer.name} · {selectedCustomer.phone}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Veículo</span>
                  <strong className="block">
                    {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.plate}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Entrada</span>
                  <strong className="block">
                    {(entryMileage === ""
                      ? selectedVehicle.mileage
                      : Number(entryMileage)
                    ).toLocaleString("pt-BR")}{" "}
                    km · {complaint.trim()}
                  </strong>
                </div>
                {(draftCustomer || draftVehicle) && (
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    Os novos cadastros serão salvos somente junto com a OS.
                  </p>
                )}
              </div>
            )}
            {error && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isCreating}>
              Cancelar
            </Button>
            {step > 0 && (
              <Button
                variant="ghost"
                disabled={isCreating}
                onClick={() => {
                  setError("");
                  setStep((current) => current - 1);
                }}
              >
                Voltar
              </Button>
            )}
            {step === 0 && (
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={confirmCustomer}>
                Continuar
              </Button>
            )}
            {step === 1 && (
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={confirmVehicle}>
                Continuar
              </Button>
            )}
            {step === 2 && (
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={confirmOrderData}>
                Revisar
              </Button>
            )}
            {step === 3 && (
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => void createAll()}
                disabled={isCreating}
              >
                {isCreating ? "Salvando…" : "Criar ordem de serviço"}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

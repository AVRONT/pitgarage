import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  ImagePlus,
  LayoutDashboard,
  Menu,
  MessageCircle,
  PackageCheck,
  Phone,
  Play,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Video,
  WalletCards,
  Wrench,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  formatDate,
  initialCustomers,
  initialOrders,
  initialVehicles,
  money,
  orderStatuses,
  type ApprovalStatus,
  type Customer,
  type ServiceOrder,
  type Vehicle,
} from "./pilot-data";

type Screen = "dashboard" | "customers" | "vehicles" | "orders" | "customer" | "vehicle" | "order";

const navItems = [
  { id: "dashboard" as Screen, label: "Visão geral", icon: LayoutDashboard },
  { id: "customers" as Screen, label: "Clientes", icon: Users },
  { id: "vehicles" as Screen, label: "Veículos", icon: CarFront },
  { id: "orders" as Screen, label: "Ordens de serviço", icon: ClipboardList },
];

const statusStyles: Record<string, string> = {
  Recebido: "bg-slate-100 text-slate-700 border-slate-200",
  "Em diagnóstico": "bg-sky-100 text-sky-800 border-sky-200",
  "Aguardando aprovação": "bg-amber-100 text-amber-800 border-amber-200",
  "Aguardando peça": "bg-violet-100 text-violet-800 border-violet-200",
  "Em manutenção": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Serviço concluído": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Aguardando retirada": "bg-orange-100 text-orange-800 border-orange-200",
  Entregue: "bg-zinc-100 text-zinc-700 border-zinc-200",
  Aprovado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Recusado: "bg-rose-100 text-rose-800 border-rose-200",
  Pago: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Pendente: "bg-amber-100 text-amber-800 border-amber-200",
  ATIVA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EXPIRADA: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap", statusStyles[status] ?? statusStyles.Recebido)}
    >
      {status}
    </Badge>
  );
}

function VehicleIcon({ kind, className }: { kind: Vehicle["kind"]; className?: string }) {
  const Icon = kind === "Moto" ? Bike : CarFront;
  return <Icon className={className} />;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white/50 p-10 text-center">
      <FileText className="mx-auto h-8 w-8 text-slate-300" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function PilotApp() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedCustomerId, setSelectedCustomerId] = useState("c1");
  const [selectedVehicleId, setSelectedVehicleId] = useState("v1");
  const [selectedOrderId, setSelectedOrderId] = useState("OS-1048");
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [vehicles] = useState<Vehicle[]>(initialVehicles);
  const [orders, setOrders] = useState<ServiceOrder[]>(initialOrders);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pitgarage-pilot-v01");
      if (saved) {
        const parsed = JSON.parse(saved) as { customers?: Customer[]; orders?: ServiceOrder[] };
        if (parsed.customers) setCustomers(parsed.customers);
        if (parsed.orders) setOrders(parsed.orders);
      }
    } catch {
      /* demonstração continua com dados iniciais */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("pitgarage-pilot-v01", JSON.stringify({ customers, orders }));
    } catch {
      /* armazenamento local opcional */
    }
  }, [customers, orders]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const navigate = (next: Screen, id?: string) => {
    if (next === "customer" && id) setSelectedCustomerId(id);
    if (next === "vehicle" && id) setSelectedVehicleId(id);
    if (next === "order" && id) setSelectedOrderId(id);
    setScreen(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
  const updateOrder = (updated: ServiceOrder) =>
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));

  const globalResults = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return [];
    const customerResults = customers
      .filter((customer) =>
        `${customer.name} ${customer.phone} ${customer.email}`
          .toLocaleLowerCase("pt-BR")
          .includes(term),
      )
      .map((customer) => ({ type: "customer" as const, customer }));
    const vehicleResults = vehicles
      .filter((vehicle) => {
        const owner = customers.find((customer) => customer.id === vehicle.customerId);
        return `${vehicle.brand} ${vehicle.model} ${vehicle.plate} ${owner?.name} ${owner?.phone}`
          .toLocaleLowerCase("pt-BR")
          .includes(term);
      })
      .map((vehicle) => ({ type: "vehicle" as const, vehicle }));
    return [...customerResults, ...vehicleResults].slice(0, 6);
  }, [query, vehicles, customers]);

  return (
    <div className="min-h-screen bg-[#f6f4ef]">
      <Sidebar
        active={screen}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigate}
        onReset={() => setResetOpen(true)}
      />
      {menuOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <main className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-black/5 bg-[#f6f4ef]/90 px-4 backdrop-blur md:px-8">
          <Button
            className="lg:hidden"
            size="icon"
            variant="outline"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 rounded-xl border-black/5 bg-white pl-10 shadow-none"
              placeholder="Buscar cliente, placa ou veículo..."
            />
            {globalResults.length > 0 && (
              <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border bg-white shadow-xl">
                {globalResults.map((result) => {
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
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-semibold">Oficina Pit Stop</p>
              <p className="text-xs text-muted-foreground">Ambiente piloto</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              PS
            </div>
          </div>
        </header>
        {notice && (
          <div className="fixed right-5 top-24 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {notice}
          </div>
        )}
        <div className="mx-auto max-w-[1500px] p-4 md:p-8">
          {screen === "dashboard" && (
            <Dashboard
              orders={orders}
              vehicles={vehicles}
              customers={customers}
              onNavigate={navigate}
              onNewOrder={() => setNewOrderOpen(true)}
            />
          )}
          {screen === "customers" && (
            <CustomersScreen
              customers={customers}
              vehicles={vehicles}
              onOpen={(id) => navigate("customer", id)}
              onNew={() => setNewCustomerOpen(true)}
            />
          )}
          {screen === "vehicles" && (
            <VehiclesScreen
              vehicles={vehicles}
              customers={customers}
              orders={orders}
              onOpen={(id) => navigate("vehicle", id)}
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
            />
          )}
          {screen === "order" && selectedOrder && (
            <OrderDetail
              order={selectedOrder}
              vehicle={vehicles.find((item) => item.id === selectedOrder.vehicleId)!}
              customer={customers.find((item) => item.id === selectedOrder.customerId)!}
              onBack={() => navigate("orders")}
              onVehicle={(id) => navigate("vehicle", id)}
              onUpdate={updateOrder}
              notify={setNotice}
            />
          )}
        </div>
      </main>
      <NewCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onCreate={(customer) => {
          setCustomers((current) => [...current, customer]);
          setNewCustomerOpen(false);
          setNotice("Cliente criado para demonstração");
          navigate("customer", customer.id);
        }}
      />
      <NewOrderDialog
        open={newOrderOpen}
        onOpenChange={setNewOrderOpen}
        customers={customers}
        vehicles={vehicles}
        orders={orders}
        onCreate={(order) => {
          setOrders((current) => [order, ...current]);
          setNewOrderOpen(false);
          setNotice("Ordem de serviço criada");
          navigate("order", order.id);
        }}
      />
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar dados de demonstração?</DialogTitle>
            <DialogDescription>
              Clientes, ordens e alterações feitas neste navegador voltarão ao cenário original do
              Piloto v0.1.1.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCustomers(initialCustomers);
                setOrders(initialOrders);
                setSelectedCustomerId("c1");
                setSelectedVehicleId("v1");
                setSelectedOrderId("OS-1048");
                setResetOpen(false);
                setNotice("Dados de demonstração restaurados");
                navigate("dashboard");
              }}
            >
              Restaurar cenário original
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Sidebar({
  active,
  open,
  onClose,
  onNavigate,
  onReset,
}: {
  active: Screen;
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen) => void;
  onReset: () => void;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-[#1f2937] text-white transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
        <button className="flex items-center gap-3" onClick={() => onNavigate("dashboard")}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 shadow-lg shadow-orange-950/20">
            <Wrench className="h-5 w-5" />
          </span>
          <span className="text-left">
            <strong className="block text-lg tracking-tight">PITGARAGE</strong>
            <span className="text-xs text-slate-400">Piloto v0.1.1</span>
          </span>
        </button>
        <Button className="lg:hidden" size="icon" variant="ghost" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="space-y-1 p-4" aria-label="Navegação principal">
        <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Operação
        </p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
              active === item.id ||
                (item.id === "customers" && active === "customer") ||
                (item.id === "vehicles" && active === "vehicle") ||
                (item.id === "orders" && active === "order")
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon className="h-5 w-5 text-orange-400" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-sm font-medium">Ambiente de demonstração</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Dados fictícios salvos apenas neste navegador.
          </p>
          <button
            onClick={onReset}
            className="mt-3 flex items-center gap-2 text-xs font-semibold text-orange-300 hover:text-orange-200"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar dados
          </button>
        </div>
      </div>
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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
        <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
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
      value: orders.filter((o) => o.status === "Em diagnóstico").length,
      icon: Gauge,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Aguardando aprovação",
      value: orders.filter((o) => o.status === "Aguardando aprovação").length,
      icon: Clock3,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Aguardando peça",
      value: orders.filter((o) => o.status === "Aguardando peça").length,
      icon: PackageCheck,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Em manutenção",
      value: orders.filter((o) => o.status === "Em manutenção").length,
      icon: Wrench,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Prontos para retirada",
      value: orders.filter(
        (o) => o.status === "Serviço concluído" || o.status === "Aguardando retirada",
      ).length,
      icon: CheckCircle2,
      tone: "bg-cyan-50 text-cyan-700",
    },
  ];
  const pendingValue = orders
    .flatMap((o) => o.budget)
    .filter((item) => item.approval === "Aguardando aprovação")
    .reduce((sum, item) => sum + item.price, 0);
  return (
    <>
      <PageTitle
        eyebrow="Terça-feira, 1 de setembro"
        title="Bom trabalho, equipe."
        text="Aqui está o ritmo da oficina neste momento."
        action={
          <Button
            onClick={onNewOrder}
            className="h-11 gap-2 rounded-xl bg-orange-500 px-5 shadow-lg shadow-orange-200 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Nova ordem de serviço
          </Button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate("orders")}
            className="rounded-2xl bg-white text-left shadow-[0_10px_30px_rgba(31,41,55,0.05)] transition hover:-translate-y-0.5 hover:ring-2 hover:ring-orange-100"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className={cn("grid h-11 w-11 place-items-center rounded-xl", item.tone)}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <strong className="block text-2xl tracking-tight">{item.value}</strong>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            </CardContent>
          </button>
        ))}
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden border-0 bg-white shadow-[0_10px_30px_rgba(31,41,55,0.05)]">
          <div className="flex items-center justify-between border-b p-5 md:p-6">
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
          <div className="divide-y">
            {activeOrders.length === 0 && (
              <EmptyState title="Nenhuma OS ativa" text="As novas entradas aparecerão aqui." />
            )}
            {activeOrders.slice(0, 5).map((order) => {
              const vehicle = vehicles.find((v) => v.id === order.vehicleId)!;
              const customer = customers.find((c) => c.id === order.customerId)!;
              return (
                <button
                  key={order.id}
                  onClick={() => onNavigate("order", order.id)}
                  className="flex w-full items-center gap-4 p-4 text-left hover:bg-orange-50/50 md:px-6"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <VehicleIcon kind={vehicle.kind} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {vehicle.brand} {vehicle.model} {vehicle.year}
                    </strong>
                    <p className="truncate text-xs text-muted-foreground">
                      {vehicle.plate} · {customer.name} · {order.id}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <StatusBadge status={order.status} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </Card>
        <Card className="border-0 bg-slate-900 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
                  Atenção agora
                </p>
                <h2 className="mt-2 text-xl font-bold">Aprovações pendentes</h2>
              </div>
              <Clock3 className="h-6 w-6 text-orange-400" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Há {money(pendingValue)} em itens aguardando retorno dos clientes.
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
                      className="w-full rounded-xl bg-white/7 p-4 text-left hover:bg-white/10"
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
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />
      <div className="mb-5 max-w-md">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-11 rounded-xl bg-white"
          placeholder="Pesquisar por nome ou telefone"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              title="Nenhum cliente encontrado"
              text="Revise a busca ou crie um cadastro de demonstração."
            />
          </div>
        )}
        {visible.map((customer) => {
          const related = vehicles.filter((v) => v.customerId === customer.id);
          return (
            <button
              key={customer.id}
              onClick={() => onOpen(customer.id)}
              className="rounded-2xl border bg-white p-5 text-left shadow-[0_8px_24px_rgba(31,41,55,.04)] transition hover:-translate-y-0.5 hover:border-orange-200"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-100 font-bold text-orange-700">
                  {customer.name
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")}
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
              <h2 className="mt-5 font-bold">{customer.name}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </p>
              <div className="mt-4 flex items-center justify-between border-t pt-4 text-xs">
                <span className="text-muted-foreground">Cliente desde {customer.since}</span>
                <span className="font-semibold">
                  {related.length} veículo{related.length !== 1 && "s"}
                </span>
              </div>
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
}: {
  vehicles: Vehicle[];
  customers: Customer[];
  orders: ServiceOrder[];
  onOpen: (id: string) => void;
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
      />
      <div className="mb-5 max-w-md">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-11 rounded-xl bg-white"
          placeholder="Pesquisar placa, modelo ou proprietário"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              title="Nenhum veículo encontrado"
              text="Tente buscar por placa, modelo ou proprietário."
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
              className="rounded-2xl border bg-white p-5 text-left shadow-[0_8px_24px_rgba(31,41,55,.04)] transition hover:-translate-y-0.5 hover:border-orange-200"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-white">
                  <VehicleIcon kind={vehicle.kind} className="h-6 w-6" />
                </div>
                {current ? (
                  <StatusBadge status={current.status} />
                ) : (
                  <Badge variant="outline">Sem OS atual</Badge>
                )}
              </div>
              <h2 className="mt-5 text-lg font-bold">
                {vehicle.brand} {vehicle.model}
              </h2>
              <p className="text-sm text-muted-foreground">
                {vehicle.year} · {vehicle.color}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Placa</span>
                  <strong className="block font-mono text-sm">{vehicle.plate}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Quilometragem</span>
                  <strong className="block text-sm">
                    {vehicle.mileage.toLocaleString("pt-BR")} km
                  </strong>
                </div>
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                {owner.name}
              </p>
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
            <Plus className="h-4 w-4" /> Nova OS
          </Button>
        }
      />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {["Todas", ...orderStatuses].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold",
              filter === status
                ? "border-slate-900 bg-slate-900 text-white"
                : "bg-white text-muted-foreground",
            )}
          >
            {status}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden border-0 bg-white">
        <div className="divide-y">
          {visible.length === 0 && (
            <EmptyState
              title="Nenhuma OS neste estado"
              text="Escolha outro filtro ou crie uma nova ordem."
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
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 p-4 text-left hover:bg-orange-50/40 md:grid-cols-[90px_1.2fr_1fr_160px_120px_auto] md:px-6"
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
                <strong className="hidden text-sm md:block">{money(total)}</strong>
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
}: {
  customer: Customer;
  vehicles: Vehicle[];
  orders: ServiceOrder[];
  onBack: () => void;
  onVehicle: (id: string) => void;
  onOrder: (id: string) => void;
}) {
  const relatedOrders = orders.filter((o) => o.customerId === customer.id);
  return (
    <>
      <PageTitle
        back={onBack}
        eyebrow="Cliente"
        title={customer.name}
        text={`${customer.phone} · ${customer.email}`}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
}: {
  vehicle: Vehicle;
  customer: Customer;
  orders: ServiceOrder[];
  onBack: () => void;
  onCustomer: (id: string) => void;
  onOrder: (id: string) => void;
  onNewOrder: () => void;
}) {
  const current = orders.find((o) => o.status !== "Entregue");
  return (
    <>
      <PageTitle
        back={onBack}
        eyebrow={vehicle.kind}
        title={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
        text={`${vehicle.plate} · ${vehicle.mileage.toLocaleString("pt-BR")} km · ${vehicle.color}`}
        action={
          <Button
            onClick={onNewOrder}
            className="gap-2 rounded-xl bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Criar OS
          </Button>
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
    </>
  );
}

function OrderDetail({
  order,
  vehicle,
  customer,
  onBack,
  onVehicle,
  onUpdate,
  notify,
}: {
  order: ServiceOrder;
  vehicle: Vehicle;
  customer: Customer;
  onBack: () => void;
  onVehicle: (id: string) => void;
  onUpdate: (order: ServiceOrder) => void;
  notify: (text: string) => void;
}) {
  const approved = order.budget
    .filter((item) => item.approval === "Aprovado")
    .reduce((sum, item) => sum + item.price, 0);
  const total = order.budget.reduce((sum, item) => sum + item.price, 0);
  const statusIndex = orderStatuses.indexOf(order.status);
  const updateItem = (id: string, patch: Partial<ServiceOrder["budget"][number]>) =>
    onUpdate({
      ...order,
      budget: order.budget.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  const warrantyEnd = order.completedAt ? new Date(`${order.completedAt}T12:00:00Z`) : null;
  if (warrantyEnd) warrantyEnd.setUTCDate(warrantyEnd.getUTCDate() + 30);
  return (
    <>
      <PageTitle
        back={onBack}
        eyebrow={`Ordem de serviço · ${order.id}`}
        title={`${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`}
        text={`${customer.name} · entrada com ${order.entryMileage.toLocaleString("pt-BR")} km`}
        action={
          <div className="min-w-52">
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              STATUS DA OS · PROVISÓRIO
            </label>
            <select
              value={order.status}
              onChange={(e) => {
                const status = e.target.value as ServiceOrder["status"];
                onUpdate({
                  ...order,
                  status,
                  completedAt:
                    status === "Serviço concluído" && !order.completedAt
                      ? "2026-09-01"
                      : order.completedAt,
                });
                notify("Status da OS atualizado");
              }}
              className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
            >
              {orderStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <StatusBadge status={order.status} />
        <Badge variant="outline" className="bg-white">
          Responsáveis: {order.team.join(", ") || "A definir"}
        </Badge>
        <Badge variant="outline" className="bg-white">
          Aberta em {formatDate(order.openedAt)}
        </Badge>
      </div>
      <section
        className="mb-5 rounded-2xl border bg-white p-4"
        aria-label="Progresso provisório da ordem de serviço"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fluxo da ordem
            </p>
            <p className="text-sm font-semibold">
              Etapa {statusIndex + 1} de {orderStatuses.length}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Estados ainda sujeitos à validação</span>
        </div>
        <div className="flex items-start overflow-x-auto pb-1">
          {orderStatuses.map((status, index) => (
            <div key={status} className="flex min-w-28 flex-1 items-start last:min-w-20">
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "h-1.5 rounded-full",
                    index <= statusIndex ? "bg-orange-500" : "bg-slate-200",
                  )}
                />
                <p
                  className={cn(
                    "mt-2 text-[10px] leading-tight",
                    index === statusIndex ? "font-bold text-orange-700" : "text-muted-foreground",
                  )}
                >
                  {status}
                </p>
              </div>
              {index < orderStatuses.length - 1 && <span className="w-2" />}
            </div>
          ))}
        </div>
      </section>
      <Tabs defaultValue="overview">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-white p-1.5">
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
          />
        </TabsContent>
        <TabsContent value="diagnosis" className="mt-6">
          <DiagnosisPanel order={order} onUpdate={onUpdate} notify={notify} />
        </TabsContent>
        <TabsContent value="budget" className="mt-6">
          <BudgetPanel order={order} updateItem={updateItem} onUpdate={onUpdate} notify={notify} />
        </TabsContent>
        <TabsContent value="execution" className="mt-6">
          <ExecutionPanel order={order} updateItem={updateItem} />
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
}: {
  order: ServiceOrder;
  vehicle: Vehicle;
  customer: Customer;
  onVehicle: (id: string) => void;
  approved: number;
  total: number;
}) {
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
            <p className="text-xs font-semibold uppercase text-muted-foreground">Orçamento</p>
            <div className="mt-3 flex justify-between">
              <span>Total apresentado</span>
              <strong>{money(total)}</strong>
            </div>
            <div className="mt-2 flex justify-between text-emerald-700">
              <span>Total aprovado</span>
              <strong>{money(approved)}</strong>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${total ? (approved / total) * 100 : 0}%` }}
              />
            </div>
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
  onUpdate: (order: ServiceOrder) => void;
  notify: (text: string) => void;
}) {
  const [diagnosis, setDiagnosis] = useState(order.diagnosis);
  const [findings, setFindings] = useState(order.findings);
  const [notes, setNotes] = useState(order.notes);
  const addEvidence = (kind: "Foto" | "Vídeo") => {
    const evidence = {
      id: `e-${Date.now()}`,
      kind,
      name: kind === "Foto" ? "evidencia-local.jpg" : "video-diagnostico.mp4",
      caption: kind === "Foto" ? "Nova foto do diagnóstico" : "Novo vídeo do diagnóstico",
    };
    onUpdate({ ...order, evidence: [...order.evidence, evidence] });
    notify(`${kind} adicionada em modo demonstração`);
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
              onUpdate({ ...order, diagnosis, findings, notes });
              notify("Diagnóstico salvo localmente");
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
              onClick={() => addEvidence("Foto")}
              className="h-24 flex-col gap-2 bg-white/10 hover:bg-white/15"
            >
              <ImagePlus className="h-6 w-6 text-orange-400" />
              Adicionar foto
            </Button>
            <Button
              onClick={() => addEvidence("Vídeo")}
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
    </div>
  );
}

function BudgetPanel({
  order,
  updateItem,
  onUpdate,
  notify,
}: {
  order: ServiceOrder;
  updateItem: (id: string, patch: Partial<ServiceOrder["budget"][number]>) => void;
  onUpdate: (order: ServiceOrder) => void;
  notify: (text: string) => void;
}) {
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemType, setItemType] = useState<"Serviço" | "Peça">("Serviço");
  const [itemValue, setItemValue] = useState("");
  const total = order.budget.reduce((sum, item) => sum + item.price, 0);
  const approved = order.budget
    .filter((i) => i.approval === "Aprovado")
    .reduce((sum, item) => sum + item.price, 0);
  const setApproval = (id: string, approval: ApprovalStatus) => {
    updateItem(id, { approval });
    notify(`Item marcado como ${approval.toLowerCase()}`);
  };
  const addAdditional = () => {
    if (!name || !price) return;
    onUpdate({
      ...order,
      budget: [
        ...order.budget,
        {
          id: `i-${Date.now()}`,
          type: "Serviço",
          name,
          price: Number(price),
          approval: "Aguardando aprovação",
          additional: true,
          executed: false,
        },
      ],
    });
    setName("");
    setPrice("");
    setAdditionalOpen(false);
    notify("Problema adicional aguardando aprovação");
  };
  const addBudgetItem = () => {
    if (!itemName || !itemValue) return;
    const value = Number(itemValue);
    onUpdate({
      ...order,
      budget: [
        ...order.budget,
        {
          id: `i-${Date.now()}`,
          type: itemType,
          name: itemName,
          price: itemType === "Peça" ? Number((value * 1.3).toFixed(2)) : value,
          approval: "Aguardando aprovação",
          ...(itemType === "Peça" ? { cost: value, availability: "Disponível" as const } : {}),
          executed: false,
        },
      ],
    });
    setItemName("");
    setItemValue("");
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
              <div key={item.id} className={cn("p-5", item.additional && "bg-amber-50/60")}>
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
                  <Button
                    size="sm"
                    variant={item.approval === "Aprovado" ? "default" : "outline"}
                    className={cn(
                      "gap-1",
                      item.approval === "Aprovado" && "bg-emerald-600 hover:bg-emerald-700",
                    )}
                    onClick={() => setApproval(item.id, "Aprovado")}
                  >
                    <Check className="h-3.5 w-3.5" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant={item.approval === "Recusado" ? "destructive" : "outline"}
                    className="gap-1"
                    onClick={() => setApproval(item.id, "Recusado")}
                  >
                    <X className="h-3.5 w-3.5" /> Recusar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setApproval(item.id, "Aguardando aprovação")}
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
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-2"
                placeholder="0,00"
              />
            </div>
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
    </>
  );
}

function ExecutionPanel({
  order,
  updateItem,
}: {
  order: ServiceOrder;
  updateItem: (id: string, patch: Partial<ServiceOrder["budget"][number]>) => void;
}) {
  const approved = order.budget.filter((item) => item.approval === "Aprovado");
  const blocked = order.budget.filter((item) => item.approval !== "Aprovado");
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
      <Card className="border-0 bg-white">
        <CardContent className="p-6">
          <h2 className="font-bold">Serviços autorizados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque o que foi efetivamente executado.
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
                onClick={() => updateItem(item.id, { executed: !item.executed })}
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
              <div key={item.id} className="rounded-xl bg-white/70 p-3">
                <strong className="block text-sm">{item.name}</strong>
                <StatusBadge status={item.approval} />
              </div>
            ))}
          </div>
        </div>
      </aside>
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
  onUpdate: (order: ServiceOrder) => void;
  warrantyEnd: Date | null;
  notify: (text: string) => void;
}) {
  const approved = order.budget
    .filter((i) => i.approval === "Aprovado")
    .reduce((sum, item) => sum + item.price, 0);
  const [method, setMethod] = useState<"PIX" | "Cartão">(order.payment?.method ?? "PIX");
  const [status, setStatus] = useState<"Pendente" | "Pago">(order.payment?.status ?? "Pendente");
  const today = new Date("2026-09-01T12:00:00Z");
  const warrantyStatus = warrantyEnd && warrantyEnd >= today ? "ATIVA" : "EXPIRADA";
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
          <div className="mt-5 grid grid-cols-2 gap-3">
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
          <Button
            onClick={() => {
              onUpdate({
                ...order,
                payment: { amount: approved, method, status, date: "2026-09-01" },
              });
              notify("Pagamento registrado localmente");
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
    </div>
  );
}

function NewCustomerDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onCreate: (customer: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name || !phone) return;
    onCreate({ id: `c-${Date.now()}`, name, phone, email, since: "2026" });
    setName("");
    setPhone("");
    setEmail("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>
              Cadastro simplificado para demonstrar o fluxo do piloto.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-4">
            <div>
              <label className="text-sm font-semibold">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-semibold">Telefone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-semibold">E-mail</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2" />
            </div>
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

function NewOrderDialog({
  open,
  onOpenChange,
  customers,
  vehicles,
  orders,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customers: Customer[];
  vehicles: Vehicle[];
  orders: ServiceOrder[];
  onCreate: (order: ServiceOrder) => void;
}) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [mileage, setMileage] = useState("");
  const [complaint, setComplaint] = useState("");
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!vehicle || !complaint) return;
    const nextNumber =
      Math.max(...orders.map((order) => Number(order.id.replace("OS-", "")) || 0)) + 1;
    onCreate({
      id: `OS-${nextNumber}`,
      customerId: vehicle.customerId,
      vehicleId: vehicle.id,
      status: "Recebido",
      openedAt: "2026-09-01",
      entryMileage: Number(mileage) || vehicle.mileage,
      complaint,
      diagnosis: "",
      findings: "",
      notes: "",
      team: [],
      budget: [],
      evidence: [],
    });
    setComplaint("");
    setMileage("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nova ordem de serviço</DialogTitle>
            <DialogDescription>
              Registre a entrada e o problema relatado pelo cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-4">
            <div>
              <label className="text-sm font-semibold">Cliente e veículo</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-sm"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {customers.find((c) => c.id === v.customerId)?.name} · {v.brand} {v.model} ·{" "}
                    {v.plate}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Quilometragem de entrada</label>
              <Input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                className="mt-2"
                placeholder={vehicle?.mileage.toString()}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Problema relatado</label>
              <Textarea
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                className="mt-2 min-h-24"
                placeholder="Descreva com as palavras do cliente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
              Criar ordem
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

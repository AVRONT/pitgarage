import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
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
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoreVertical,

  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
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
import { usePanelRef } from "react-resizable-panels";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  SidePanel,
  SidePanelBody,
  SidePanelContent,
  SidePanelDescription,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "@/components/ui/side-panel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useAuth } from "@/features/auth/auth-context";
import { TeamSettings } from "@/features/auth/team-settings";
import { InviteForm } from "@/features/auth/invite-form";
import { UserMenu } from "@/features/auth/user-menu";
import { supabase } from "@/integrations/supabase/client";
import { CalendarScreen } from "@/features/platform/calendar-screen";
import { ChatWidget } from "@/features/platform/chat-widget";
import { NotificationBell } from "@/features/platform/notification-bell";
import { cn } from "@/lib/utils";
import { WorkshopSettings } from "./workshop-settings";
import { OperationalDashboard } from "./operational-dashboard";
import { PilotCommandPalette, type GlobalSearchResult } from "./pilot-command-palette";
import { vehicleHistory } from "./vehicle-history";
import { VehicleHistory } from "./vehicle-history-timeline";
import { WorkshopIdentity } from "./workshop-document-header";
import { defaultWorkshop, readWorkshop, type Workshop } from "./workshop-data";
import { loadWorkshop } from "./workshop-api";
import { FinalOrderSummary } from "./final-order-summary";
import {
  formatDate,
  formatDateTime,
  isOrderCancelled,
  logicallyDeleteCustomer,
  logicallyDeleteVehicle,
  money,
  orderCancelBlocker,
  orderDeleteBlockers,
  orderStatuses,
  orderWarrantyDays,
  warrantyDays,
  warrantyDeadline,

  type ApprovalStatus,
  type Customer,
  type OrderActivity,
  type ServiceOrder,
  type Vehicle,
} from "./pilot-data";

import { createOperationalRepository, OrderVersionConflict } from "./operational-repository";
import { FinancialScreen, PartFinancialEditor } from "./financial-screen";
import { financialApi, type SavePart } from "./financial-api";
import { AddBudgetItemDialog } from "./add-budget-item-dialog";
import type { BudgetMutation } from "./financial-model";
import { RemoveBudgetItem } from "./remove-budget-item";
import { OrderPayments } from "./order-payments";
import { activityAuthorName, useActivityAuthors, type ActivityAuthors } from "./activity-author";
import { paymentSummary, customerDebts } from "./payment-model";
import { QuotesScreen } from "./quotes-screen";
import { ExportOperationalBackup } from "./pilot-backup-settings";
import { createBackup } from "./pilot-storage";
import { EvidenceMedia, OrderEvidence, type SaveEvidence } from "./order-evidence";
import { QuickOrderDialog } from "./quick-order-dialog";
import { quickOrderBudgetItem, orderVehicleLabel, type QuickOrderDraft } from "./quick-order-model";
import {
  isBasicCpfValid,
  isBasicEmailValid,
  formatCpfInput,
  formatPhoneInput,
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
type QuickView =
  | { type: "customer"; id: string }
  | { type: "vehicle"; id: string }
  | { type: "order"; id: string };

type AssignableMember = {
  user_id: string;
  full_name: string | null;
  operational_role: string | null;
};

const orderTimestamp = () => new Date().toISOString();
const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const migrateOrder = (order: ServiceOrder): ServiceOrder => {
  const createdAt = `${order.openedAt}T12:00:00-03:00`;
  return {
    ...order,
    statusHistory: order.statusHistory ?? [],
    activities: order.activities ?? [
      { id: `a-${order.id}-created`, type: "created", description: "OS criada", at: createdAt },
    ],
    updatedAt: order.updatedAt ?? createdAt,
    // OS concluídas antes do snapshot mantêm a garantia original de 30 dias.
    ...(order.completedAt && order.warrantyDays == null ? { warrantyDays: 30 } : {}),
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
        ? { completedAt: new Date().toISOString().slice(0, 10), warrantyDays }
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
  | "financial"
  | "dashboard"
  | "calendar"
  | "customers"
  | "vehicles"
  | "orders"
  | "quotes"
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
  { id: "quotes" as Screen, label: "Orçamentos", icon: FileText },
  { id: "settings" as Screen, label: "Configurações da oficina", icon: Settings2 },
  { id: "financial" as Screen, label: "Financeiro", icon: WalletCards },
];


const sidebarPreferenceKey = "pitgarage:desktop-sidebar";
const sidebarDefaultWidth = 256;
const sidebarMinWidth = 210;
const sidebarMaxWidth = 320;
const sidebarCollapsedWidth = 64;

const readSidebarPreference = () => {
  if (typeof window === "undefined") {
    return { width: sidebarDefaultWidth, collapsed: false };
  }
  try {
    const saved = JSON.parse(window.localStorage.getItem(sidebarPreferenceKey) ?? "null") as {
      width?: unknown;
      collapsed?: unknown;
    } | null;
    const width =
      typeof saved?.width === "number" &&
      Number.isFinite(saved.width) &&
      saved.width >= sidebarMinWidth &&
      saved.width <= sidebarMaxWidth
        ? saved.width
        : sidebarDefaultWidth;
    return { width, collapsed: saved?.collapsed === true };
  } catch {
    return { width: sidebarDefaultWidth, collapsed: false };
  }
};

const useDesktopLayout = () => {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(min-width: 1024px)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
};

function PilotShellLayout({
  desktop,
  sidebar,
  mobileOverlay,
  collapsed,
  width,
  panelRef,
  onCollapsedChange,
  onWidthChange,
  children,
}: {
  desktop: boolean;
  sidebar: ReactNode;
  mobileOverlay: ReactNode;
  collapsed: boolean;
  width: number;
  panelRef: ReturnType<typeof usePanelRef>;
  onCollapsedChange: (collapsed: boolean) => void;
  onWidthChange: (width: number) => void;
  children: ReactNode;
}) {
  if (!desktop) {
    return (
      <>
        {sidebar}
        {mobileOverlay}
        {children}
      </>
    );
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-screen min-h-0 overflow-hidden"
      resizeTargetMinimumSize={{ fine: 14, coarse: 24 }}
    >
      <ResizablePanel
        id="pilot-sidebar"
        className="bg-sidebar"
        panelRef={panelRef}
        defaultSize={collapsed ? sidebarCollapsedWidth : width}
        minSize={sidebarMinWidth}
        maxSize={sidebarMaxWidth}
        collapsedSize={sidebarCollapsedWidth}
        collapsible
        groupResizeBehavior="preserve-pixel-size"
        onResize={({ inPixels }) => {
          if (inPixels <= sidebarCollapsedWidth + 1) {
            onCollapsedChange(true);
          } else if (inPixels >= sidebarMinWidth) {
            onCollapsedChange(false);
            onWidthChange(Math.min(sidebarMaxWidth, Math.max(sidebarMinWidth, inPixels)));
          }
        }}
      >
        {sidebar}
      </ResizablePanel>
      <ResizableHandle className="sidebar-resize-handle bg-transparent" />
      <ResizablePanel id="pilot-content" className="min-h-0 overflow-hidden" minSize={480}>
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

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
      <div className="relative overflow-x-auto px-1 pb-1 pt-1">
        <div className="min-w-[760px] px-3">
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
  const { isLocalBypass, accessLevel } = useAuth();
  const canEditWorkshop = accessLevel === "owner" || accessLevel === "admin";
  const repository = useMemo(() => createOperationalRepository(isLocalBypass), [isLocalBypass]);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedOrderTab, setSelectedOrderTab] = useState("overview");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const ordersRef = useRef(orders);
  const writeQueue = useRef(Promise.resolve());
  const writeFailed = useRef(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [orderConflict, setOrderConflict] = useState<{
    order: ServiceOrder;
    message: string;
  } | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);
  const [reloadingOrder, setReloadingOrder] = useState(false);
  const [reloadError, setReloadError] = useState("");
  const [orderReloadRevision, setOrderReloadRevision] = useState(0);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [orderActionBusy, setOrderActionBusy] = useState(false);
  const [orderActionError, setOrderActionError] = useState("");

  const [query, setQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickView, setQuickView] = useState<QuickView | null>(null);
  const commandTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarPreference] = useState(readSidebarPreference);
  const [sidebarWidth, setSidebarWidth] = useState(sidebarPreference.width);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(sidebarPreference.collapsed);
  const desktop = useDesktopLayout();
  const sidebarPanelRef = usePanelRef();
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newVehicleOpen, setNewVehicleOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [initialQuickDraft, setInitialQuickDraft] = useState<QuickOrderDraft>();
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [workshop, setWorkshop] = useState<Workshop>(defaultWorkshop);

  useEffect(() => {
    if (isLocalBypass) {
      setWorkshop(readWorkshop());
      return;
    }
    let active = true;
    void loadWorkshop()
      .then((value) => {
        if (active) setWorkshop(value);
      })
      .catch(() => {
        // Sem a configuração central, os documentos usam o padrão até a próxima leitura.
      });
    return () => {
      active = false;
    };
  }, [isLocalBypass]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          sidebarPreferenceKey,
          JSON.stringify({ width: sidebarWidth, collapsed: sidebarCollapsed }),
        );
      } catch {
        // A preferência visual não deve impedir o uso do sistema.
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [sidebarCollapsed, sidebarWidth]);

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

  useEffect(() => {
    const openCommandPalette = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase("pt-BR") !== "k" || (!event.ctrlKey && !event.metaKey))
        return;
      event.preventDefault();
      setCommandOpen(true);
    };
    document.addEventListener("keydown", openCommandPalette);
    return () => document.removeEventListener("keydown", openCommandPalette);
  }, []);

  const changeCommandOpen = (open: boolean) => {
    setCommandOpen(open);
    if (!open) {
      setQuery("");
      requestAnimationFrame(() => commandTriggerRef.current?.focus());
    }
  };

  const navigate = (next: Screen, id?: string, orderTab?: string) => {
    if (next === "customer" && id) setSelectedCustomerId(id);
    if (next === "vehicle" && id) setSelectedVehicleId(id);
    if (next === "order" && id) {
      setSelectedOrderId(id);
      setSelectedOrderTab(orderTab ?? "overview");
    }
    setScreen(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Conversão de orçamento avulso: a OS já foi criada no banco, aqui só sincronizamos a tela.
  const handleQuoteConverted = async (orderId: string) => {
    const data = await repository.load();
    setCustomers(data.customers);
    setVehicles(data.vehicles);
    const list = data.orders.map(migrateOrder);
    ordersRef.current = list;
    setOrders(list);
    const created = list.find((order) => order.databaseId === orderId || order.id === orderId);
    navigate(created ? "order" : "orders", created?.id);
  };

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0];
  const activeCustomers = customers.filter((customer) => !customer.deletedAt);
  const activeVehicles = vehicles.filter(
    (vehicle) =>
      !vehicle.deletedAt && activeCustomers.some((customer) => customer.id === vehicle.customerId),
  );
  const operationalOrders = orders.filter(
    (order) =>
      !isOrderCancelled(order) &&
      activeCustomers.some((customer) => customer.id === order.customerId) &&
      (order.flowType === "quick" || activeVehicles.some((vehicle) => vehicle.id === order.vehicleId)),
  );

  // Toda falha de gravação precisa de um caminho explícito de volta ao estado do banco:
  // sem isso a trava de gravação ficava ligada silenciosamente até o F5.
  const requireOrderSync = (order: ServiceOrder, message: string) => {
    writeFailed.current = true;
    setNotice("");
    setOrderConflict({ order, message });
  };
  const syncMessage =
    "Não foi possível confirmar a gravação desta OS. Recarregue para ver exatamente o que está salvo no banco antes de continuar.";
  const persist = (operation: () => Promise<void>, savingOrder?: ServiceOrder) => {
    if (writeFailed.current) {
      if (savingOrder) requireOrderSync(savingOrder, syncMessage);
      return;
    }
    setPendingWrites((count) => count + 1);
    writeQueue.current = writeQueue.current
      .then(async () => {
        if (writeFailed.current) return;
        try {
          await operation();
        } catch (error) {
          if (savingOrder) {
            requireOrderSync(
              savingOrder,
              error instanceof OrderVersionConflict ? error.message : syncMessage,
            );
            return;
          }
          writeFailed.current = true;
          setNotice("");
          setDataError(
            "Não foi possível confirmar a gravação. A OS pode ter mudado ou seu acesso pode ter expirado. Recarregue para conferir os dados salvos antes de continuar.",
          );
        }
      })
      .finally(() => setPendingWrites((count) => count - 1));
  };
  const evidenceWrite = useRef(false);
  const financialWrite = useRef(false);
  const savePart = (id: string, input: BudgetMutation) => {
    if (writeFailed.current || financialWrite.current || evidenceWrite.current)
      return Promise.reject(new Error("Aguarde a gravação ou recarregue a OS antes de continuar."));
    financialWrite.current = true;
    setPendingWrites((count) => count + 1);
    const operation = writeQueue.current
      .then(async () => {
        if (writeFailed.current) throw new Error("Recarregue a OS antes de continuar.");

        const current = ordersRef.current.find((item) => item.id === id);
        if (!current) throw new Error("OS não encontrada.");
        try {
          const updated = await repository.savePartFinancial(current, input);
          ordersRef.current = ordersRef.current.map((item) =>
            item.id === id ? migrateOrder(updated) : item,
          );
          setOrders(ordersRef.current);
          setNotice("discount" in input ? "Desconto comercial salvo." : "receipt" in input ? "Recebimento registrado." : "removeItem" in input ? "Item removido do orçamento." : input.newItem ? "Item adicionado ao orçamento." : "Dados da peça salvos.");
        } catch (error) {
          if (error instanceof OrderVersionConflict) requireOrderSync(current, error.message);
          throw error;
        }

      })
      .finally(() => {
        financialWrite.current = false;
        setPendingWrites((count) => count - 1);
      });
    writeQueue.current = operation.catch(() => undefined);
    return operation;
  };
  const saveEvidence = (id: string, change: Parameters<SaveEvidence>[0], description: string) => {
    if (writeFailed.current || evidenceWrite.current || financialWrite.current)
      return Promise.reject(new Error("Aguarde a gravação ou recarregue a OS antes de continuar."));
    evidenceWrite.current = true;
    setPendingWrites((count) => count + 1);
    const operation = writeQueue.current
      .then(async () => {
        if (writeFailed.current)
          throw new Error("Recarregue a OS para conferir a gravação anterior.");
        const current = ordersRef.current.find((item) => item.id === id);
        if (!current) throw new Error("OS não encontrada.");
        const updated = withActivity(current, "diagnosis", description, {
          evidence: change(current.evidence),
        });
        try {
          await repository.saveOrder(updated);
        } catch (error) {
          requireOrderSync(
            current,
            error instanceof OrderVersionConflict ? error.message : syncMessage,
          );
          throw new Error(
            "Não foi possível confirmar a gravação da evidência. Recarregue a OS para conferir a versão salva.",
          );
        }

        ordersRef.current = ordersRef.current.map((item) => (item.id === id ? updated : item));
        setOrders(ordersRef.current);
      })
      .finally(() => {
        evidenceWrite.current = false;
        setPendingWrites((count) => count - 1);
      });
    writeQueue.current = operation.catch(() => undefined);
    return operation;
  };
  const updateOrder = (id: string, updater: OrderUpdater) => {
    if (evidenceWrite.current || financialWrite.current) {
      setNotice("Aguarde a gravação antes de alterar a OS.");
      return;
    }
    const order = ordersRef.current.find((item) => item.id === id);
    if (!order) return;
    // Nunca alterar a tela sem gravação confirmada: com a trava ligada, exigir sincronização.
    if (writeFailed.current) {
      requireOrderSync(order, syncMessage);
      return;
    }

    if (isOrderCancelled(order)) {
      setNotice("OS cancelada é somente leitura.");
      return;
    }
    const updated = updater(order);
    ordersRef.current = ordersRef.current.map((item) => (item.id === id ? updated : item));
    setOrders(ordersRef.current);
    persist(() => repository.saveOrder(updated), updated);
  };
  const runOrderAction = async (
    id: string,
    action: (order: ServiceOrder) => Promise<ServiceOrder | null>,
  ) => {
    if (writeFailed.current || orderActionBusy || evidenceWrite.current || financialWrite.current) {
      setOrderActionError("Aguarde a gravação em andamento antes de continuar.");
      return false;
    }
    setOrderActionBusy(true);
    setOrderActionError("");
    setPendingWrites((count) => count + 1);
    const operation = writeQueue.current
      .then(async () => {
        const current = ordersRef.current.find((item) => item.id === id);
        if (!current) throw new Error("OS não encontrada.");
        try {
          const result = await action(current);
          ordersRef.current = result
            ? ordersRef.current.map((item) => (item.id === id ? migrateOrder(result) : item))
            : ordersRef.current.filter((item) => item.id !== id);
          setOrders(ordersRef.current);
          return true;
        } catch (error) {
          if (error instanceof OrderVersionConflict) requireOrderSync(current, error.message);
          throw error;
        }

      })
      .finally(() => {
        setOrderActionBusy(false);
        setPendingWrites((count) => count - 1);
      });
    writeQueue.current = operation.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await operation;
    } catch (error) {
      setOrderActionError(
        error instanceof Error ? error.message : "Não foi possível concluir a ação.",
      );
      return false;
    }
  };
  const deleteOrderPermanently = async (id: string) => {
    const done = await runOrderAction(id, async (order) => {
      await repository.deleteOrder(order);
      return null;
    });
    if (done) {
      setNotice(`${id} excluída definitivamente.`);
      navigate("orders");
    }
    return done;
  };
  const cancelOrderWithReason = async (id: string, reason: string) => {
    const done = await runOrderAction(id, (order) => repository.cancelOrder(order, reason));
    if (done) setNotice(`${id} cancelada. Os dados foram preservados no histórico.`);
    return done;
  };
  const updateOrderComplaint = async (id: string, complaint: string) => {
    const done = await runOrderAction(id, (order) => repository.updateComplaint(order, complaint));
    if (done) setNotice("Problema relatado atualizado.");
    return done;
  };


  const reloadConflictedOrder = async () => {
    if (!orderConflict || reloadingOrder) return;
    setReloadingOrder(true);
    setReloadError("");
    try {
      await writeQueue.current;
      const latest = migrateOrder(await repository.reloadOrder(orderConflict.order));
      ordersRef.current = ordersRef.current.map((order) =>
        order.id === orderConflict.order.id ? latest : order,
      );
      setOrders(ordersRef.current);
      navigate("order", latest.id, selectedOrderTab);
      setOrderReloadRevision((revision) => revision + 1);
      writeFailed.current = false;
      setOrderConflict(null);
      setConfirmReload(false);
      setNotice("OS recarregada. A versão mais recente está disponível.");
    } catch {
      setReloadError(
        "Não foi possível recarregar a OS. Sua versão local foi mantida. Tente novamente.",
      );
    } finally {
      setReloadingOrder(false);
    }
  };

  const globalResults = useMemo<GlobalSearchResult[]>(() => {
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
    return [...orderResults, ...customerResults, ...vehicleResults].slice(0, 18);
  }, [query, activeVehicles, activeCustomers, customers, orders]);

  const selectGlobalResult = (result: GlobalSearchResult) => {
    if (result.type === "customer") navigate("customer", result.customer.id);
    else if (result.type === "vehicle") navigate("vehicle", result.vehicle.id);
    else navigate("order", result.order.id);
  };

  if (dataLoading) {
    return (
      <main className="dashboard-premium min-h-screen bg-background p-5 md:p-10">
        <div className="mx-auto max-w-6xl" role="status" aria-label="Carregando Visão Geral">
          <div className="h-7 w-56 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="h-96 animate-pulse rounded-lg border bg-white shadow-sm motion-reduce:animate-none" />
            <div className="h-80 animate-pulse rounded-lg border bg-white shadow-sm motion-reduce:animate-none" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Carregando dados operacionais…</p>
        </div>
      </main>
    );
  }

  if (dataError) {
    return (
      <main className="dashboard-premium grid min-h-screen place-items-center bg-background px-4 text-center">
        <div className="dashboard-surface max-w-md rounded-lg border bg-white p-7 shadow-sm">
          <AlertTriangle className="mx-auto h-7 w-7 text-rose-600" />
          <h1 className="mt-4 text-xl font-bold">Visão Geral indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{dataError}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="pilot-shell min-h-screen bg-background">
      <Dialog open={Boolean(orderConflict)} onOpenChange={() => {}}>
        <DialogContent
          className="[&>button]:hidden"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {confirmReload
                ? "Substituir a versão local desta OS?"
                : "É preciso recarregar esta OS"}
            </DialogTitle>
            <DialogDescription>
              {confirmReload
                ? "A versão mais recente do servidor substituirá as alterações locais não salvas desta OS. Nenhuma alteração antiga será reaplicada."
                : orderConflict?.message}
            </DialogDescription>
          </DialogHeader>
          {reloadError && (
            <p role="alert" className="text-sm text-destructive">
              {reloadError}
            </p>
          )}
          <DialogFooter>
            {confirmReload && (
              <Button
                variant="outline"
                disabled={reloadingOrder}
                onClick={() => setConfirmReload(false)}
              >
                Voltar
              </Button>
            )}
            <Button
              disabled={reloadingOrder || pendingWrites > 0}
              onClick={() =>
                confirmReload ? void reloadConflictedOrder() : setConfirmReload(true)
              }
            >
              {reloadingOrder
                ? "Recarregando OS…"
                : confirmReload
                  ? "Confirmar recarga"
                  : "Recarregar OS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PilotCommandPalette
        open={commandOpen}
        query={query}
        results={globalResults}
        customers={customers}
        vehicles={vehicles}
        onOpenChange={changeCommandOpen}
        onQueryChange={setQuery}
        onSelectResult={selectGlobalResult}
        onNewOrder={() => setNewOrderOpen(true)}
        onNavigate={(target) => navigate(target)}
      />
      <PilotQuickView
        selection={quickView}
        customers={customers}
        vehicles={vehicles}
        orders={orders}
        onClose={() => setQuickView(null)}
        onNavigate={(target, id) => {
          setQuickView(null);
          navigate(target, id);
        }}
      />
      <PilotShellLayout
        desktop={desktop}
        collapsed={sidebarCollapsed}
        width={sidebarWidth}
        panelRef={sidebarPanelRef}
        onCollapsedChange={setSidebarCollapsed}
        onWidthChange={setSidebarWidth}
        sidebar={
          <Sidebar
            active={screen}
            open={menuOpen}
            desktop={desktop}
            onClose={() => setMenuOpen(false)}
            onNavigate={navigate}
            onReset={() => setResetOpen(true)}
            showDevelopmentTools={isLocalBypass}
            collapsed={sidebarCollapsed}
            onCollapsedChange={(nextCollapsed) => {
              setSidebarCollapsed(nextCollapsed);
              if (nextCollapsed) sidebarPanelRef.current?.collapse();
              else {
                sidebarPanelRef.current?.expand();
                requestAnimationFrame(() => sidebarPanelRef.current?.resize(sidebarWidth));
              }
            }}
          />
        }
        mobileOverlay={
          menuOpen ? (
            <button
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            />
          ) : null
        }
      >
        <main className="pilot-main min-h-screen min-w-0 lg:h-screen lg:min-h-0 lg:overflow-y-auto">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b px-4 md:gap-4 md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,32rem)_minmax(0,1fr)]">
            <Button
              className="lg:hidden"
              size="icon"
              variant="outline"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative min-w-0 max-w-md flex-1 lg:col-start-2 lg:w-full lg:max-w-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60" />
              <button
                ref={commandTriggerRef}
                type="button"
                className="group flex h-10 w-full items-center rounded-md border border-slate-300/90 bg-slate-50/80 pl-10 pr-2 text-left text-sm text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_1px_2px_rgba(15,23,42,.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-primary/35 hover:bg-white focus-visible:border-primary/45 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/10"
                onClick={() => setCommandOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={commandOpen}
              >
                <span className="min-w-0 flex-1 truncate">
                  Buscar cliente, placa, veículo ou OS...
                </span>
                <span className="ml-3 hidden items-center gap-1 sm:flex" aria-hidden="true">
                  <kbd className="command-kbd">Ctrl / ⌘</kbd>
                  <kbd className="command-kbd">K</kbd>
                </span>
              </button>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 lg:col-start-3 lg:ml-0 lg:justify-self-end">
              {!isLocalBypass && <NotificationBell />}
              <UserMenu />
            </div>
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
            {screen === "financial" && <FinancialScreen />}
            {screen === "quotes" && (
              <QuotesScreen
                customers={activeCustomers}
                vehicles={activeVehicles}
                workshop={workshop}
                onConverted={handleQuoteConverted}
              />
            )}
            {screen === "settings" && (
              <>
                <nav className="settings-nav" aria-label="Seções das configurações">
                  <a href="#oficina">Oficina e documentos</a>
                  <a href="#backup">Dados e backup</a>
                  <a href="#equipe">Equipe e acessos</a>
                </nav>
                <WorkshopSettings
                  key={JSON.stringify(workshop)}
                  workshop={workshop}
                  canEdit={canEditWorkshop && !isLocalBypass}
                  onSave={setWorkshop}
                />
                <section
                  id="backup"
                  className="mt-7 scroll-mt-28 rounded-lg border bg-white p-5 sm:p-6"
                >
                  <h2 className="font-semibold">Backup dos dados operacionais</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isLocalBypass
                      ? "Este ambiente usa dados locais de desenvolvimento isolados. O backup legado do piloto não é carregado automaticamente."
                      : "Exporte clientes, veículos, OS e configurações da oficina em JSON. Fotos e vídeos não são incluídos, apenas suas referências. Este arquivo não substitui o backup completo do cloud e não inclui as tabelas financeiras protegidas. O backup automático de 72h não é alterado por esta ação."}
                  </p>
                  <ExportOperationalBackup
                    disabled={dataLoading || pendingWrites > 0 || Boolean(dataError)}
                    load={async () => createBackup(await createOperationalRepository(isLocalBypass).load(), workshop)}
                  />
                </section>
                <TeamSettings />
              </>
            )}
            {screen === "calendar" &&
              (isLocalBypass ? (
                <p className="rounded-lg border bg-white p-6">
                  Agenda cloud requer uma sessão real.
                </p>
              ) : (
                <CalendarScreen />
              ))}
            {screen === "dashboard" && (
              <OperationalDashboard
                orders={operationalOrders}
                vehicles={activeVehicles}
                customers={activeCustomers}
                onNavigate={(target) =>
                  navigate(
                    target.screen,
                    "id" in target ? target.id : undefined,
                    "tab" in target ? target.tab : undefined,
                  )
                }
                onNewOrder={() => setNewOrderOpen(true)}
                onNewQuickOrder={() => setQuickOrderOpen(true)}
              />
            )}
            {screen === "customers" && (
              <CustomersScreen
                customers={activeCustomers}
                vehicles={activeVehicles}
                orders={orders}
                onOpen={(id) => setQuickView({ type: "customer", id })}
                onNew={() => setNewOrderOpen(true)}
              />
            )}
            {screen === "vehicles" && (
              <VehiclesScreen
                vehicles={activeVehicles}
                customers={activeCustomers}
                orders={orders}
                onOpen={(id) => setQuickView({ type: "vehicle", id })}
                onNew={() => setNewOrderOpen(true)}
              />
            )}
            {screen === "orders" && (
              <OrdersScreen
                orders={orders.filter((item) => !isOrderCancelled(item))}

                vehicles={vehicles}
                customers={customers}
                onOpen={(id) => setQuickView({ type: "order", id })}
                onNew={() => setNewOrderOpen(true)}
                onNewQuick={() => setQuickOrderOpen(true)}
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
                vehicles={vehicles}
                orders={orders.filter((item) => item.vehicleId === selectedVehicleId)}
                onSave={async (updated) => {
                  const saved = await repository.updateVehicle(updated);
                  setVehicles((current) =>
                    current.map((item) => (item.id === saved.id ? saved : item)),
                  );
                  setNotice("Cadastro do veículo atualizado");
                }}
                onBack={() => navigate("vehicles")}
                onCustomer={(id) => navigate("customer", id)}
                onOrder={(id) => navigate("order", id)}
                onNewOrder={() => setNewOrderOpen(true)}
                onDelete={() => {
                  const at = orderTimestamp();
                  persist(async () => {
                    await repository.deleteVehicle(selectedVehicleId, at);
                    setVehicles((current) =>
                      logicallyDeleteVehicle(current, selectedVehicleId, at),
                    );
                    setNotice("Veículo removido das áreas operacionais; histórico preservado");
                    navigate("vehicles");
                  });
                }}
              />
            )}
            {screen === "order" && selectedOrder && (
              <div inert={evidenceWrite.current || financialWrite.current}>
                <OrderDetail
                  key={`${selectedOrder.id}-${selectedOrderTab}-${orderReloadRevision}`}
                  order={selectedOrder}
                  initialTab={selectedOrderTab}
                  workshop={workshop}
                  vehicle={vehicles.find((item) => item.id === selectedOrder.vehicleId)}
                  customer={customers.find((item) => item.id === selectedOrder.customerId)!}
                  onBack={() => navigate("orders")}
                  onVehicle={(id) => navigate("vehicle", id)}
                  onUpdate={(updater) => updateOrder(selectedOrder.id, updater)}
                  onSavePart={(input) => savePart(selectedOrder.id, input)}
                  onSaveEvidence={(change, description) =>
                    saveEvidence(selectedOrder.id, change, description)
                  }
                  notify={setNotice}
                  canManage={
                    (accessLevel === "owner" || accessLevel === "admin") && !isLocalBypass
                  }
                  actionBusy={orderActionBusy}
                  actionError={orderActionError}
                  onDelete={() => deleteOrderPermanently(selectedOrder.id)}
                  onCancel={(reason) => cancelOrderWithReason(selectedOrder.id, reason)}
                  onEditComplaint={(complaint) =>
                    updateOrderComplaint(selectedOrder.id, complaint)
                  }

                />
              </div>
            )}
          </div>
        </main>
      </PilotShellLayout>
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
        onOpenChange={(open) => { setNewOrderOpen(open); if (!open) setInitialQuickDraft(undefined); }}
        customers={activeCustomers}
        vehicles={activeVehicles}
        allCustomers={customers}
        allVehicles={vehicles}
        orders={orders}
        initialQuickDraft={initialQuickDraft}
        onCreate={async (bundle) => {
          await writeQueue.current;
          if (writeFailed.current) throw new Error("Recarregue os dados antes de criar outra OS.");
          await repository.createOrder(bundle).then((data) => {
            setCustomers(data.customers);
            setVehicles(data.vehicles);
            setOrders(data.orders.map(migrateOrder));
            const createdOrder = data.orders[0];
            setNewOrderOpen(false);
            setInitialQuickDraft(undefined);
            setNotice("Ordem de serviço criada");
            if (createdOrder) navigate("order", createdOrder.id);
          });
        }}
      />
      <QuickOrderDialog
        open={quickOrderOpen}
        onOpenChange={setQuickOrderOpen}
        customers={activeCustomers}
        vehicles={activeVehicles}
        onFinalize={async (draft) => {
          const data = await repository.createQuickOrder(draft, workshop);
          setCustomers(data.customers); setVehicles(data.vehicles); setOrders(data.orders.map(migrateOrder));
          const created = data.orders[0]; setQuickOrderOpen(false); setNotice("Atendimento rápido finalizado");
          if (created) navigate("order", created.id);
        }}
        onContinueAsStandard={(draft) => {
          setInitialQuickDraft(draft); setQuickOrderOpen(false); setNewOrderOpen(true);
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

function CollapsedSidebarRail({
  active,
  onNavigate,
  onReset,
  onExpand,
  showDevelopmentTools,
}: {
  active: Screen;
  onNavigate: (screen: Screen) => void;
  onReset: () => void;
  onExpand: () => void;
  showDevelopmentTools: boolean;
}) {
  const isItemActive = (id: Screen) =>
    active === id ||
    (id === "customers" && active === "customer") ||
    (id === "vehicles" && active === "vehicle") ||
    (id === "orders" && active === "order");

  return (
    <TooltipProvider delayDuration={200}>
      <aside className="pilot-sidebar flex h-screen w-full flex-col border-r border-white/10 bg-sidebar px-2 py-3 text-white">
        <div className="flex flex-col items-center gap-2 border-b border-white/10 pb-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="brand-mark grid h-9 w-9 place-items-center rounded-md bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Ir para Visão geral"
          >
            <img src="/pitgarage-logo.png" alt="" className="h-full w-full object-contain" />
          </button>
          <button
            onClick={onExpand}
            className="grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white/[.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Expandir barra lateral"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
        <nav className="mt-3 flex flex-col gap-1" aria-label="Navegação principal">
          {navItems.map((item) => {
            const itemActive = isItemActive(item.id);
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onNavigate(item.id)}
                    aria-label={item.label}
                    aria-current={itemActive ? "page" : undefined}
                    className={cn(
                      "relative grid h-10 w-full place-items-center rounded-md transition-colors before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                      itemActive
                        ? "bg-white/[.09] text-white before:bg-orange-400"
                        : "text-slate-500 hover:bg-white/[.05] hover:text-slate-200",
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", itemActive && "text-orange-400")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
        {showDevelopmentTools && (
          <div className="mt-auto border-t border-white/10 pt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onReset}
                  className="grid h-10 w-full place-items-center rounded-md text-orange-300 transition-colors hover:bg-white/[.05] hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                  aria-label="Ambiente local isolado: limpar dados locais"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Ambiente local isolado · Limpar dados locais
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

function Sidebar({
  active,
  open,
  desktop,
  onClose,
  onNavigate,
  onReset,
  showDevelopmentTools,
  collapsed,
  onCollapsedChange,
}: {
  active: Screen;
  open: boolean;
  desktop: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen) => void;
  onReset: () => void;
  showDevelopmentTools: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  if (desktop && collapsed) {
    return (
      <CollapsedSidebarRail
        active={active}
        onNavigate={onNavigate}
        onReset={onReset}
        onExpand={() => onCollapsedChange(false)}
        showDevelopmentTools={showDevelopmentTools}
      />
    );
  }

  const isItemActive = (id: Screen) =>
    active === id ||
    (id === "customers" && active === "customer") ||
    (id === "vehicles" && active === "vehicle") ||
    (id === "orders" && active === "order");

  return (
    <TooltipProvider delayDuration={250}>
      <aside
        className={cn(
          "pilot-sidebar relative overflow-hidden border-r border-white/10 bg-sidebar text-white",
          desktop
            ? "h-screen w-full"
            : cn(
                "fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 ease-out motion-reduce:transition-none",
                open ? "translate-x-0" : "-translate-x-full",
              ),
        )}
      >
        <div
          className={cn(
            "flex h-[4.5rem] items-center justify-between border-b border-white/10 px-3",
            collapsed && "lg:px-2",
          )}
        >
          <button
            className={cn("flex min-w-0 items-center gap-3", collapsed && "lg:gap-1")}
            onClick={() => onNavigate("dashboard")}
            aria-label={collapsed ? "Ir para Visão geral" : undefined}
          >
            <span
              className={cn(
                "brand-mark grid h-8 w-8 shrink-0 place-items-center rounded-md bg-orange-600",
                collapsed && "lg:h-7 lg:w-7",
              )}
              aria-hidden="true"
            >
              <img src="/pitgarage-logo.png" alt="" className="h-full w-full object-contain" />
            </span>
            <span className={cn("text-left", collapsed && "lg:hidden")}>
              <strong className="block text-sm font-semibold leading-none tracking-tight">
                PitGarage
              </strong>
              <span className="mt-1 block text-[11px] leading-none text-slate-300">
                Operação da oficina
              </span>
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
          <Button
            className={cn(
              "hidden h-8 w-8 shrink-0 text-slate-400 hover:bg-white/10 hover:text-white lg:inline-flex",
              collapsed && "h-7 w-7",
            )}
            size="icon"
            variant="ghost"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <nav
          className={cn("space-y-1 px-3 py-3", collapsed && "lg:px-2")}
          aria-label="Navegação principal"
        >
          <p
            className={cn(
              "px-3 pb-2 pt-3 text-[11px] font-semibold tracking-wide text-slate-300",
              collapsed && "lg:sr-only",
            )}
          >
            Operação
          </p>
          {navItems.map((item) => {
            const itemActive = isItemActive(item.id);
            const navigationButton = (
              <button
                onClick={() => onNavigate(item.id)}
                aria-label={collapsed ? item.label : undefined}
                aria-current={itemActive ? "page" : undefined}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent",
                  collapsed && "lg:justify-center lg:px-0",
                  itemActive
                    ? "bg-white/8 text-white before:bg-orange-500"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    itemActive ? "text-orange-400" : "text-slate-500",
                  )}
                />
                <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
              </button>
            );
            return desktop && collapsed ? (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{navigationButton}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.id}>{navigationButton}</div>
            );
          })}
        </nav>
        {showDevelopmentTools && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 border-t border-white/10 p-4",
              collapsed && "lg:p-2",
            )}
          >
            <div
              className={cn(
                "border-l-2 border-orange-500/70 bg-white/[.035] p-3",
                collapsed && "lg:border-l-0 lg:bg-transparent lg:p-0",
              )}
            >
              <div className={cn(collapsed && "lg:hidden")}>
                <p className="text-sm font-medium">Ambiente local isolado</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Dados de desenvolvimento, sem acesso ao ambiente cloud.
                </p>
              </div>
              {collapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onReset}
                      className="hidden h-10 w-full items-center justify-center rounded-sm text-orange-300 hover:bg-white/5 hover:text-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 lg:flex"
                      aria-label="Ambiente local isolado: limpar dados locais"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    Ambiente local isolado · Limpar dados locais
                  </TooltipContent>
                </Tooltip>
              )}
              <button
                onClick={onReset}
                className={cn(
                  "mt-3 flex items-center gap-2 text-xs font-semibold text-orange-300 hover:text-orange-200",
                  collapsed && "lg:hidden",
                )}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Limpar dados locais
              </button>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

function PageTitle({
  eyebrow,
  title,
  text,
  action,
  back,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  text: string;
  action?: ReactNode;
  back?: () => void;
  icon?: LucideIcon;
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
        {Icon ? (
          <div className="flex items-start gap-3">
            <span className="page-heading-icon mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              {eyebrow && (
                <p className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-orange-600">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                {title}
              </h1>
              <p className="mt-1.5 max-w-2xl text-muted-foreground">{text}</p>
            </div>
          </div>
        ) : (
          <>
            {eyebrow && (
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-600">
                {eyebrow}
              </p>
            )}
            <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{text}</p>
          </>
        )}
      </div>
      {action}
    </div>
  );
}

type DirectoryMetric = {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  tone?: "navy" | "orange" | "green" | "slate";
};

function DirectoryMetrics({ items }: { items: DirectoryMetric[] }) {
  return (
    <div className="directory-metrics mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, description, icon: Icon, tone = "slate" }) => (
        <Card key={label} className={cn("directory-metric group", `directory-metric--${tone}`)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-600">{label}</p>
              <strong className="mt-2 block text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
                {value}
              </strong>
            </div>
            <span className="directory-metric-icon grid h-8 w-8 shrink-0 place-items-center rounded-md">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-2 hidden text-xs leading-relaxed text-slate-500 sm:block">
            {description}
          </p>
        </Card>
      ))}
    </div>
  );
}

function DirectorySearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="directory-search relative mb-5 max-w-lg">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 bg-white pl-10 pr-4"
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

function QuickViewField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

function PilotQuickView({
  selection,
  customers,
  vehicles,
  orders,
  onClose,
  onNavigate,
}: {
  selection: QuickView | null;
  customers: Customer[];
  vehicles: Vehicle[];
  orders: ServiceOrder[];
  onClose: () => void;
  onNavigate: (target: "customer" | "vehicle" | "order", id: string) => void;
}) {
  const customer =
    selection?.type === "customer" ? customers.find((item) => item.id === selection.id) : undefined;
  const vehicle =
    selection?.type === "vehicle" ? vehicles.find((item) => item.id === selection.id) : undefined;
  const order =
    selection?.type === "order" ? orders.find((item) => item.id === selection.id) : undefined;

  return (
    <SidePanel open={Boolean(selection)} onOpenChange={(open) => !open && onClose()}>
      <SidePanelContent>
        {customer && (
          <>
            <SidePanelHeader>
              <p className="mb-2 text-xs font-semibold text-orange-700">Consulta rápida</p>
              <SidePanelTitle>{customer.name}</SidePanelTitle>
              <SidePanelDescription>Cliente da oficina</SidePanelDescription>
            </SidePanelHeader>
            <SidePanelBody>
              <dl>
                <QuickViewField label="Telefone">{customer.phone}</QuickViewField>
                <QuickViewField label="E-mail">{customer.email || "Não informado"}</QuickViewField>
                {customer.cpf && <QuickViewField label="CPF">{customer.cpf}</QuickViewField>}
              </dl>
              <section className="mt-5 border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold text-slate-950">Veículos</h3>
                <div className="mt-3 space-y-2">
                  {vehicles.filter((item) => item.customerId === customer.id).length ? (
                    vehicles
                      .filter((item) => item.customerId === customer.id)
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onNavigate("vehicle", item.id)}
                          className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                          <span>
                            <strong className="block text-sm">
                              {item.brand} {item.model}
                            </strong>
                            <span className="text-xs text-muted-foreground">{item.plate}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </button>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado.</p>
                  )}
                </div>
              </section>
              <section className="mt-5 border-t border-slate-200 pt-5">
                <h3 className="text-sm font-bold text-slate-950">Ordens em aberto</h3>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
                  {
                    orders.filter(
                      (item) => item.customerId === customer.id && item.status !== "Entregue",
                    ).length
                  }
                </p>
              </section>
            </SidePanelBody>
            <SidePanelFooter>
              <Button className="w-full" onClick={() => onNavigate("customer", customer.id)}>
                Abrir ficha completa
              </Button>
            </SidePanelFooter>
          </>
        )}

        {vehicle &&
          (() => {
            const owner = customers.find((item) => item.id === vehicle.customerId);
            const currentOrder = orders.find(
              (item) => item.vehicleId === vehicle.id && item.status !== "Entregue",
            );
            return (
              <>
                <SidePanelHeader>
                  <p className="mb-2 text-xs font-semibold text-orange-700">Consulta rápida</p>
                  <SidePanelTitle>
                    {vehicle.brand} {vehicle.model}
                  </SidePanelTitle>
                  <SidePanelDescription>
                    {vehicle.kind} · {vehicle.plate}
                  </SidePanelDescription>
                </SidePanelHeader>
                <SidePanelBody>
                  <dl>
                    <QuickViewField label="Placa">{vehicle.plate}</QuickViewField>
                    <QuickViewField label="Ano e cor">
                      {vehicle.year} · {vehicle.color}
                    </QuickViewField>
                    <QuickViewField label="Quilometragem">
                      {vehicle.mileage.toLocaleString("pt-BR")} km
                    </QuickViewField>
                    <QuickViewField label="Proprietário">
                      {owner?.name ?? "Não identificado"}
                    </QuickViewField>
                  </dl>
                  <section className="mt-5 border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-bold text-slate-950">Ordem atual</h3>
                    {currentOrder ? (
                      <button
                        onClick={() => onNavigate("order", currentOrder.id)}
                        className="mt-3 flex w-full items-center justify-between rounded-md border border-slate-200 p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <span>
                          <strong className="block text-sm">{currentOrder.id}</strong>
                          <span className="mt-1 block">
                            <StatusBadge status={currentOrder.status} />
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Nenhuma OS em aberto.</p>
                    )}
                  </section>
                </SidePanelBody>
                <SidePanelFooter>
                  <Button className="w-full" onClick={() => onNavigate("vehicle", vehicle.id)}>
                    Abrir ficha completa
                  </Button>
                </SidePanelFooter>
              </>
            );
          })()}

        {order &&
          (() => {
            const relatedVehicle = vehicles.find((item) => item.id === order.vehicleId);
            const relatedCustomer = customers.find((item) => item.id === order.customerId);
            const total = order.budget.reduce((sum, item) => sum + item.price, 0);
            const nextAction = evaluateOrderWorkflow(order).nextAction.label;
            return (
              <>
                <SidePanelHeader>
                  <p className="mb-2 text-xs font-semibold text-orange-700">Resumo operacional</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <SidePanelTitle>{order.id}</SidePanelTitle>
                    <StatusBadge status={order.status} />
                  </div>
                  <SidePanelDescription>
                    {orderVehicleLabel(order, relatedVehicle) || "Veículo não identificado"}
                  </SidePanelDescription>
                </SidePanelHeader>
                <SidePanelBody>
                  <dl>
                    <QuickViewField label="Cliente">
                      {relatedCustomer?.name ?? "Não identificado"}
                    </QuickViewField>
                    <QuickViewField label="Problema relatado">
                      {order.complaint || "Não informado"}
                    </QuickViewField>
                    <QuickViewField label="Valor atual">{money(total)}</QuickViewField>
                    <QuickViewField label="Próxima ação">{nextAction}</QuickViewField>
                  </dl>
                </SidePanelBody>
                <SidePanelFooter>
                  <Button className="w-full" onClick={() => onNavigate("order", order.id)}>
                    Abrir OS completa
                  </Button>
                </SidePanelFooter>
              </>
            );
          })()}
      </SidePanelContent>
    </SidePanel>
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
    <div className="directory-screen">
      <PageTitle
        eyebrow="Relacionamento"
        title="Clientes"
        text="Encontre rapidamente quem chegou à oficina e os veículos relacionados."
        icon={Users}
        action={
          <Button onClick={onNew} className="create-order-action gap-2">
            <Plus className="h-4 w-4" /> Criar ordem de serviço
          </Button>
        }
      />
      <DirectoryMetrics
        items={[
          {
            label: "Clientes ativos",
            value: customers.length,
            description: "Cadastros disponíveis para atendimento.",
            icon: Users,
            tone: "navy",
          },
          {
            label: "Com veículos",
            value: customers.filter((customer) =>
              vehicles.some((vehicle) => vehicle.customerId === customer.id),
            ).length,
            description: "Clientes com ao menos um veículo vinculado.",
            icon: CarFront,
          },
          {
            label: "Com OS em aberto",
            value: customers.filter((customer) =>
              orders.some(
                (order) => order.customerId === customer.id && order.status !== "Entregue",
              ),
            ).length,
            description: "Atendimentos ainda em andamento.",
            icon: ClipboardList,
            tone: "orange",
          },
          {
            label: "Veículos vinculados",
            value: vehicles.length,
            description: "Frota relacionada aos clientes ativos.",
            icon: Gauge,
            tone: "green",
          },
        ]}
      />
      <DirectorySearch
        value={filter}
        onChange={setFilter}
        placeholder="Pesquisar por nome ou telefone"
      />
      <div className="pilot-table directory-table">
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
                <div className="directory-avatar grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold">
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
    </div>
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
    <div className="directory-screen">
      <PageTitle
        eyebrow="Histórico centralizado"
        title="Veículos"
        text="Carros e motos com informações, serviços atuais e histórico em um só lugar."
        icon={CarFront}
        action={
          <Button onClick={onNew} className="create-order-action gap-2">
            <Plus className="h-4 w-4" /> Criar ordem de serviço
          </Button>
        }
      />
      <DirectoryMetrics
        items={[
          {
            label: "Veículos ativos",
            value: vehicles.length,
            description: "Veículos disponíveis no cadastro da oficina.",
            icon: CarFront,
            tone: "navy",
          },
          {
            label: "Carros",
            value: vehicles.filter((vehicle) => vehicle.kind === "Carro").length,
            description: "Automóveis cadastrados.",
            icon: CarFront,
          },
          {
            label: "Motos",
            value: vehicles.filter((vehicle) => vehicle.kind === "Moto").length,
            description: "Motocicletas cadastradas.",
            icon: Bike,
            tone: "green",
          },
          {
            label: "Com OS em aberto",
            value: vehicles.filter((vehicle) =>
              orders.some((order) => order.vehicleId === vehicle.id && order.status !== "Entregue"),
            ).length,
            description: "Veículos em atendimento no momento.",
            icon: Wrench,
            tone: "orange",
          },
        ]}
      />
      <DirectorySearch
        value={filter}
        onChange={setFilter}
        placeholder="Pesquisar placa, modelo ou proprietário"
      />
      <div className="pilot-table directory-table">
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
                <div className="directory-vehicle-icon grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
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
    </div>
  );
}

function OrdersScreen({
  orders,
  vehicles,
  customers,
  onOpen,
  onNew,
  onNewQuick,
}: {
  orders: ServiceOrder[];
  vehicles: Vehicle[];
  customers: Customer[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onNewQuick: () => void;
}) {
  const [filter, setFilter] = useState("Todas");
  const visible = filter === "Todas" ? orders : orders.filter((o) => o.status === filter);
  return (
    <div className="directory-screen">
      <PageTitle
        eyebrow="Núcleo operacional"
        title="Ordens de serviço"
        text="Acompanhe diagnóstico, aprovação, execução e entrega sem perder o histórico."
        icon={ClipboardList}
        action={
          <div className="flex flex-wrap gap-2"><Button onClick={onNew} className="create-order-action gap-2">
            <Plus className="h-4 w-4" /> Nova OS
          </Button><Button onClick={onNewQuick} variant="outline" className="gap-2"><Sparkles className="h-4 w-4" /> OS Rápida</Button></div>
        }
      />
      <div className="directory-status-filter mb-5 flex gap-1 overflow-x-auto p-1">
        {["Todas", ...orderStatuses].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              "whitespace-nowrap rounded-md border px-3 py-2 text-xs font-semibold transition-[color,background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
              filter === status
                ? "border-orange-200 bg-white text-orange-800 shadow-sm"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-white/70 hover:text-slate-900",
            )}
          >
            {status}
          </button>
        ))}
      </div>
      <Card className="pilot-table directory-table overflow-hidden bg-white">
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
            const vehicle = vehicles.find((v) => v.id === order.vehicleId);
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
                  <span className="directory-order-icon grid h-10 w-10 shrink-0 place-items-center rounded-lg">
                    {vehicle ? <VehicleIcon kind={vehicle.kind} className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">
                      {orderVehicleLabel(order, vehicle)}
                    </strong>
                    <span className="text-xs text-muted-foreground">{order.flowType === "quick" ? "Atendimento rápido" : vehicle?.plate}</span>
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
    </div>
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
  const debt = customerDebts(orders, customer.id);
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
        <section className="rounded-lg border bg-white p-5 xl:col-span-2">
          <h2 className="font-semibold">Saldo em aberto: {money(debt.balance)}</h2>
          {debt.debts.length ? <><p className="text-sm">{debt.debts.length} OS com saldo pendente</p><ul className="mt-2 space-y-2">{debt.debts.map(entry =>
            <li key={entry.order.id}><Button variant="link" onClick={() => onOrder(entry.order.id)}>{entry.order.id} · {money(entry.balance)} · {entry.status}</Button></li>)}</ul></> : <p className="text-sm">Nenhum débito em aberto.</p>}
        </section>
        {(accessLevel === "owner" || accessLevel === "admin") && !isLocalBypass && (
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
  vehicles,
  customer,
  orders,
  onBack,
  onCustomer,
  onOrder,
  onNewOrder,
  onDelete,
  onSave,
}: {
  vehicle: Vehicle;
  vehicles: Vehicle[];
  customer: Customer;
  orders: ServiceOrder[];
  onBack: () => void;
  onCustomer: (id: string) => void;
  onOrder: (id: string) => void;
  onNewOrder: () => void;
  onDelete: () => void;
  onSave: (vehicle: Vehicle) => Promise<void>;
}) {
  const { accessLevel } = useAuth();
  const canEditVehicle =
    accessLevel === "owner" || accessLevel === "admin" || accessLevel === "staff";
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const history = useMemo(() => vehicleHistory(vehicle, orders), [vehicle, orders]);
  return (
    <>
      <PageTitle
        back={onBack}
        eyebrow={vehicle.kind}
        title={`${vehicle.brand} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}`}
        text={`${vehicle.plate} · Proprietário: ${customer.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            {vehicle.deletedAt ? (
              <Badge variant="outline">Veículo excluído</Badge>
            ) : (
              <>
                {canEditVehicle && (
                  <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
                    Editar veículo
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="gap-2 text-rose-700"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" /> Excluir veículo
                </Button>
                <Button onClick={onNewOrder} className="create-order-action gap-2">
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
                  <dd className="mt-1 font-bold">{vehicle.year || "Não informado"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Última km conhecida</dt>
                  <dd className="mt-1 font-bold">{history.mileage}</dd>
                  <dd className="mt-1 text-xs text-slate-400">{history.mileageSource}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Cor</dt>
                  <dd className="mt-1 font-bold">{vehicle.color || "Não informada"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Última passagem</dt>
                  <dd className="mt-1 font-bold">{history.lastVisit}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Ordens vinculadas</dt>
                  <dd className="mt-1 font-bold">{history.orders.length}</dd>
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
        <VehicleHistory
          orders={history.orders}
          onOrder={onOrder}
          renderStatus={(status) => <StatusBadge status={status} />}
        />
      </div>
      {canEditVehicle && (
        <EditVehicleDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          vehicle={vehicle}
          vehicles={vehicles}
          onSave={onSave}
        />
      )}
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

function OrderTeamAssignment({
  team,
  onSave,
}: {
  team: string[];
  onSave: (team: string[]) => void;
}) {
  const { accessLevel, isLocalBypass, profile } = useAuth();
  const canAssign = accessLevel === "owner" || accessLevel === "admin" || accessLevel === "staff";
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [draft, setDraft] = useState<string[]>(team);
  const [loading, setLoading] = useState(canAssign);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => setDraft(team), [team]);

  const loadMembers = async () => {
    if (!canAssign) return;
    setLoading(true);
    setLoadError(false);
    if (isLocalBypass) {
      setMembers(
        profile
          ? [
              {
                user_id: profile.user_id,
                full_name: profile.full_name,
                operational_role: profile.operational_role,
              },
            ]
          : [],
      );
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("list_assignable_members");
    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setMembers(
      ((data ?? []) as AssignableMember[]).filter((member) => Boolean(member.full_name?.trim())),
    );
    setLoading(false);
  };

  useEffect(() => {
    void loadMembers();
    // The directory is loaded only when the authenticated identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLevel, isLocalBypass, profile?.user_id]);

  const availableNames = new Set(members.map((member) => member.full_name!.trim()));
  const legacyNames = draft.filter((name) => !availableNames.has(name));
  const changed = draft.length !== team.length || draft.some((name, index) => name !== team[index]);
  const toggle = (name: string) =>
    setDraft((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );

  return (
    <section className="mb-5 rounded-lg border bg-white p-4" aria-labelledby="order-team-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="order-team-title" className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-primary" /> Responsáveis pela OS
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {team.length ? team.join(", ") : "A definir"}
          </p>
        </div>
        {canAssign && (
          <Button
            size="sm"
            disabled={!changed || loading || loadError}
            onClick={() => onSave(draft)}
          >
            Salvar responsáveis
          </Button>
        )}
      </div>

      {canAssign && (
        <p className="mt-3 text-xs text-muted-foreground">
          Selecione os membros responsáveis por esta ordem de serviço.
        </p>
      )}
      {canAssign && loading && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Carregando membros ativos…
        </p>
      )}
      {canAssign && loadError && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" role="alert">
          <span>Não foi possível carregar a equipe. Os responsáveis atuais foram preservados.</span>
          <Button size="sm" variant="outline" onClick={() => void loadMembers()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {canAssign && !loading && !loadError && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => {
            const name = member.full_name!.trim();
            return (
              <label
                key={member.user_id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:border-primary/50",
                  draft.includes(name) && "border-primary bg-primary/5",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={draft.includes(name)}
                  onChange={() => toggle(name)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.operational_role || "Função não informada"}
                  </span>
                </span>
              </label>
            );
          })}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum membro ativo disponível.</p>
          )}
        </div>
      )}
      {canAssign && legacyNames.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">Responsáveis já registrados</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {legacyNames.map((name) => (
              <Button key={name} size="sm" variant="outline" onClick={() => toggle(name)}>
                {name} <X className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Remover {name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function OrderDetail({
  onSavePart,
  onSaveEvidence,
  order,
  initialTab,
  workshop,
  vehicle,
  customer,
  onBack,
  onVehicle,
  onUpdate,
  notify,
  canManage,
  onDelete,
  onCancel,
  onEditComplaint,
  actionBusy,
  actionError,
}: {
  order: ServiceOrder;
  initialTab?: string;
  onSaveEvidence: SaveEvidence;
  onSavePart: SavePart;
  workshop: Workshop;
  vehicle?: Vehicle | undefined;
  customer: Customer;
  onBack: () => void;
  onVehicle: (id: string) => void;
  onUpdate: (updater: OrderUpdater) => void;
  notify: (text: string) => void;
  canManage: boolean;
  onDelete: () => Promise<boolean>;
  onCancel: (reason: string) => Promise<boolean>;
  onEditComplaint: (complaint: string) => Promise<boolean>;
  actionBusy: boolean;
  actionError: string;
}) {
  const [activeTab, setActiveTab] = useState(initialTab ?? "overview");
  const activityAuthors = useActivityAuthors();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [manualStatusOpen, setManualStatusOpen] = useState(false);
  const [manualStatus, setManualStatus] = useState<ServiceOrder["status"]>(order.status);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingWorkflowConfirmation>();
  const [reversalPlan, setReversalPlan] = useState<WorkflowReversalPlan>();
  const [futureMessage, setFutureMessage] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const cancelled = isOrderCancelled(order);
  const quickFinalized = order.flowType === "quick" && order.status === "Entregue";
  const deleteBlockers = orderDeleteBlockers(order);
  const cancelBlocker = orderCancelBlocker(order);
  const workflow = evaluateOrderWorkflow(order);
  const displayVehicle: Vehicle = vehicle ?? {
    id: "", customerId: order.customerId, kind: "Carro",
    brand: order.quickVehicleBrand ?? "Veículo", model: order.quickVehicleModel ?? "não informado",
    year: order.quickVehicleYear ?? 0, plate: "", mileage: 0, color: "Não informada",
  };

  const availableReversal = quickFinalized ? null : getWorkflowReversal(order);
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
  const warrantyEnd = warrantyDeadline(order);

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
        title={orderVehicleLabel(order, vehicle)}
        text={`${customer.name}${order.flowType === "quick" ? " · Atendimento rápido" : ` · entrada com ${order.entryMileage.toLocaleString("pt-BR")} km`}`}
        action={
          <div className="flex min-w-52 flex-col items-end gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Status atual · provisório
            </span>
            <StatusBadge status={order.status} />
            {cancelled && <Badge variant="outline">Cancelada</Badge>}
            {["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status) && (
              <Button variant="outline" size="sm" onClick={() => setSummaryOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Resumo final
              </Button>
            )}
            {!cancelled && !quickFinalized && (
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
            )}
            {canManage && !cancelled && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground">
                    <MoreVertical className="h-4 w-4" /> Mais opções
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setCancelOpen(true)}>
                    <XCircle className="mr-2 h-4 w-4" /> Cancelar OS
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir OS
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

        }
      />
      <div className="order-metadata mb-5 flex flex-wrap gap-2">
        <FinalOrderSummary
          order={order}
          customer={customer}
          vehicle={displayVehicle}
          workshop={order.workshopSnapshot ?? workshop}
          open={
            summaryOpen &&
            ["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status)
          }
          onOpenChange={setSummaryOpen}
        />
        {customer.deletedAt && <Badge variant="outline">Cliente excluído</Badge>}
        {vehicle?.deletedAt && <Badge variant="outline">Veículo excluído</Badge>}
        <Badge variant="outline" className="bg-white">
          Responsáveis: {order.team.join(", ") || "A definir"}
        </Badge>
        <Badge variant="outline" className="bg-white">
          Aberta em {formatDate(order.openedAt)}
        </Badge>
        <Badge variant="outline" className="bg-white">
          Última atualização:{" "}
          {formatDateTime(order.updatedAt ?? `${order.openedAt}T12:00:00-03:00`)}
        </Badge>
      </div>
      {cancelled && (
        <div className="mb-5 rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-950">
          <p className="font-bold">OS cancelada · somente leitura</p>
          <p className="mt-1 text-sm">
            {order.cancelReason ? `Motivo: ${order.cancelReason}. ` : ""}
            Os dados foram preservados para auditoria e não podem mais ser alterados.
          </p>
        </div>
      )}
      <div inert={cancelled ? true : undefined}>
      <OrderTeamAssignment

        team={order.team}
        onSave={(team) => {
          onUpdate((current) => ({ ...current, team }));
          notify(team.length ? "Responsáveis atualizados" : "OS sem responsável definido");
        }}
      />
      <dl
        className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4"
        aria-label="Valores da ordem"
      >
        {[
          ["Orçado", money(total)],
          ["Aprovado", money(approved)],
          ["Pago", money(paymentSummary(order).paid)],
          [
            "Saldo em aberto",
            money(
              paymentSummary(order).balance,
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
          if (quickFinalized) return;
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
      {!quickFinalized && <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border-l-4 border-l-orange-500 bg-white p-4">
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
      </div>}
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
            onEditComplaint={onEditComplaint}
            complaintBusy={actionBusy}
            activityAuthors={activityAuthors}
          />
        </TabsContent>
        <TabsContent value="diagnosis" className="mt-6">
          <DiagnosisPanel
            order={order}
            onUpdate={onUpdate}
            onSaveEvidence={onSaveEvidence}
            notify={notify}
          />
        </TabsContent>
        <TabsContent value="budget" className="mt-6">
          <BudgetPanel
            onSavePart={onSavePart}
            order={order}
            workshop={order.workshopSnapshot ?? workshop}
            vehicle={displayVehicle}
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
            save={onSavePart}
            warrantyEnd={warrantyEnd}
            activityAuthors={activityAuthors}
          />
        </TabsContent>
      </Tabs>
      </div>

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
      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCancelOpen(false);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar {order.id}?</DialogTitle>
            <DialogDescription>
              Nada será apagado: cliente, veículo, orçamento e histórico continuam disponíveis para
              consulta. A OS sai das listas ativas e não aceita mais alterações.
            </DialogDescription>
          </DialogHeader>
          {cancelBlocker ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              {cancelBlocker}
            </p>
          ) : (
            <Textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Motivo do cancelamento"
              className="min-h-20 rounded-xl"
              maxLength={200}
            />
          )}
          {actionError && <p className="text-sm font-semibold text-rose-700">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(cancelBlocker) || !cancelReason.trim() || actionBusy}
              onClick={() => {
                void onCancel(cancelReason.trim()).then((done) => {
                  if (!done) return;
                  setCancelOpen(false);
                  setCancelReason("");
                });
              }}
            >
              {actionBusy ? "Cancelando…" : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {order.id} definitivamente?</DialogTitle>
            <DialogDescription>
              {deleteBlockers.length
                ? "Esta OS já tem movimentação registrada e não pode ser excluída."
                : `A ${order.id} será apagada para sempre e não poderá ser recuperada. O número não será reaproveitado: a próxima OS continua a numeração.`}
            </DialogDescription>
          </DialogHeader>
          {deleteBlockers.length > 0 && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              Não é possível excluir porque {deleteBlockers.join(", ")}. Use o cancelamento para
              preservar o histórico.
            </p>
          )}
          {actionError && <p className="text-sm font-semibold text-rose-700">{actionError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteBlockers.length > 0 || actionBusy}
              onClick={() => {
                void onDelete().then((done) => {
                  if (done) setDeleteOpen(false);
                });
              }}
            >
              {actionBusy ? "Excluindo…" : `Excluir ${order.id}`}
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
  onEditComplaint,
  complaintBusy,
  activityAuthors,
}: {
  order: ServiceOrder;
  vehicle?: Vehicle | undefined;
  customer: Customer;
  onVehicle: (id: string) => void;
  approved: number;
  total: number;
  onQuickAction: (tab: string) => void;
  workflow: ReturnType<typeof evaluateOrderWorkflow>;
  onEditComplaint: (complaint: string) => Promise<boolean>;
  complaintBusy: boolean;
  activityAuthors: ActivityAuthors;
}) {
  const { accessLevel } = useAuth();
  const [editingComplaint, setEditingComplaint] = useState(false);
  const [complaintDraft, setComplaintDraft] = useState(order.complaint);
  const [complaintError, setComplaintError] = useState("");
  const canEditComplaint =
    (accessLevel === "owner" || accessLevel === "admin" || accessLevel === "staff") &&
    !isOrderCancelled(order) &&
    !["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status);
  const refused = order.budget
    .filter((item) => item.approval === "Recusado")
    .reduce((sum, item) => sum + item.price, 0);
  const payment = paymentSummary(order);
  const paid = payment.paid;
  const paymentPending = payment.balance;
  const sections = [
    {
      icon: MessageCircle,
      label: "Problema relatado",
      text: order.complaint,
      editable: true,
    },
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
                {orderVehicleLabel(order, vehicle)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Quilometragem</span>
              <p className="font-semibold">{order.flowType === "quick" ? "Não exigida" : `${order.entryMileage.toLocaleString("pt-BR")} km`}</p>
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>
                    {section.editable && canEditComplaint && !editingComplaint ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-mt-2 h-8 w-8 shrink-0 text-muted-foreground"
                        aria-label="Editar problema relatado"
                        onClick={() => {
                          setComplaintDraft(order.complaint);
                          setComplaintError("");
                          setEditingComplaint(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  {section.editable && editingComplaint ? (
                    <div className="mt-2 space-y-3">
                      <Textarea
                        value={complaintDraft}
                        onChange={(event) => setComplaintDraft(event.target.value)}
                        rows={4}
                        maxLength={2000}
                        disabled={complaintBusy}
                      />
                      {complaintError ? (
                        <p className="text-sm text-destructive">{complaintError}</p>
                      ) : null}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={complaintBusy}
                          onClick={async () => {
                            const text = complaintDraft.trim();
                            if (!text) {
                              setComplaintError("Informe o problema relatado.");
                              return;
                            }
                            const done = await onEditComplaint(text);
                            if (done) setEditingComplaint(false);
                            else
                              setComplaintError(
                                "Não foi possível salvar. Verifique a mensagem no topo da OS.",
                              );
                          }}
                        >
                          {complaintBusy ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={complaintBusy}
                          onClick={() => setEditingComplaint(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 leading-relaxed">{section.text}</p>
                  )}
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
                    <EvidenceMedia evidence={evidence} />
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
                Última: {formatDateTime(order.updatedAt ?? `${order.openedAt}T12:00:00-03:00`)}
              </span>
            </div>
            <div className="mt-5 space-y-4 border-l-2 border-slate-200 pl-5">
              {[...(order.activities ?? [])].reverse().map((activity) => (
                <div key={activity.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-orange-500" />
                  <p className="text-xs text-muted-foreground">{formatDateTime(activity.at)}</p>
                  <p className="mt-1 text-sm font-medium">{activity.description}</p>
                  {activity.action === "commercial_discount" && <p className="mt-1 text-xs text-muted-foreground break-words">
                    {money(activity.previousAmount ?? 0)} → {money(activity.newAmount ?? 0)} · Registrado por: {activityAuthorName(activity, activityAuthors)}
                  </p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <aside className="space-y-4">
        <button
          onClick={() => vehicle && onVehicle(vehicle.id)}
          disabled={!vehicle}
          className="w-full rounded-2xl bg-slate-900 p-5 text-left text-white disabled:cursor-default"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500">
              {vehicle ? <VehicleIcon kind={vehicle.kind} className="h-5 w-5" /> : <Wrench className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-xs text-slate-400">Veículo</p>
              <strong>
                {orderVehicleLabel(order, vehicle)}
              </strong>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400">Placa</dt>
              <dd className="font-mono">{vehicle?.plate || "Sem cadastro oficial"}</dd>
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
            {payment.discount > 0 && <>
              <div className="mt-2 flex justify-between"><span>Desconto comercial</span><strong>− {money(payment.discount)}</strong></div>
              <div className="mt-2 flex justify-between"><span>Total final</span><strong>{money(payment.total)}</strong></div>
            </>}
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
  onSaveEvidence,
  order,
  onUpdate,
  notify,
}: {
  onSaveEvidence: SaveEvidence;
  order: ServiceOrder;
  onUpdate: (updater: OrderUpdater) => void;
  notify: (text: string) => void;
}) {
  const [diagnosis, setDiagnosis] = useState(order.diagnosis);
  const [findings, setFindings] = useState(order.findings);
  const [notes, setNotes] = useState(order.notes);
  const [pendingDiagnosisChange, setPendingDiagnosisChange] =
    useState<PendingWorkflowConfirmation>();

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
      <OrderEvidence order={order} save={onSaveEvidence} notify={notify} />
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
                  <EvidenceMedia evidence={evidence} />
                  <p className="mt-6 font-semibold">{evidence.caption}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {evidence.name} · {evidence.kind}
                  </p>
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
                    <p className="text-xs text-muted-foreground">
                      {item.type}
                      {item.type === "Peça" &&
                        ` · ${item.quantity ?? 1} un. × ${money(item.unitPrice ?? item.price / (item.quantity ?? 1))}`}
                    </p>
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
  onSavePart,
  order,
  workshop,
  vehicle,
  customer,
  updateItem,
  onUpdate,
  notify,
}: {
  onSavePart: SavePart;
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
  const { identity, isLocalBypass } = useAuth();
  const [financialAllowed, setFinancialAllowed] = useState(false);
  const [checkingFinancial, setCheckingFinancial] = useState(true);
  useEffect(() => {
    let active = true;
    setFinancialAllowed(false);
    setCheckingFinancial(true);
    if (isLocalBypass) {
      setCheckingFinancial(false);
      return;
    }
    void financialApi.access()
      .then((allowed) => {
        if (active) setFinancialAllowed(allowed);
      })
      .catch(() => {
        if (active) setFinancialAllowed(false);
      })
      .finally(() => {
        if (active) setCheckingFinancial(false);
      });
    return () => {
      active = false;
    };
  }, [identity?.userId, isLocalBypass]);
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
                        {item.type === "Peça" &&
                          ` · ${item.quantity ?? 1} un. × ${money(item.unitPrice ?? item.price / (item.quantity ?? 1))}`}
                        {item.availability && ` · ${item.availability}`}
                      </p>
                    </div>
                  </div>
                  <strong className="text-lg">{money(item.price)}</strong>
                  <StatusBadge status={item.approval} />
                </div>
                <RemoveBudgetItem order={order} item={item} save={onSavePart} />
                {item.type === "Peça" && financialAllowed && (
                  <PartFinancialEditor order={order} item={item} save={onSavePart} />
                )}
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
      {itemOpen && (
        <AddBudgetItemDialog
          onClose={() => setItemOpen(false)}
          save={onSavePart}
          financialAllowed={financialAllowed}
          checkingPermission={checkingFinancial}
        />
      )}
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
  order, save, warrantyEnd, activityAuthors,
}: {
  order: ServiceOrder;
  save: SavePart;
  warrantyEnd: Date | null;
  activityAuthors: ActivityAuthors;
}) {
  const { accessLevel, isLocalBypass, identity } = useAuth();
  const [financialAllowed, setFinancialAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    setFinancialAllowed(false);
    if (!isLocalBypass && accessLevel === "staff") {
      void financialApi.access().then(allowed => { if (active) setFinancialAllowed(allowed); }).catch(() => {});
    }
    return () => { active = false; };
  }, [accessLevel, isLocalBypass, identity?.userId]);
  const canEditDiscount = !isLocalBypass && (accessLevel === "owner" || accessLevel === "admin" || (accessLevel === "staff" && financialAllowed));
  const today = new Date("2026-09-01T12:00:00Z");
  const warrantyStatus = warrantyEnd && warrantyEnd >= today ? "ATIVA" : "EXPIRADA";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <OrderPayments order={order} save={save} canEditDiscount={canEditDiscount} activityAuthors={activityAuthors} />
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
                  <dd className="mt-1 font-semibold">{orderWarrantyDays(order)} dias</dd>

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
            O início na conclusão ou entrega e possíveis variações do período padrão ainda precisam
            ser validados.
          </p>

        </CardContent>
      </Card>

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
      since: String(new Date().getFullYear()),
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
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
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
                onChange={(e) => setCpf(formatCpfInput(e.target.value))}
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
    if (
      !Number.isInteger(numericYear) ||
      numericYear < 1900 ||
      numericYear > new Date().getFullYear() + 1
    )
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

function EditVehicleDialog({
  open,
  onOpenChange,
  vehicle,
  vehicles,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  vehicle: Vehicle;
  vehicles: Vehicle[];
  onSave: (vehicle: Vehicle) => Promise<void>;
}) {
  const [kind, setKind] = useState<Vehicle["kind"]>(vehicle.kind);
  const [brand, setBrand] = useState(vehicle.brand);
  const [model, setModel] = useState(vehicle.model);
  const [plate, setPlate] = useState(vehicle.plate);
  const [year, setYear] = useState(String(vehicle.year || ""));
  const [mileage, setMileage] = useState(String(vehicle.mileage ?? 0));
  const [color, setColor] = useState(vehicle.color === "Não informada" ? "" : vehicle.color);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(vehicle.kind);
    setBrand(vehicle.brand);
    setModel(vehicle.model);
    setPlate(vehicle.plate);
    setYear(String(vehicle.year || ""));
    setMileage(String(vehicle.mileage ?? 0));
    setColor(vehicle.color === "Não informada" ? "" : vehicle.color);
    setError(undefined);
    setSaving(false);
  }, [open, vehicle]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const cleanPlate = normalizePlate(plate);
    if (!brand.trim() || !model.trim() || cleanPlate.length !== 7)
      return setError("Informe marca, modelo e uma placa com 7 caracteres.");
    const duplicate = vehicles.find(
      (item) =>
        item.id !== vehicle.id && !item.deletedAt && normalizePlate(item.plate) === cleanPlate,
    );
    if (duplicate)
      return setError(
        `A placa ${cleanPlate} já pertence a ${duplicate.brand} ${duplicate.model}.`,
      );
    const numericYear = Number(year);
    const numericMileage = Number(mileage);
    if (
      !Number.isInteger(numericYear) ||
      numericYear < 1900 ||
      numericYear > new Date().getFullYear() + 1
    )
      return setError("Informe um ano válido para o veículo.");
    if (!Number.isFinite(numericMileage) || numericMileage < 0 || numericMileage > 2_000_000)
      return setError("Informe uma quilometragem válida entre 0 e 2.000.000 km.");
    setError(undefined);
    setSaving(true);
    try {
      await onSave({
        ...vehicle,
        kind,
        brand: normalizeName(brand),
        model: normalizeName(model),
        year: numericYear,
        plate: cleanPlate,
        mileage: numericMileage,
        color: normalizeName(color) || "Não informada",
      });
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar o veículo.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Editar veículo</DialogTitle>
            <DialogDescription>
              Corrija os dados cadastrais. O proprietário, as ordens de serviço e todo o histórico
              permanecem vinculados a este mesmo veículo.
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4 sm:grid-cols-2">
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
              <p className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? "Salvando..." : "Salvar alterações"}
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
  initialQuickDraft,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  customers: Customer[];
  vehicles: Vehicle[];
  allCustomers: Customer[];
  allVehicles: Vehicle[];
  orders: ServiceOrder[];
  initialQuickDraft?: QuickOrderDraft | undefined;
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

  useEffect(() => {
    if (!open || !initialQuickDraft) return;
    if (initialQuickDraft.newCustomer) {
      const customer: Customer = { id: `quick-c-${initialQuickDraft.requestId}`,
        name: initialQuickDraft.newCustomer.name, phone: initialQuickDraft.newCustomer.phone,
        email: "", ...(initialQuickDraft.newCustomer.cpf ? { cpf: initialQuickDraft.newCustomer.cpf } : {}),
        since: String(new Date().getFullYear()) };
      setDraftCustomer(customer); setCustomerId(customer.id);
    } else { setDraftCustomer(undefined); setCustomerId(initialQuickDraft.customerId ?? ""); }
    setBrand(initialQuickDraft.vehicleBrand); setModel(initialQuickDraft.vehicleModel);
    setYear(String(initialQuickDraft.vehicleYear)); setComplaint(initialQuickDraft.service);
    if (initialQuickDraft.vehicleId) { setVehicleId(initialQuickDraft.vehicleId); setNewVehicle(false); setStep(2); }
    else { setVehicleId(""); setNewVehicle(true); setKind("Carro"); setPlate(""); setVehicleMileage(""); setColor(""); setStep(1); }
  }, [initialQuickDraft, open]);

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
      since: String(new Date().getFullYear()),
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
    if (
      !Number.isInteger(numericYear) ||
      numericYear < 1900 ||
      numericYear > new Date().getFullYear() + 1
    )
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
          openedAt: localDate(),
          entryMileage: entryMileage === "" ? selectedVehicle.mileage : Number(entryMileage),
          complaint: complaint.trim(),
          diagnosis: "",
          findings: "",
          notes: "",
          team: [],
          budget: initialQuickDraft ? [quickOrderBudgetItem(initialQuickDraft.service, initialQuickDraft.amount, initialQuickDraft.requestId)] : [],
          evidence: [],
          ...(initialQuickDraft ? {
            discountAmount: initialQuickDraft.discountAmount,
            discountReason: initialQuickDraft.discountReason,
            quickVehicleBrand: initialQuickDraft.vehicleBrand,
            quickVehicleModel: initialQuickDraft.vehicleModel,
            quickVehicleYear: initialQuickDraft.vehicleYear,
            creationRequestId: initialQuickDraft.requestId,
            ...(initialQuickDraft.receivedAmount > 0 && initialQuickDraft.paymentMethod ? { payment: {
              amount: initialQuickDraft.receivedAmount, method: initialQuickDraft.paymentMethod,
              status: initialQuickDraft.receivedAmount >= initialQuickDraft.amount - initialQuickDraft.discountAmount ? "Pago" as const : "Parcial" as const,
              date: new Date().toISOString(), receipts: [{ id: initialQuickDraft.requestId,
                amount: initialQuickDraft.receivedAmount, method: initialQuickDraft.paymentMethod,
                date: new Date().toISOString(), note: "", recordedBy: "" }],
            } } : {}),
          } : {}),
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
      <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-200 bg-white shadow-xl sm:max-w-3xl">
        <div>
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl tracking-tight">Nova ordem de serviço</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Cadastre ou selecione cliente e veículo antes de confirmar a entrada.
            </DialogDescription>
          </DialogHeader>
          <div
            className="my-6 grid grid-cols-4 px-1 sm:px-3"
            role="progressbar"
            aria-label={`Etapa ${step + 1} de ${stages.length}: ${stages[step]}`}
            aria-valuemin={1}
            aria-valuemax={stages.length}
            aria-valuenow={step + 1}
          >
            {stages.map((label, index) => (
              <div key={label} className="relative text-center">
                {index < stages.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[calc(50%+1rem)] top-4 h-0.5 w-[calc(100%-2rem)] overflow-hidden bg-slate-200"
                  >
                    <span
                      className={cn(
                        "block h-full origin-left bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none",
                        index < step ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </span>
                )}
                <span
                  className={cn(
                    "relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-full border-2 bg-white text-xs font-bold transition-[border-color,background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
                    index < step && "border-primary bg-primary text-primary-foreground",
                    index === step &&
                      "border-primary text-primary shadow-[0_0_0_4px_rgba(49,94,173,0.12)]",
                    index > step && "border-slate-300 text-slate-400",
                  )}
                >
                  {index < step ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "mt-2 block text-[10px] font-semibold leading-tight sm:text-xs",
                    index < step && "text-primary",
                    index === step && "text-primary",
                    index > step && "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div
            key={step}
            className="new-order-stage min-h-72 space-y-4 border-t border-slate-200/80 pt-5"
          >
            {step === 0 && (
              <>
                <div
                  className="new-order-segmented"
                  data-selection={newCustomer ? "secondary" : "primary"}
                >
                  <Button
                    variant="ghost"
                    className="new-order-segment"
                    aria-pressed={!newCustomer}
                    onClick={() => {
                      setNewCustomer(false);
                      setDraftCustomer(undefined);
                    }}
                  >
                    Selecionar existente
                  </Button>
                  <Button
                    variant="ghost"
                    className="new-order-segment"
                    aria-pressed={newCustomer}
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
                    <Command
                      shouldFilter={false}
                      className="new-order-content-enter overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50 shadow-sm"
                    >
                      <CommandInput
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                        aria-label="Buscar cliente por nome, CPF ou telefone"
                        placeholder="Digite nome, CPF ou telefone"
                      />
                      <CommandList className="new-order-results max-h-64 p-2">
                        <CommandEmpty>
                          <div className="new-order-empty grid justify-items-center gap-2 px-4 py-7 text-center">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500">
                              <UserRound className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <strong className="text-sm text-slate-800">
                              Nenhum cliente encontrado
                            </strong>
                            <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                              Revise a busca ou use Cadastrar novo cliente.
                            </span>
                          </div>
                        </CommandEmpty>
                        {filteredCustomers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={customer.id}
                            onSelect={() => selectCustomer(customer)}
                            className={cn(
                              "new-order-result group mb-1 flex items-center gap-3 rounded-md border border-transparent px-3 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 last:mb-0 hover:-translate-y-px hover:border-slate-200 hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/25 motion-reduce:transform-none motion-reduce:transition-none",
                              customerId === customer.id &&
                                "border-primary/30 bg-primary/[0.07] shadow-sm data-[selected=true]:bg-primary/[0.09]",
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 transition-colors duration-150",
                                customerId === customer.id && "bg-primary text-white",
                              )}
                              aria-hidden="true"
                            >
                              {customer.name
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-sm text-slate-900">
                                {customer.name}
                              </strong>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {[customer.phone, customer.cpf && `CPF: ${customer.cpf}`]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              {customer.email && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {customer.email}
                                </span>
                              )}
                            </span>
                            <span
                              className={cn(
                                "grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-300 text-transparent transition-colors duration-150",
                                "new-order-selection-mark",
                                customerId === customer.id &&
                                  "border-primary bg-primary text-white",
                              )}
                              data-active={customerId === customer.id}
                              aria-hidden="true"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                    {selectedCustomer && (
                      <div
                        className="flex items-start gap-3 rounded-lg bg-primary/[0.06] px-3 py-2.5 text-sm text-slate-700"
                        role="status"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="block text-slate-900">{selectedCustomer.name}</strong>
                          <span className="text-xs text-muted-foreground">
                            Selecionado. Os veículos deste cliente serão exibidos na próxima etapa.
                          </span>
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="new-order-content-enter grid gap-3 sm:grid-cols-2">
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
                        onChange={(event) => setCustomerPhone(formatPhoneInput(event.target.value))}
                        placeholder="Telefone com DDD"
                        inputMode="tel"
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
                        onChange={(event) => setCustomerCpf(formatCpfInput(event.target.value))}
                        placeholder="CPF (opcional)"
                        inputMode="numeric"
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
                <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                  <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
                  <strong className="text-slate-900">{selectedCustomer.name}</strong>
                </p>
                <div
                  className="new-order-segmented"
                  data-selection={newVehicle ? "secondary" : "primary"}
                >
                  <Button
                    variant="ghost"
                    className="new-order-segment"
                    aria-pressed={!newVehicle}
                    onClick={() => {
                      setNewVehicle(false);
                      setDraftVehicle(undefined);
                    }}
                  >
                    Selecionar veículo
                  </Button>
                  <Button
                    variant="ghost"
                    className="new-order-segment"
                    aria-pressed={newVehicle}
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
                  <div className="new-order-content-enter max-h-64 space-y-2 overflow-y-auto pr-1">
                    {customerVehicles.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        type="button"
                        onClick={() => setVehicleId(vehicle.id)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-primary/25 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 motion-reduce:transform-none motion-reduce:transition-none",
                          vehicleId === vehicle.id &&
                            "border-primary/35 bg-primary/[0.06] shadow-sm",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500",
                            vehicleId === vehicle.id && "bg-primary text-white",
                          )}
                        >
                          {vehicle.kind === "Moto" ? (
                            <Bike className="h-5 w-5" aria-hidden="true" />
                          ) : (
                            <CarFront className="h-5 w-5" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm text-slate-900">
                            {vehicle.brand} {vehicle.model}
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            {vehicle.plate} · {vehicle.mileage.toLocaleString("pt-BR")} km
                          </span>
                        </span>
                        <span
                          className={cn(
                            "new-order-selection-mark grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-300 text-transparent",
                            vehicleId === vehicle.id && "border-primary bg-primary text-white",
                          )}
                          data-active={vehicleId === vehicle.id}
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5" />
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
                  <div className="new-order-content-enter grid gap-3 sm:grid-cols-2">
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
                <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                  <CarFront className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <strong className="text-slate-900">{selectedCustomer?.name}</strong> ·{" "}
                    {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.plate}
                  </span>
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
              <div className="divide-y divide-slate-200/80 rounded-lg bg-slate-50/70 px-4 text-sm">
                <div className="py-3">
                  <span className="text-muted-foreground">Cliente</span>
                  <strong className="block">
                    {selectedCustomer.name} · {selectedCustomer.phone}
                  </strong>
                </div>
                <div className="py-3">
                  <span className="text-muted-foreground">Veículo</span>
                  <strong className="block">
                    {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.plate}
                  </strong>
                </div>
                <div className="py-3">
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
                  <p className="py-3 text-xs text-muted-foreground">
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

          <DialogFooter className="mt-6 border-t border-slate-200/80 pt-4">
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
                className="create-order-action"
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

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  ChartNoAxesCombined,
  ClipboardCheck,
  Package,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import type { BudgetItem, ServiceOrder } from "./pilot-data";
import { financialApi, type FinancialMember, type SavePart } from "./financial-api";
import {
  aggregateOrders,
  implicitMarkup,
  prefillPart,
  dateRange,
  partAmounts,
  roundMoney,
  suggestedPrice,
  validatePart,
  type OrderFinancialRow,
} from "./financial-model";

const money = (value: number | null) =>
  value === null
    ? "Não informado"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const chartCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const chartDate = (value: string, full = false) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? full
      ? value.split("-").reverse().join("/")
      : value.slice(5).split("-").reverse().join("/")
    : value;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
function FinancialChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  label?: string | number;
  payload?: readonly {
    payload?: { Faturamento: number | null; Custo: number | null; Resultado: number | null };
  }[];
}) {
  const values = payload?.[0]?.payload;
  if (!active || !values) return null;
  return (
    <div className="financial-chart-tooltip max-w-[min(19rem,80vw)] rounded-lg border border-slate-200 bg-white/95 p-3 text-xs text-foreground shadow-lg shadow-slate-950/10 backdrop-blur-sm">
      <p className="mb-2 border-b border-slate-100 pb-2 font-semibold">
        {chartDate(String(label ?? ""), true)}
      </p>
      <dl className="space-y-2">
        {[
          ["Faturamento", values.Faturamento],
          ["Custo das peças", values.Custo],
          ["Resultado bruto", values.Resultado],
        ].map(([name, value]) => (
          <div
            key={String(name)}
            className={
              name === "Resultado bruto"
                ? "flex justify-between gap-4 border-t pt-2 font-semibold"
                : "flex justify-between gap-4"
            }
          >
            <dt>{name}</dt>
            <dd className="whitespace-nowrap tabular-nums">{money(value as number | null)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type PremiumBarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  value?: number | [number, number];
  fill?: string;
};

function PremiumBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  value = 0,
  fill = "currentColor",
  chartIndex,
  seriesIndex,
  pulse,
}: PremiumBarShapeProps & {
  chartIndex: number;
  seriesIndex: number;
  pulse: boolean;
}) {
  if (width <= 0 || height <= 0) return <g />;
  const numericValue = Array.isArray(value) ? value[1] - value[0] : value;
  const baselineY = numericValue < 0 ? y : y + height;
  const delay = seriesIndex * 150 + index * 90;
  const bevel = Math.min(4, Math.max(2, width * 0.1));
  const radius = Math.min(7, width / 3, height / 3);
  const clipId = `financial-bar-clip-${chartIndex}-${seriesIndex}-${index}`;
  return (
    <g
      className={`financial-premium-bar ${pulse ? "financial-premium-bar--pulse" : ""}`}
      style={
        {
          "--bar-delay": `${delay}ms`,
          transformOrigin: numericValue < 0 ? "center top" : "center bottom",
        } as CSSProperties
      }
    >
      <ellipse
        cx={x + width / 2}
        cy={baselineY + (numericValue < 0 ? -0.5 : 1.5)}
        rx={Math.max(4, width * 0.44)}
        ry={2.25}
        fill="rgba(15, 23, 42, 0.16)"
      />
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={radius} />
        </clipPath>
      </defs>
      <rect x={x} y={y} width={width} height={height} rx={radius} fill={fill} />
      <path
        d={`M ${x + width - bevel} ${y + radius / 2} L ${x + width} ${y + radius} L ${x + width} ${y + height - 1} L ${x + width - bevel} ${y + height - 1} Z`}
        fill="rgba(15, 23, 42, 0.14)"
      />
      <path
        d={`M ${x + radius / 2} ${y} H ${x + width - radius} L ${x + width - bevel} ${y + bevel} H ${x + radius} Z`}
        fill="rgba(255, 255, 255, 0.18)"
      />
      <rect
        x={x + 2}
        y={y + 2}
        width={Math.max(0, width * 0.22)}
        height={Math.max(0, height - 4)}
        rx={Math.max(1, radius - 2)}
        fill="rgba(255, 255, 255, 0.1)"
      />
      {pulse && (
        <g clipPath={`url(#${clipId})`}>
          <rect
            className="financial-bar-sheen"
            x={x - width}
            y={y}
            width={Math.max(8, width * 0.45)}
            height={height}
            fill={`url(#financial-sheen-${chartIndex})`}
          />
        </g>
      )}
    </g>
  );
}

export function PartFinancialEditor({
  order,
  item,
  save,
}: {
  order: ServiceOrder;
  item: BudgetItem;
  save: SavePart;
}) {
  const [open, setOpen] = useState(false),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [cost, setCost] = useState(""),
    [markup, setMarkup] = useState("");
  const [quantity, setQuantity] = useState(String(item.quantity ?? 1)),
    [price, setPrice] = useState(String(item.unitPrice ?? item.price));
  const lock = useRef(false);
  const saleLocked =
    item.approval !== "Aguardando aprovação" ||
    item.executed === true ||
    ["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setReady(false);
    setError("");
    if (!order.databaseId) {
      setError("Disponível após salvar a OS no ambiente da oficina.");
      return;
    }
    void financialApi
      .part(order.databaseId, item.id)
      .then((data) => {
        if (!active) return;
        const values = prefillPart(item, data);
        setCost(values.unitCost === null ? "" : String(values.unitCost));
        setMarkup(values.markup === null ? "" : String(values.markup));
        setQuantity(String(values.quantity));
        setPrice(String(values.unitPrice));
        setReady(true);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [open, order.databaseId, item.id, item.price, item.unitPrice, item.quantity, order.updatedAt]);
  const input = {
    itemId: item.id,
    unitCost: cost === "" ? null : Number(cost),
    markup: markup === "" ? null : Number(markup),
    quantity: Number(quantity),
    unitPrice: Number(price),
  };
  const validation = price === "" ? "Informe o preço de venda." : validatePart(input);
  const implied = input.markup === null ? implicitMarkup(input.unitCost, input.unitPrice) : null;
  const suggestion = validation ? null : suggestedPrice(input.unitCost, input.markup ?? implied);
  const amounts = validation
    ? null
    : partAmounts(
        { price: roundMoney(input.unitPrice * input.quantity), quantity: input.quantity },
        input.unitCost,
      );
  return (
    <div className="mt-3">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)} disabled={busy}>
        {open ? "Fechar dados da peça" : "Custo, quantidade e preço"}
      </Button>
      {open && (
        <div className="mt-3 rounded-md border bg-muted/30 p-4">
          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {!ready && !error && <p role="status">Carregando dados da peça…</p>}
          {ready && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm">
                  Custo unitário (R$)
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="Não informado"
                  />
                </label>
                <label className="text-sm">
                  Acréscimo sobre custo (%)
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={markup}
                    onChange={(e) => setMarkup(e.target.value)}
                    placeholder={implied === null ? "Não informado" : `${implied}% implícito`}
                  />
                </label>
                <label className="text-sm">
                  Quantidade
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    disabled={saleLocked}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Venda unitária final (R$)
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    disabled={saleLocked}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span>Preço sugerido: {money(suggestion)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={suggestion === null || saleLocked}
                  onClick={() => setPrice(String(suggestion))}
                >
                  Usar preço sugerido
                </Button>
                <span>
                  Lucro unitário:{" "}
                  {money(
                    validation || input.unitCost === null
                      ? null
                      : roundMoney(input.unitPrice - input.unitCost),
                  )}
                </span>
                <span>Lucro total: {money(amounts?.profit ?? null)}</span>
              </div>
              {implied !== null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Acréscimo implícito no preço final: {implied.toLocaleString("pt-BR")}% (calculado,
                  não salvo como percentual manual).
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                O acréscimo é calculado sobre o custo. Alterar custo ou percentual não substitui seu
                preço final.
              </p>
              {saleLocked && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Custo e acréscimo podem ser registrados. Para alterar uma venda aprovada, use o
                  fluxo atual de reabertura da aprovação.
                </p>
              )}
              {validation && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {validation}
                </p>
              )}
              <Button
                className="mt-3"
                disabled={busy || Boolean(validation)}
                onClick={async () => {
                  if (lock.current || validation) return;
                  lock.current = true;
                  setBusy(true);
                  setError("");
                  try {
                    await save(input);
                    setOpen(false);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Salvando…" : "Salvar dados da peça"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function FinancialScreen() {
  const { accessLevel, isLocalBypass } = useAuth();
  const reducedMotion = useReducedMotion();
  const [lineMotionReady, setLineMotionReady] = useState(false);
  const [rows, setRows] = useState<OrderFinancialRow[] | null>(null),
    [members, setMembers] = useState<FinancialMember[]>([]);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [kind, setKind] = useState("Todos"),
    [period, setPeriod] = useState("month"),
    [customStart, setCustomStart] = useState(""),
    [customEnd, setCustomEnd] = useState("");
  useEffect(() => {
    if (reducedMotion) {
      setLineMotionReady(true);
      return;
    }
    setLineMotionReady(false);
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setLineMotionReady(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [reducedMotion, kind, period, customStart, customEnd, rows]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRows(null);
    if (isLocalBypass) {
      setError("O financeiro exige a permissão validada pelo servidor da oficina.");
      setLoading(false);
      return;
    }
    void (async () => {
      if (!(await financialApi.access()))
        throw new Error("Você não tem permissão financeira. Solicite acesso ao proprietário.");
      const report = await financialApi.report();
      if (active) setRows(report);
      if (accessLevel === "owner") {
        const list = await financialApi.members();
        if (active) setMembers(list);
      }
    })()
      .catch((cause) => {
        if (active) {
          setError(cause.message);
          setRows(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isLocalBypass, accessLevel, revision]);
  const range = period === "custom" ? { start: customStart, end: customEnd } : dateRange(period);
  const invalidRange = Boolean(range.start && range.end && range.start > range.end);
  const summary = useMemo(
    () => aggregateOrders(rows ?? [], kind, range.start, range.end),
    [rows, kind, range.start, range.end],
  );
  const charts = [
    {
      title: "Faturamento, custo e resultado",
      subtitle:
        "Compara a receita total das OS, o custo conhecido das peças e o resultado bruto do período.",
      data: summary.orders
        ? [
            {
              name: "Período selecionado",
              Faturamento: summary.revenue,
              Custo: summary.cost,
              Resultado: summary.result,
            },
          ]
        : [],
      mode: "comparison",
    },
    {
      title: "Carros × Motos",
      subtitle: "Compara o desempenho financeiro das duas categorias dentro dos filtros.",
      data: summary.vehicles,
      mode: "comparison",
    },
    {
      title: "Evolução financeira",
      subtitle: "Acompanha faturamento e resultado bruto por data de conclusão, sem acumulação.",
      data: summary.timeline,
      mode: "timeline",
    },
  ];
  return (
    <div className="mx-auto min-w-0 max-w-screen-2xl space-y-7 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ChartNoAxesCombined className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Financeiro</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
              Visão executiva das ordens de serviço concluídas no período selecionado.
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              Resultado bruto é faturamento menos custos conhecidos de peças; não representa lucro
              líquido contábil ou fluxo de caixa.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2 bg-white"
          disabled={loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw className={`h-4 w-4 ${loading && !reducedMotion ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
      {loading && <p role="status">Carregando financeiro…</p>}
      {error && (
        <p role="alert" className="rounded-md border p-4 text-destructive">
          {error}
        </p>
      )}
      {rows && (
        <>
          <section
            aria-label="Filtros financeiros"
            className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]"
          >
            <div className="mr-1 flex items-center gap-2 self-center text-sm font-medium text-slate-700">
              <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
              Filtros
            </div>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Categoria
              <select
                className="h-10 min-w-32 rounded-md border border-slate-200 bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {["Todos", "Carro", "Moto"].map((v) => (
                  <option key={v} value={v}>
                    {v === "Carro" ? "Carros" : v === "Moto" ? "Motos" : v}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-slate-600">
              Período
              <select
                className="h-10 min-w-40 rounded-md border border-slate-200 bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="today">Hoje</option>
                <option value="month">Este mês</option>
                <option value="previous">Mês anterior</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            {period === "custom" && (
              <>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  De
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Até
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </label>
              </>
            )}
          </section>
          {invalidRange ? (
            <p role="alert">A data inicial deve ser anterior à data final.</p>
          ) : (
            <>
              <section
                aria-label="Desempenho financeiro da oficina"
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.04]"
              >
                <div className="grid xl:grid-cols-[minmax(18rem,1fr)_minmax(0,1.8fr)]">
                  <div className="relative min-w-0 overflow-hidden bg-primary px-5 py-6 text-primary-foreground sm:p-7">
                    <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border border-white/10" />
                    <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                      <Banknote className="h-4 w-4" aria-hidden="true" />
                      Resultado bruto
                    </div>
                    <p className="relative mt-4 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                      {money(summary.result)}
                    </p>
                    <p className="relative mt-3 max-w-sm text-xs leading-relaxed text-white/70">
                      Faturamento menos custos conhecidos das peças.
                    </p>
                  </div>
                  <dl className="grid min-w-0 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {(
                      [
                        [
                          "Faturamento total",
                          money(summary.revenue),
                          "Total das OS concluídas dentro dos filtros.",
                          ReceiptText,
                        ],
                        [
                          "Ticket médio",
                          money(summary.ticket),
                          "Média das OS que possuem valor conhecido.",
                          Banknote,
                        ],
                        [
                          "OS consideradas",
                          String(summary.orders),
                          "Ordens concluídas incluídas neste período.",
                          ClipboardCheck,
                        ],
                      ] as Array<[string, string, string, LucideIcon]>
                    ).map(([label, value, description, Icon]) => (
                      <div
                        key={String(label)}
                        className="group min-w-0 p-5 transition-colors duration-150 hover:bg-slate-50/80 sm:p-6"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-xs font-medium leading-5 text-slate-600">{label}</dt>
                          <Icon className="h-4 w-4 text-slate-400 group-hover:text-primary" />
                        </div>
                        <dd className="mt-2 break-words text-xl font-semibold tracking-tight text-slate-950 tabular-nums sm:text-2xl">
                          {value}
                        </dd>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">{description}</p>
                      </div>
                    ))}
                  </dl>
                </div>
                <dl className="grid border-t border-slate-200 bg-slate-50/60 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
                  {(
                    [
                      [
                        "Serviços / mão de obra",
                        money(summary.servicesRevenue),
                        "Receita dos serviços executados.",
                        Wrench,
                      ],
                      [
                        "Peças",
                        money(summary.partsRevenue),
                        "Receita das peças executadas.",
                        Package,
                      ],
                      [
                        "Custo conhecido das peças",
                        money(summary.cost),
                        "Somente peças com custo cadastrado.",
                        ReceiptText,
                      ],
                    ] as Array<[string, string, string, LucideIcon]>
                  ).map(([label, value, description, Icon]) => (
                    <div key={String(label)} className="flex min-w-0 gap-3 p-4 sm:px-5">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-primary shadow-sm ring-1 ring-slate-200">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div>
                        <dt className="text-xs font-medium leading-5 text-slate-600">{label}</dt>
                        <dd className="break-words text-base font-semibold text-slate-900 tabular-nums">
                          {value}
                        </dd>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </dl>
              </section>
              <p className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-amber-950/75">
                {summary.unpriced} OS sem valor suficiente: excluídas das somas e do ticket.{" "}
                {summary.incompleteCosts} OS com custo de peças incompleto. Resultados com custo
                parcial são provisórios; quando o custo de uma OS com peças é totalmente
                desconhecido, seu resultado e o agregado ficam não informados. {summary.undated} OS
                sem data de conclusão válida foram excluídas. O custo de OS somente com serviços é
                zero porque não há peças, não por estimativa.
              </p>
              {summary.orders === 0 && (
                <p className="rounded-md border border-dashed p-5">
                  Nenhuma OS concluída para estes filtros.
                </p>
              )}
              <section aria-label="Análises financeiras" className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    Análises do período
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Composição e evolução dos valores considerados pelos filtros atuais.
                  </p>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {charts.map((chart, chartIndex) => (
                    <Card
                      key={chart.title}
                      className={
                        chart.mode === "timeline"
                          ? "min-w-0 overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03] xl:col-span-2"
                          : "min-w-0 overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm shadow-slate-950/[0.03]"
                      }
                    >
                      <CardContent className="min-w-0 p-4 sm:p-6">
                        <div className="mb-5 min-h-16 border-b border-slate-100 pb-4">
                          <h3 className="text-base font-semibold tracking-tight text-slate-950">
                            {chart.title}
                          </h3>
                          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                            {chart.subtitle}
                          </p>
                        </div>
                        {!chart.data.length ? (
                          <div className="flex h-64 flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-5 text-center sm:h-72">
                            <p className="text-sm font-medium">Sem dados neste período</p>
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                              Os valores das OS consideradas aparecerão aqui. Revise os filtros
                              selecionados.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div
                              className={`h-64 min-w-0 text-xs tabular-nums sm:h-72 xl:h-80 ${chart.mode === "comparison" ? "financial-bar-chart" : ""}`}
                              role="img"
                              aria-label={chart.title}
                            >
                              <ResponsiveContainer
                                key={`${chart.title}-${kind}-${period}-${customStart}-${customEnd}`}
                                width="100%"
                                height="100%"
                              >
                                {chart.mode === "comparison" ? (
                                  <BarChart
                                    data={chart.data}
                                    margin={{ top: 12, right: 8, bottom: 8, left: 0 }}
                                    barGap={3}
                                    barCategoryGap="18%"
                                  >
                                    <defs>
                                      {[
                                        ["revenue", "#173f8f", "#4d7dcc"],
                                        ["cost", "#6f7e92", "#b4becb"],
                                        ["result", "#11652f", "#36a463"],
                                      ].map(([name, dark, light]) => (
                                        <linearGradient
                                          key={name}
                                          id={`financial-bar-${chartIndex}-${name}`}
                                          x1="0"
                                          y1="1"
                                          x2="0"
                                          y2="0"
                                        >
                                          <stop offset="0%" stopColor={dark} />
                                          <stop offset="100%" stopColor={light} />
                                        </linearGradient>
                                      ))}
                                      <linearGradient
                                        id={`financial-sheen-${chartIndex}`}
                                        x1="0"
                                        y1="0"
                                        x2="1"
                                        y2="0"
                                      >
                                        <stop offset="0%" stopColor="white" stopOpacity="0" />
                                        <stop offset="50%" stopColor="white" stopOpacity="0.45" />
                                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                                      </linearGradient>
                                      <linearGradient
                                        id={`financial-grid-${chartIndex}`}
                                        gradientUnits="userSpaceOnUse"
                                        x1="0%"
                                        y1="0%"
                                        x2="100%"
                                        y2="0%"
                                      >
                                        <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0" />
                                        <stop offset="8%" stopColor="#CBD5E1" stopOpacity="0.55" />
                                        <stop offset="92%" stopColor="#CBD5E1" stopOpacity="0.55" />
                                        <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0" />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                      horizontal
                                      vertical={false}
                                      stroke={`url(#financial-grid-${chartIndex})`}
                                      strokeDasharray="2 6"
                                    />
                                    <ReferenceLine
                                      y={0}
                                      stroke="#94A3B8"
                                      strokeOpacity={0.72}
                                      strokeWidth={1.25}
                                      ifOverflow="extendDomain"
                                    />
                                    <XAxis
                                      dataKey="name"
                                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                      axisLine={false}
                                      tickLine={false}
                                      tickMargin={10}
                                      minTickGap={40}
                                      interval="preserveStartEnd"
                                      tickFormatter={(value) => chartDate(String(value))}
                                    />
                                    <YAxis
                                      width={78}
                                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                      axisLine={false}
                                      tickLine={false}
                                      tickCount={5}
                                      tickFormatter={(value) => chartCurrency.format(Number(value))}
                                    />
                                    <Tooltip
                                      content={<FinancialChartTooltip />}
                                      filterNull={false}
                                      cursor={{
                                        stroke: "var(--border)",
                                        fill: "var(--muted)",
                                        fillOpacity: 0.3,
                                      }}
                                      isAnimationActive={!reducedMotion}
                                      animationDuration={180}
                                    />
                                    <Legend
                                      iconType="square"
                                      iconSize={8}
                                      wrapperStyle={{
                                        paddingTop: 18,
                                        fontSize: 11,
                                        lineHeight: "22px",
                                      }}
                                      formatter={(value) => (
                                        <span
                                          className={
                                            value === "Resultado bruto"
                                              ? "font-semibold text-foreground"
                                              : "text-muted-foreground"
                                          }
                                        >
                                          {value}
                                        </span>
                                      )}
                                    />
                                    <Bar
                                      dataKey="Faturamento"
                                      fill={`url(#financial-bar-${chartIndex}-revenue)`}
                                      maxBarSize={52}
                                      isAnimationActive={false}
                                      shape={(props: unknown) => (
                                        <PremiumBarShape
                                          {...(props as PremiumBarShapeProps)}
                                          chartIndex={chartIndex}
                                          seriesIndex={0}
                                          pulse={chartIndex === 0}
                                        />
                                      )}
                                    />
                                    <Bar
                                      dataKey="Custo"
                                      name="Custo das peças"
                                      fill={`url(#financial-bar-${chartIndex}-cost)`}
                                      maxBarSize={52}
                                      isAnimationActive={false}
                                      shape={(props: unknown) => (
                                        <PremiumBarShape
                                          {...(props as PremiumBarShapeProps)}
                                          chartIndex={chartIndex}
                                          seriesIndex={1}
                                          pulse={false}
                                        />
                                      )}
                                    />
                                    <Bar
                                      dataKey="Resultado"
                                      name="Resultado bruto"
                                      fill={`url(#financial-bar-${chartIndex}-result)`}
                                      maxBarSize={52}
                                      isAnimationActive={false}
                                      shape={(props: unknown) => (
                                        <PremiumBarShape
                                          {...(props as PremiumBarShapeProps)}
                                          chartIndex={chartIndex}
                                          seriesIndex={2}
                                          pulse={false}
                                        />
                                      )}
                                    />
                                  </BarChart>
                                ) : (
                                  <ComposedChart
                                    data={chart.data}
                                    margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
                                  >
                                    <defs>
                                      <linearGradient
                                        id={`financial-area-${chartIndex}`}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                      >
                                        <stop offset="0%" stopColor="#315ead" stopOpacity="0.2" />
                                        <stop offset="72%" stopColor="#315ead" stopOpacity="0.04" />
                                        <stop offset="100%" stopColor="#315ead" stopOpacity="0" />
                                      </linearGradient>
                                      <linearGradient
                                        id={`financial-grid-${chartIndex}`}
                                        gradientUnits="userSpaceOnUse"
                                        x1="0%"
                                        y1="0%"
                                        x2="100%"
                                        y2="0%"
                                      >
                                        <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0" />
                                        <stop offset="8%" stopColor="#CBD5E1" stopOpacity="0.55" />
                                        <stop offset="92%" stopColor="#CBD5E1" stopOpacity="0.55" />
                                        <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0" />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                      horizontal
                                      vertical={false}
                                      stroke={`url(#financial-grid-${chartIndex})`}
                                      strokeDasharray="2 6"
                                    />
                                    <ReferenceLine
                                      y={0}
                                      stroke="#94A3B8"
                                      strokeOpacity={0.72}
                                      strokeWidth={1.25}
                                      ifOverflow="extendDomain"
                                    />
                                    <XAxis
                                      dataKey="name"
                                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                                      axisLine={false}
                                      tickLine={false}
                                      tickMargin={10}
                                      minTickGap={40}
                                      interval="preserveStartEnd"
                                      tickFormatter={(value) => chartDate(String(value))}
                                    />
                                    <YAxis
                                      width={78}
                                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                      axisLine={false}
                                      tickLine={false}
                                      tickCount={5}
                                      tickFormatter={(value) => chartCurrency.format(Number(value))}
                                    />
                                    <Tooltip
                                      content={<FinancialChartTooltip />}
                                      filterNull={false}
                                      cursor={{
                                        stroke: "var(--border)",
                                        fill: "var(--muted)",
                                        fillOpacity: 0.3,
                                      }}
                                      isAnimationActive={!reducedMotion}
                                      animationDuration={180}
                                    />
                                    <Legend
                                      iconType="square"
                                      iconSize={8}
                                      wrapperStyle={{
                                        paddingTop: 18,
                                        fontSize: 11,
                                        lineHeight: "22px",
                                      }}
                                      formatter={(value) => (
                                        <span
                                          className={
                                            value === "Resultado bruto"
                                              ? "font-semibold text-foreground"
                                              : "text-muted-foreground"
                                          }
                                        >
                                          {value}
                                        </span>
                                      )}
                                    />
                                    <Area
                                      dataKey="Faturamento"
                                      type="monotoneX"
                                      fill={`url(#financial-area-${chartIndex})`}
                                      stroke="none"
                                      legendType="none"
                                      tooltipType="none"
                                      isAnimationActive={false}
                                      connectNulls={false}
                                    />
                                    <Line
                                      dataKey="Faturamento"
                                      type="monotoneX"
                                      stroke="#173F8F"
                                      strokeWidth={2}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeDasharray={reducedMotion ? undefined : "3000 3000"}
                                      strokeDashoffset={reducedMotion || lineMotionReady ? 0 : 3000}
                                      style={
                                        reducedMotion
                                          ? undefined
                                          : {
                                              transition:
                                                "stroke-dashoffset 1000ms cubic-bezier(0.23, 1, 0.32, 1)",
                                            }
                                      }
                                      dot={
                                        chart.data.length <= 8
                                          ? {
                                              r: 3.5,
                                              fill: "#315EAD",
                                              stroke: "#0F2F6C",
                                              strokeWidth: 1.5,
                                              opacity: reducedMotion || lineMotionReady ? 1 : 0,
                                              style: reducedMotion
                                                ? undefined
                                                : {
                                                    transition: "opacity 180ms ease-out 1000ms",
                                                  },
                                            }
                                          : false
                                      }
                                      activeDot={{
                                        r: 5.5,
                                        stroke: "#0F2F6C",
                                        strokeWidth: 2,
                                        fill: "#315EAD",
                                      }}
                                      isAnimationActive={false}
                                      connectNulls={false}
                                    />
                                    <Line
                                      dataKey="Resultado"
                                      name="Resultado bruto"
                                      type="monotoneX"
                                      stroke="#15803D"
                                      strokeWidth={3}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeDasharray={reducedMotion ? undefined : "3000 3000"}
                                      strokeDashoffset={reducedMotion || lineMotionReady ? 0 : 3000}
                                      style={
                                        reducedMotion
                                          ? undefined
                                          : {
                                              transition:
                                                "stroke-dashoffset 1000ms cubic-bezier(0.23, 1, 0.32, 1) 140ms",
                                            }
                                      }
                                      dot={
                                        chart.data.length <= 8
                                          ? {
                                              r: 3.5,
                                              fill: "#22A052",
                                              stroke: "#0D5A2A",
                                              strokeWidth: 1.5,
                                              opacity: reducedMotion || lineMotionReady ? 1 : 0,
                                              style: reducedMotion
                                                ? undefined
                                                : {
                                                    transition: "opacity 180ms ease-out 1140ms",
                                                  },
                                            }
                                          : false
                                      }
                                      activeDot={{
                                        r: 5.5,
                                        stroke: "#0D5A2A",
                                        strokeWidth: 2,
                                        fill: "#22A052",
                                      }}
                                      isAnimationActive={false}
                                      connectNulls={false}
                                    />
                                  </ComposedChart>
                                )}
                              </ResponsiveContainer>
                            </div>
                            <details className="mt-3 text-xs">
                              <summary>Ver valores em reais</summary>
                              {chart.data.map((row) => (
                                <p key={row.name}>
                                  {row.name}:{" "}
                                  {`faturamento ${money(row.Faturamento)} · custo conhecido ${money(row.Custo)} · resultado bruto ${money(row.Resultado)}`}
                                </p>
                              ))}
                            </details>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
              <Card className="min-w-0 overflow-hidden rounded-xl border-slate-200 shadow-sm shadow-slate-950/[0.03]">
                <CardContent className="min-w-0 p-4 sm:p-6">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                      Resumo por OS
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Detalhamento das ordens que compõem os indicadores deste período.
                    </p>
                  </div>
                  <div
                    className="max-h-[32rem] max-w-full overflow-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    tabIndex={0}
                    aria-label="Resumo financeiro das ordens"
                  >
                    <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-left text-sm [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:tabular-nums">
                      <thead>
                        <tr className="border-b">
                          {[
                            "OS / veículo / cliente",
                            "Categoria",
                            "Data de conclusão",
                            "Total da OS",
                            "Peças",
                            "Serviços",
                            "Custo conhecido",
                            "Resultado bruto",
                          ].map((label) => (
                            <th
                              className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-600"
                              key={label}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.rows.map((order) => (
                          <tr
                            className="align-top transition-colors duration-150 hover:bg-slate-50"
                            key={order.orderId}
                          >
                            <td className="p-2">
                              <strong>{order.orderNumber}</strong>
                              <p>{order.vehicle ?? "Veículo não informado"}</p>
                              <p className="text-xs text-muted-foreground">
                                {order.customer ?? "Cliente não informado"}
                              </p>
                            </td>
                            <td className="p-2">{order.kind ?? "Não informado"}</td>
                            <td className="p-2 whitespace-nowrap">
                              {order.completedAt?.split("-").reverse().join("/")}
                            </td>
                            <td className="p-2 whitespace-nowrap">{money(order.revenue)}</td>
                            <td className="p-2 whitespace-nowrap">{money(order.partsRevenue)}</td>
                            <td className="p-2 whitespace-nowrap">
                              {money(order.servicesRevenue)}
                            </td>
                            <td className="p-2">
                              {money(order.cost)}
                              {order.missingCosts > 0 && (
                                <p className="text-xs text-amber-700">
                                  {order.missingCosts} peça(s) sem custo suficiente
                                </p>
                              )}
                            </td>
                            <td className="p-2">
                              {money(order.result)}
                              {order.missingCosts > 0 && order.result !== null && (
                                <p className="text-xs text-amber-700">Provisório — custo parcial</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!summary.rows.length && (
                    <p className="py-4 text-sm text-muted-foreground">Nenhuma OS no período.</p>
                  )}
                </CardContent>
              </Card>
              <details className="group rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm shadow-slate-950/[0.03] sm:px-6">
                <summary className="cursor-pointer rounded-sm py-3 text-sm font-semibold tracking-tight text-slate-800 marker:text-slate-400 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
                  Rentabilidade de peças
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">
                  Somente peças com custo conhecido dos mesmos filtros. Não representa o resultado
                  completo da oficina.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Receita com custo conhecido", money(summary.parts.knownRevenue)],
                    ["Custo", money(summary.parts.cost)],
                    ["Lucro bruto das peças", money(summary.parts.profit)],
                    [
                      "Margem das peças",
                      summary.parts.margin === null
                        ? "Não informado"
                        : summary.parts.margin.toFixed(1) + "%",
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                      <p className="text-xs text-slate-500">{label}</p>
                      <strong className="mt-1 block text-slate-900 tabular-nums">{value}</strong>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Detalhe por peça aprovada e executada. O acréscimo abaixo é implícito na venda,
                  não o markup manual salvo. Para consultar ou editar esse markup, use “Custo,
                  quantidade e preço” na própria OS. Peças sem nome usam sua posição neste
                  detalhamento como identificação.
                </p>
                <div
                  className="mt-3 max-w-full overflow-x-auto"
                  tabIndex={0}
                  aria-label="Rentabilidade por peça"
                >
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        {[
                          "OS / peça",
                          "Quantidade",
                          "Custo unitário",
                          "Custo total",
                          "Acréscimo implícito",
                          "Lucro da peça",
                        ].map((label) => (
                          <th className="p-2 font-medium" key={label}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.rows.flatMap((order) =>
                        order.items
                          .filter((item) => item.type === "Peça")
                          .map((item, index) => {
                            const validQuantity =
                              item.quantity !== null &&
                              Number.isInteger(item.quantity) &&
                              item.quantity > 0;
                            const amounts =
                              item.revenue !== null && validQuantity
                                ? partAmounts(
                                    { price: item.revenue, quantity: item.quantity! },
                                    item.unitCost,
                                  )
                                : null;
                            const markup =
                              validQuantity && item.revenue !== null
                                ? implicitMarkup(item.unitCost, item.revenue / item.quantity!)
                                : null;
                            return (
                              <tr className="border-b" key={order.orderId + "-" + index}>
                                <td className="p-2">
                                  {order.orderNumber} · {item.name?.trim() || `Peça ${index + 1}`}
                                </td>
                                <td className="p-2">
                                  {validQuantity ? item.quantity : "Não informado"}
                                </td>
                                <td className="p-2">{money(item.unitCost)}</td>
                                <td className="p-2">{money(amounts?.cost ?? null)}</td>
                                <td className="p-2">
                                  {markup === null
                                    ? "Não informado"
                                    : markup.toLocaleString("pt-BR") + "%"}
                                </td>
                                <td className="p-2">{money(amounts?.profit ?? null)}</td>
                              </tr>
                            );
                          }),
                      )}
                    </tbody>
                  </table>
                </div>
                {!summary.rows.some((order) =>
                  order.items.some((item) => item.type === "Peça"),
                ) && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhuma peça considerada nestes filtros.
                  </p>
                )}
              </details>
            </>
          )}
          {accessLevel === "owner" && (
            <Card className="border-slate-200 shadow-sm shadow-slate-950/[0.03]">
              <CardContent className="space-y-3 p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h2 className="font-semibold">Acesso ao financeiro</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Conceda acesso apenas à equipe autorizada a consultar custos e registrar dados
                  financeiros.
                </p>
                {members.map((member) => (
                  <label key={member.user_id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={member.allowed}
                      disabled={member.owner || saving}
                      onChange={async (e) => {
                        if (lock.current) return;
                        lock.current = true;
                        setSaving(true);
                        setError("");
                        const allowed = e.target.checked;
                        try {
                          await financialApi.grant(member.user_id, allowed);
                          setMembers(await financialApi.members());
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Não foi possível alterar a permissão.",
                          );
                        } finally {
                          lock.current = false;
                          setSaving(false);
                        }
                      }}
                    />
                    {member.full_name || "Sem nome"}
                    {member.owner ? " · proprietário" : ""}
                  </label>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

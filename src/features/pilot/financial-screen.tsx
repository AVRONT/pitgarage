import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
    <div className="max-w-[min(19rem,80vw)] rounded-md border bg-card p-3 text-xs text-foreground shadow-sm">
      <p className="mb-2 border-b pb-2 font-medium">{chartDate(String(label ?? ""), true)}</p>
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
      subtitle: "Valores consolidados no período · resultado bruto em destaque",
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
      subtitle: "Compare faturamento e resultado por categoria",
      data: summary.vehicles,
      mode: "comparison",
    },
    {
      title: "Evolução do faturamento e resultado bruto",
      subtitle: "Por data de conclusão · valores em reais, sem acumulação",
      data: summary.timeline,
      mode: "timeline",
    },
  ];
  return (
    <div className="mx-auto min-w-0 max-w-screen-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground">
            Visão financeira das OS concluídas no período.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            O resultado bruto considera faturamento menos custos conhecidos de peças. Não representa
            lucro líquido contábil ou fluxo de caixa.
          </p>
        </div>
        <Button variant="outline" disabled={loading} onClick={() => setRevision((v) => v + 1)}>
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
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-b border-border/60 pb-4">
            <label className="text-sm">
              Veículo
              <select
                className="ml-2 h-10 rounded-md border bg-background px-3"
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
            <label className="text-sm">
              Período
              <select
                className="ml-2 h-10 rounded-md border bg-background px-3"
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
                <label className="text-sm">
                  De
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Até
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          {invalidRange ? (
            <p role="alert">A data inicial deve ser anterior à data final.</p>
          ) : (
            <>
              <section
                aria-label="Desempenho financeiro da oficina"
                className="overflow-hidden rounded-[12px] bg-card"
              >
                <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)] xl:items-center xl:gap-10">
                  <div className="min-w-0 rounded-[10px] bg-primary/[0.045] px-5 py-6">
                    <h2 className="text-sm font-medium text-primary">Resultado bruto</h2>
                    <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                      {money(summary.result)}
                    </p>
                  </div>
                  <dl className="grid min-w-0 gap-5 sm:grid-cols-3">
                    {[
                      ["Faturamento total", money(summary.revenue)],
                      ["Ticket médio (OS com valor)", money(summary.ticket)],
                      ["OS consideradas", String(summary.orders)],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-xs leading-5 text-muted-foreground sm:min-h-10">
                          {label}
                        </dt>
                        <dd className="mt-2 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <dl className="grid gap-4 border-t border-border/40 px-5 py-4 sm:grid-cols-3 sm:px-6">
                  {[
                    ["Serviços / mão de obra", money(summary.servicesRevenue)],
                    ["Peças", money(summary.partsRevenue)],
                    ["Custo conhecido das peças", money(summary.cost)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 sm:block"
                    >
                      <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
                      <dd className="break-words text-base font-medium tabular-nums sm:mt-1">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <p className="text-sm text-muted-foreground">
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
              <div className="grid gap-x-8 gap-y-6 rounded-[12px] bg-card p-4 sm:p-6 xl:grid-cols-2">
                {charts.map((chart) => (
                  <Card
                    key={chart.title}
                    className={
                      chart.mode === "timeline"
                        ? "min-w-0 rounded-none border-0 border-t border-border/40 bg-transparent pt-6 shadow-none xl:col-span-2"
                        : "min-w-0 rounded-none border-0 bg-transparent shadow-none"
                    }
                  >
                    <CardContent className="min-w-0 p-0">
                      <div className="mb-5 min-h-14">
                        <h2 className="text-base font-semibold tracking-tight">{chart.title}</h2>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
                            className="h-64 min-w-0 text-xs tabular-nums sm:h-72"
                            role="img"
                            aria-label={chart.title}
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              {chart.mode === "comparison" ? (
                                <BarChart
                                  data={chart.data}
                                  margin={{ top: 12, right: 8, bottom: 8, left: 0 }}
                                  barGap={3}
                                  barCategoryGap="18%"
                                >
                                  <CartesianGrid
                                    stroke="var(--border)"
                                    strokeOpacity={0.55}
                                    strokeDasharray="2 4"
                                    vertical={false}
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
                                    isAnimationActive={false}
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
                                    fill="#315EAD"
                                    radius={[3, 3, 0, 0]}
                                    maxBarSize={52}
                                    isAnimationActive={false}
                                  />
                                  <Bar
                                    dataKey="Custo"
                                    name="Custo das peças"
                                    fill="#94A3B8"
                                    radius={[3, 3, 0, 0]}
                                    maxBarSize={52}
                                    isAnimationActive={false}
                                  />
                                  <Bar
                                    dataKey="Resultado"
                                    name="Resultado bruto"
                                    fill="#15803D"
                                    radius={[3, 3, 0, 0]}
                                    maxBarSize={52}
                                    isAnimationActive={false}
                                  />
                                </BarChart>
                              ) : (
                                <LineChart
                                  data={chart.data}
                                  margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
                                >
                                  <CartesianGrid
                                    stroke="var(--border)"
                                    strokeOpacity={0.55}
                                    strokeDasharray="2 4"
                                    vertical={false}
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
                                    isAnimationActive={false}
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
                                  <Line
                                    dataKey="Faturamento"
                                    stroke="#173F8F"
                                    strokeWidth={2}
                                    dot={chart.data.length <= 8 ? { r: 3, strokeWidth: 0 } : false}
                                    activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                                    isAnimationActive={false}
                                    connectNulls={false}
                                  />
                                  <Line
                                    dataKey="Resultado"
                                    name="Resultado bruto"
                                    stroke="#15803D"
                                    strokeWidth={3}
                                    dot={chart.data.length <= 8 ? { r: 3, strokeWidth: 0 } : false}
                                    activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                                    isAnimationActive={false}
                                    connectNulls={false}
                                  />
                                </LineChart>
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
              <Card className="min-w-0 rounded-[12px] border-0 shadow-none">
                <CardContent className="min-w-0 p-4 sm:p-6">
                  <h2 className="mb-4 text-base font-semibold tracking-tight">Resumo por OS</h2>
                  <div
                    className="max-h-[32rem] max-w-full overflow-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    tabIndex={0}
                    aria-label="Resumo financeiro das ordens"
                  >
                    <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-left text-sm [&_td]:border-b [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-3 [&_td]:tabular-nums">
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
                              className="sticky top-0 z-10 border-b border-border/50 bg-card px-3 py-3 text-xs font-medium text-muted-foreground"
                              key={label}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.rows.map((order) => (
                          <tr className="align-top hover:bg-muted/40" key={order.orderId}>
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
              <details className="rounded-[12px] border-0 bg-card px-4 py-2 sm:px-6">
                <summary className="cursor-pointer rounded-sm py-3 text-sm font-semibold tracking-tight marker:text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
                    <div key={label}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <strong>{value}</strong>
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
            <Card>
              <CardContent className="space-y-3 p-4">
                <h2 className="font-semibold">Acesso ao financeiro</h2>
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

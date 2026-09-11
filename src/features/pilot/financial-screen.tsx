import { useEffect, useRef, useState } from "react";
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
  const summary = aggregateOrders(rows ?? [], kind, range.start, range.end);
  const charts = [
    {
      title: "Faturamento × custo das peças × resultado bruto",
      data: summary.timeline,
      mode: "timeline",
    },
    { title: "Comparação financeira Carros × Motos", data: summary.vehicles, mode: "comparison" },
    {
      title: "Resultado bruto ao longo do tempo — Carros e Motos",
      data: summary.vehicleTimeline,
      mode: "vehicles",
    },
  ];
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Resultado operacional das OS concluídas, com peças e serviços aprovados e executados.
            Período pela conclusão; não representa lucro líquido nem recebimentos de caixa.
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
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Veículo
              <select
                className="ml-2 h-10 rounded-md border bg-background px-3"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {["Todos", "Carro", "Moto"].map((v) => (
                  <option key={v}>{v}</option>
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Faturamento das OS", money(summary.revenue)],
                  ["Receita de peças", money(summary.partsRevenue)],
                  ["Receita de serviços", money(summary.servicesRevenue)],
                  ["Custo conhecido das peças", money(summary.cost)],
                  ["Resultado bruto", money(summary.result)],
                  ["Ticket médio (OS com valor)", money(summary.ticket)],
                  ["OS consideradas", String(summary.orders)],
                ].map(([label, value]) => (
                  <Card key={label}>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-2 text-xl font-semibold">{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
              <div className="grid gap-4 xl:grid-cols-3">
                {charts.map((chart) => (
                  <Card key={chart.title}>
                    <CardContent className="min-w-0 p-4">
                      <h2 className="mb-4 font-semibold">{chart.title}</h2>
                      {!chart.data.length ? (
                        <p className="py-8 text-sm text-muted-foreground">
                          Sem dados financeiros suficientes.
                        </p>
                      ) : (
                        <>
                          <div className="h-56 min-w-0" role="img" aria-label={chart.title}>
                            <ResponsiveContainer width="100%" height="100%">
                              {chart.mode === "comparison" ? (
                                <BarChart data={chart.data}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                  <YAxis width={65} />
                                  <Tooltip />
                                  <Legend />
                                  <Bar
                                    dataKey="Faturamento"
                                    fill="#173F8F"
                                    isAnimationActive={false}
                                  />
                                  <Bar
                                    dataKey="Custo"
                                    name="Custo das peças"
                                    fill="#94A3B8"
                                    isAnimationActive={false}
                                  />
                                  <Bar
                                    dataKey="Resultado"
                                    name="Resultado bruto"
                                    fill="#15803D"
                                    isAnimationActive={false}
                                  />
                                </BarChart>
                              ) : (
                                <LineChart data={chart.data}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                  <YAxis width={65} />
                                  <Tooltip />
                                  <Legend />
                                  {chart.mode === "vehicles" ? (
                                    <>
                                      <Line
                                        dataKey="Carros"
                                        stroke="#173F8F"
                                        strokeWidth={2}
                                        isAnimationActive={false}
                                        connectNulls={false}
                                      />
                                      <Line
                                        dataKey="Motos"
                                        stroke="#B51F26"
                                        strokeWidth={2}
                                        isAnimationActive={false}
                                        connectNulls={false}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <Line
                                        dataKey="Faturamento"
                                        stroke="#173F8F"
                                        strokeWidth={2}
                                        isAnimationActive={false}
                                        connectNulls={false}
                                      />
                                      <Line
                                        dataKey="Custo"
                                        name="Custo das peças"
                                        stroke="#667085"
                                        isAnimationActive={false}
                                        connectNulls={false}
                                      />
                                      <Line
                                        dataKey="Resultado"
                                        name="Resultado bruto"
                                        stroke="#15803D"
                                        strokeWidth={2}
                                        isAnimationActive={false}
                                        connectNulls={false}
                                      />
                                    </>
                                  )}
                                </LineChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                          <details className="mt-3 text-xs">
                            <summary>Ver valores em reais</summary>
                            {chart.data.map((row) => (
                              <p key={row.name}>
                                {row.name}:{" "}
                                {"Carros" in row
                                  ? `Carros ${money(row.Carros)} · Motos ${money(row.Motos)}`
                                  : `faturamento ${money(row.Faturamento)} · custo conhecido ${money(row.Custo)} · resultado bruto ${money(row.Resultado)}`}
                              </p>
                            ))}
                          </details>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardContent className="min-w-0 p-4">
                  <h2 className="mb-3 font-semibold">Resumo por OS</h2>
                  <div
                    className="max-w-full overflow-x-auto"
                    tabIndex={0}
                    aria-label="Resumo financeiro das ordens"
                  >
                    <table className="w-full min-w-[1000px] text-left text-sm">
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
                            <th className="p-2 font-medium" key={label}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.rows.map((order) => (
                          <tr className="border-b align-top" key={order.orderId}>
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
              <details className="rounded-md border bg-card p-4">
                <summary className="cursor-pointer font-semibold">
                  Detalhamento da rentabilidade das peças
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

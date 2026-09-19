import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, Plus } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extraRevenueApi, type Receivable } from "./extra-revenue-api";
import {
  extraSummary,
  consolidated,
  type ExtraRevenue,
  type RevenueCategory,
} from "./extra-revenue-model";
import { money as currency } from "./pilot-data";
import { receiptDay } from "./payment-model";
const money = (value: number | null) => (value === null ? "Não informado" : currency(value));

const revenueTypes = [
  { id: "oil", label: "Venda de óleo", aliases: ["venda de óleo", "óleo usado"] },
  { id: "scrap", label: "Ferro velho", aliases: ["ferro velho", "sucata"] },
  { id: "parts", label: "Venda de peças", aliases: ["venda de peças", "peças"] },
  { id: "rescue", label: "Resgate", aliases: ["resgate", "guincho"] },
  { id: "other", label: "Outro", aliases: ["outros ganhos", "outros", "receitas extras"] },
] as const;

type RevenueType = (typeof revenueTypes)[number];

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

function categoryForType(categories: RevenueCategory[], type: RevenueType) {
  const aliases = type.aliases.map(normalized);
  const genericAliases = revenueTypes.at(-1)!.aliases.map(normalized);
  const match =
    categories.find((item) => item.active && aliases.includes(normalized(item.name))) ??
    categories.find((item) => item.active && genericAliases.includes(normalized(item.name)));
  if (!match) return { categoryId: "", subcategoryId: "" };
  return match.parent_id
    ? { categoryId: match.parent_id, subcategoryId: match.id }
    : { categoryId: match.id, subcategoryId: "" };
}

export function ExtraRevenues({
  view,
  start,
  end,
  kind,
  os,
}: {
  view: "summary" | "orders" | "extras" | "receivables" | "performance";
  start: string;
  end: string;
  kind: string;
  os: { revenue: number | null; cost: number | null; result: number | null };
}) {
  const { accessLevel } = useAuth();
  const write = accessLevel === "owner" || accessLevel === "admin";
  const [categories, setCategories] = useState<RevenueCategory[]>([]);
  const [entries, setEntries] = useState<ExtraRevenue[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [edit, setEdit] = useState("");
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [active, setActive] = useState(true);
  const [entryCategory, setEntryCategory] = useState("");
  const [entrySub, setEntrySub] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => receiptDay(new Date().toISOString()));
  const [revenue, setRevenue] = useState("");
  const [cost, setCost] = useState("");
  const [entryType, setEntryType] = useState<RevenueType["id"] | "">("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const entryId = useRef(crypto.randomUUID());
  const categoryId = useRef(crypto.randomUUID());
  useEffect(() => {
    let live = true;
    setReady(false);
    setError("");
    Promise.all([extraRevenueApi.list(), extraRevenueApi.receivables()])
      .then(([data, balances]) => {
        if (live) {
          setCategories(data.categories);
          setEntries(data.entries);
          setReceivables(balances);
          setReady(true);
        }
      })
      .catch(() => {
        if (live)
          setError("Não foi possível carregar recebimentos e receitas extras. Tente novamente.");
      });
    return () => {
      live = false;
    };
  }, [revision]);
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice("Registro salvo.");
    } catch {
      setError(
        "Não foi possível confirmar a gravação. Os campos foram mantidos; atualize antes de tentar novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const extra = extraSummary(entries, start, end, category, subcategory);
  const total = consolidated(os, extra);
  const filteredOS = receivables.filter(
    (r) =>
      (kind === "Todos" || r.kind === kind) &&
      (!start || r.date >= start) &&
      (!end || r.date <= end),
  );
  const balances = filteredOS.filter((r) => r.balance > 0);
  const cash = receivables
    .filter((r) => kind === "Todos" || r.kind === kind)
    .reduce((sum, r) => {
      const payments = r.payment?.receipts ?? (r.payment?.status === "Pago" ? [r.payment] : []);
      return (
        sum +
        payments
          .filter((p) => {
            const day = receiptDay(p.date);
            return day && (!start || day >= start) && (!end || day <= end);
          })
          .reduce((n, p) => n + Number(p.amount), 0)
      );
    }, 0);
  const balance = balances.reduce((sum, item) => sum + Number(item.balance), 0);
  const feedback = (
    <>
      {error && (
        <Alert role="alert" variant="destructive">
          <CircleAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert role="status" className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <AlertTitle>Receita adicionada</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {!ready && !error && (
        <Alert role="status" className="text-slate-700">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          <AlertTitle>Carregando informações financeiras…</AlertTitle>
        </Alert>
      )}
    </>
  );
  if (view === "orders" || view === "performance") return null;
  if (view === "summary")
    return (
      <section aria-label="Resumo financeiro" className="space-y-4">
        {feedback}
        {ready && (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Faturamento", money(total.revenue), "OS concluídas e receitas extras do período."],
                ["Recebido", money(cash), "Pagamentos de OS recebidos no período."],
                ["A receber", money(balance), "Saldo das OS do período, inclusive entregues."],
                ["Resultado estimado", money(total.result), "Receitas menos custos conhecidos."],
              ].map(([label, value, description]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]"
                >
                  <dt className="text-sm font-medium text-slate-600">{label}</dt>
                  <dd className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
                    {value}
                  </dd>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{description}</p>
                </div>
              ))}
            </dl>
            <p className="text-xs leading-relaxed text-slate-500">
              Faturamento usa a conclusão da OS; recebido usa a data do pagamento; a receber usa a
              entrada ou conclusão da OS. O filtro Carro/Moto não altera receitas extras.
            </p>
          </>
        )}
      </section>
    );
  if (view === "receivables")
    return (
      <section aria-labelledby="receivables-title" className="space-y-5">
        {feedback}
        {ready && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h2 id="receivables-title" className="text-xl font-semibold tracking-tight text-slate-950">
                  A receber
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  OS com saldo em aberto, inclusive veículos já entregues.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Total em aberto</p>
                <p className="text-2xl font-semibold text-slate-950 tabular-nums">{money(balance)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {balances.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <h3 className="font-semibold text-slate-950">OS-{item.number}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Total {money(item.total)} · Recebido {money(item.paid)}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs text-slate-500">Em aberto</p>
                    <p className="font-semibold text-amber-800 tabular-nums">{money(item.balance)}</p>
                  </div>
                </article>
              ))}
              {!balances.length && (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
                  Nenhuma OS com saldo em aberto neste período.
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500">
              O período considera a conclusão ou a entrada da OS; o filtro Carro/Moto continua aplicado.
            </p>
          </>
        )}
      </section>
    );
  return (
    <section aria-labelledby="extra-revenues-title" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 id="extra-revenues-title" className="text-xl font-semibold tracking-tight text-slate-950">
            Receitas extras
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Registre ganhos que acontecem fora das OS, sem transformar a rotina em contabilidade.
          </p>
        </div>
        {write && (
          <Button className="gap-2" onClick={() => setShowEntry((open) => !open)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {showEntry ? "Fechar cadastro" : "Adicionar receita"}
          </Button>
        )}
      </div>
      {feedback}
      {ready && (
        <>
          <div className="hidden">
            <p>
              Recebido das OS no período: <strong>{money(cash)}</strong>
            </p>
            <p>
              Saldo das OS do período:{" "}
              <strong>{money(balances.reduce((n, r) => n + Number(r.balance), 0))}</strong>
            </p>
          </div>
          <p className="hidden text-xs text-muted-foreground">
            Recebimentos usam a data do pagamento. Contas a receber usam conclusão ou entrada da OS;
            incluem veículos entregues com dívida.
          </p>
          <details className="hidden">
            <summary className="cursor-pointer text-sm font-medium">
              Contas a receber ({balances.length})
            </summary>
            <ul className="mt-2 space-y-2 text-sm">
              {balances.map((r) => (
                <li key={r.id}>
                  OS-{r.number} · Total {money(r.total)} · Recebido {money(r.paid)} · Em aberto{" "}
                  {money(r.balance)}
                </li>
              ))}
            </ul>
          </details>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Receitas no período", money(extra.revenue)],
              ["Custos informados", money(extra.cost)],
              ["Resultado", money(extra.result)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/80">
                <p className="text-xs text-slate-500">{label}</p>
                <strong className="mt-1 block text-slate-950 tabular-nums">{value}</strong>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-950">Lançamentos</h3>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Categoria do filtro"
              className="h-10 rounded-md border px-2"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory("");
              }}
            >
              <option value="">Todas as categorias</option>
              {categories
                .filter((c) => !c.parent_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.active && " (arquivada)"}
                  </option>
                ))}
            </select>
            <select
              aria-label="Subcategoria do filtro"
              className="h-10 rounded-md border px-2"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
            >
              <option value="">Todas as subcategorias</option>
              {categories
                .filter((c) => c.parent_id && (!category || c.parent_id === category))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          </div>
          <div className="hidden overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr>
                  <th className="text-left">Origem</th>
                  <th>Faturamento</th>
                  <th>Custo</th>
                  <th>Resultado bruto</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Operação das OS", os],
                  ["Receitas extras", extra],
                  ["Consolidado", total],
                ].map(([label, data]) => {
                  const d = data as typeof total;
                  return (
                    <tr key={String(label)} className="border-t">
                      <td className="py-3">{String(label)}</td>
                      <td className="text-right">{money(d.revenue)}</td>
                      <td className="text-right">{money(d.cost)}</td>
                      <td className="text-right">{money(d.result)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Receitas extras usam a data informada no lançamento. O resultado considera o custo
            opcional e não representa lucro líquido contábil.
          </p>
          <details open>
            <summary className="sr-only">
              Lançamentos ({extra.rows.length})
            </summary>
            <ul className="mt-2 space-y-2 text-sm">
              {extra.rows.map((e) => (
                <li
                  key={e.id}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div>
                    <strong className="text-slate-950">{e.description}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {e.date.split("-").reverse().join("/")} ·{" "}
                      {categories.find((c) => c.id === e.category_id)?.name ?? "Sem categoria"}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <strong className="tabular-nums">{money(e.revenue)}</strong>
                    <p className="text-xs text-slate-500">
                      Resultado {money(e.revenue - e.cost)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {!extra.rows.length && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
                Nenhuma receita extra neste período.
              </p>
            )}
          </details>
          {write && showEntry && (
            <fieldset disabled={busy}>
              <form
                aria-label="Nova receita extra"
                className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm shadow-slate-950/[0.03] sm:p-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const saved = await extraRevenueApi.add({
                      id: entryId.current,
                      date,
                      categoryId: entryCategory,
                      subcategoryId: entrySub,
                      description,
                      revenue: Number(revenue),
                      cost: Number(cost || 0),
                    });
                    setEntries((list) => [saved, ...list.filter((i) => i.id !== saved.id)]);
                    entryId.current = crypto.randomUUID();
                    setEntryType("");
                    setEntryCategory("");
                    setEntrySub("");
                    setDescription("");
                    setRevenue("");
                    setCost("");
                    setShowAdvanced(false);
                    setShowEntry(false);
                  });
                }}
              >
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Nova receita extra
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Escolha o tipo e informe o valor recebido.
                  </p>
                </div>

                <fieldset className="mt-5">
                  <legend className="text-sm font-medium text-slate-800">Tipo de receita</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {revenueTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        data-revenue-type={type.id}
                        aria-pressed={entryType === type.id}
                        className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 ${
                          entryType === type.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/30 hover:bg-white"
                        }`}
                        onClick={() => {
                          const match = categoryForType(categories, type);
                          setEntryType(type.id);
                          setDescription(type.id === "other" ? "" : type.label);
                          setEntryCategory(match.categoryId);
                          setEntrySub(match.subcategoryId);
                          setShowAdvanced(!match.categoryId);
                        }}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                    Descrição
                    <Input
                      aria-label="Descrição"
                      required
                      maxLength={500}
                      placeholder={entryType === "other" ? "Ex.: venda avulsa" : "Descreva esta entrada"}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Valor recebido
                    <Input
                      aria-label="Valor recebido"
                      required
                      type="number"
                      min="0.01"
                      max="100000000"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                      className="mt-1 text-lg tabular-nums"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Custo <span className="font-normal text-slate-400">(opcional)</span>
                    <Input
                      aria-label="Custo opcional"
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="mt-1 tabular-nums"
                    />
                  </label>
                </div>

                <details
                  className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 px-4"
                  open={showAdvanced}
                  onToggle={(event) => setShowAdvanced(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer py-3 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
                    Opções avançadas
                  </summary>
                  <div className="grid gap-4 border-t border-slate-200 py-4 sm:grid-cols-3">
                    <label className="text-sm text-slate-700">
                      Data
                      <Input
                        required
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="mt-1 bg-white"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      Categoria
                      <select
                        aria-label="Categoria da receita"
                        required
                        className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3"
                        value={entryCategory}
                        onChange={(e) => {
                          setEntryCategory(e.target.value);
                          setEntrySub("");
                        }}
                      >
                        <option value="">Selecione</option>
                        {categories
                          .filter((item) => !item.parent_id && item.active)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      Subcategoria
                      <select
                        aria-label="Subcategoria da receita"
                        className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3"
                        value={entrySub}
                        onChange={(e) => setEntrySub(e.target.value)}
                      >
                        <option value="">Sem subcategoria</option>
                        {categories
                          .filter(
                            (item) => item.parent_id === entryCategory && item.active,
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  {entryType && !entryCategory && (
                    <p className="pb-4 text-xs text-amber-700">
                      Escolha uma categoria para concluir este lançamento.
                    </p>
                  )}
                </details>

                <div className="mt-5 flex justify-end">
                  <Button disabled={busy || !entryType || !entryCategory} className="min-h-11 px-6">
                    {busy ? "Salvando…" : "Salvar receita"}
                  </Button>
                </div>
              </form>
            </fieldset>
          )}

          {write && (
            <details className="border-t border-slate-200 pt-3">
              <summary className="cursor-pointer py-2 text-sm font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
                Gerenciar categorias
              </summary>
              <p className="mb-4 text-xs text-slate-500">
                Configuração administrativa para organizar os lançamentos.
              </p>
              <fieldset disabled={busy}>
                <form
                  className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const saved = await extraRevenueApi.category(
                        edit || categoryId.current,
                        name,
                        parent || null,
                        active,
                      );
                      setCategories((list) => [...list.filter((c) => c.id !== saved.id), saved]);
                      categoryId.current = crypto.randomUUID();
                      setEdit(saved.id);
                    });
                  }}
                >
                  <label className="text-sm">
                    Categoria/subcategoria
                    <select
                      className="h-10 w-full rounded-md border px-2"
                      value={edit}
                      onChange={(e) => {
                        const c = categories.find((c) => c.id === e.target.value);
                        setEdit(c?.id ?? "");
                        setName(c?.name ?? "");
                        setParent(c?.parent_id ?? "");
                        setActive(c?.active ?? true);
                      }}
                    >
                      <option value="">Criar nova</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parent_id ? "↳ " : ""}
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Nome
                    <Input
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Categoria principal (para subcategoria)
                    <select
                      disabled={Boolean(edit)}
                      className="h-10 w-full rounded-md border px-2"
                      value={parent}
                      onChange={(e) => setParent(e.target.value)}
                    >
                      <option value="">É categoria principal</option>
                      {categories
                        .filter((c) => !c.parent_id && c.active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    Ativa (desmarcar para arquivar)
                  </label>
                  <Button disabled={busy}>{busy ? "Salvando…" : "Salvar categoria"}</Button>
                </form>
              </fieldset>
            </details>
          )}
        </>
      )}
    </section>
  );
}

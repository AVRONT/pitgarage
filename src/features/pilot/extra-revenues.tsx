import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
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
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <Button variant="link" onClick={() => setRevision((value) => value + 1)}>
            Tentar novamente
          </Button>
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {!ready && !error && <p role="status">Carregando informações financeiras.</p>}
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <Button variant="link" onClick={() => setRevision((v) => v + 1)}>
            Tentar novamente
          </Button>
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {!ready && !error && <p role="status">Carregando…</p>}
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
          {write && (
            <details open={showEntry}>
              <summary className="sr-only">
                Adicionar receita
              </summary>
              <fieldset disabled={busy}>
                <form
                  className="mt-4 grid gap-3 rounded-xl border border-primary/20 bg-primary/[0.025] p-4 sm:grid-cols-2"
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
                      setDescription("");
                      setRevenue("");
                      setCost("");
                      setShowEntry(false);
                    });
                  }}
                >
                  <div className="sm:col-span-2">
                    <h3 className="font-semibold text-slate-950">Adicionar receita</h3>
                    <p className="mt-1 text-xs text-slate-500">Escolha um atalho ou descreva o ganho.</p>
                    <div className="mt-3 flex flex-wrap gap-2" aria-label="Atalhos de receitas comuns">
                      {["Ferro velho", "Venda de óleo", "Venda de peças", "Resgate", "Outros ganhos"].map(
                        (label) => (
                          <button
                            key={label}
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                            onClick={() => {
                              setDescription(label);
                              const match = categories.find(
                                (item) =>
                                  item.active &&
                                  item.name.trim().toLocaleLowerCase("pt-BR") ===
                                    label.toLocaleLowerCase("pt-BR"),
                              );
                              if (match) setEntryCategory(match.id);
                            }}
                          >
                            {label}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <label className="text-sm">
                    Data
                    <Input
                      required
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Descrição
                    <Input
                      required
                      maxLength={500}
                      placeholder="Ex.: venda de óleo usado"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Categoria
                    <select
                      required
                      className="h-10 w-full rounded-md border px-2"
                      value={entryCategory}
                      onChange={(e) => {
                        setEntryCategory(e.target.value);
                        setEntrySub("");
                      }}
                    >
                      <option value="">Selecione</option>
                      {categories
                        .filter((c) => !c.parent_id && c.active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Subcategoria
                    <select
                      className="h-10 w-full rounded-md border px-2"
                      value={entrySub}
                      onChange={(e) => setEntrySub(e.target.value)}
                    >
                      <option value="">Sem subcategoria</option>
                      {categories
                        .filter((c) => c.parent_id === entryCategory && c.active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Valor faturado/recebido
                    <Input
                      required
                      type="number"
                      min="0.01"
                      max="100000000"
                      step="0.01"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Custo (opcional)
                    <Input
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </label>
                  <Button disabled={busy}>{busy ? "Salvando…" : "Salvar receita"}</Button>
                </form>
                <details className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2">
                  <summary className="cursor-pointer py-2 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
                    Gerenciar categorias
                  </summary>
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
                </details>
              </fieldset>
            </details>
          )}
        </>
      )}
    </section>
  );
}

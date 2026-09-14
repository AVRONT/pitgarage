import { useEffect, useRef, useState } from "react";
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
  start,
  end,
  kind,
  os,
}: {
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
          setError(
            "Não foi possível carregar recebimentos e receitas extras. Confira se as migrations locais foram aplicadas.",
          );
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
  return (
    <section className="space-y-5 rounded-lg border bg-white p-5">
      <h2 className="text-lg font-semibold">Recebimentos e receitas extras</h2>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <p>
              Recebido das OS no período: <strong>{money(cash)}</strong>
            </p>
            <p>
              Saldo das OS do período:{" "}
              <strong>{money(balances.reduce((n, r) => n + Number(r.balance), 0))}</strong>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Recebimentos usam a data do pagamento. Contas a receber usam conclusão ou entrada da OS;
            incluem veículos entregues com dívida.
          </p>
          <details>
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
          <h3 className="font-semibold">Receitas extras</h3>
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
          <div className="overflow-x-auto">
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
            Receitas extras representam entradas recebidas na data informada. Não é lucro líquido. O
            filtro Carro/Moto aplica-se somente às OS; extras usam período e categoria.
          </p>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Lançamentos ({extra.rows.length})
            </summary>
            <ul className="mt-2 space-y-2 text-sm">
              {extra.rows.map((e) => (
                <li key={e.id}>
                  {e.date} · {categories.find((c) => c.id === e.category_id)?.name} ·{" "}
                  {e.description} · Faturamento {money(e.revenue)} · Custo {money(e.cost)} ·
                  Resultado {money(e.revenue - e.cost)}
                </li>
              ))}
            </ul>
          </details>
          {write && (
            <details>
              <summary className="cursor-pointer font-medium">
                Registrar receita / gerenciar categorias
              </summary>
              <fieldset disabled={busy}>
                <form
                  className="mt-4 grid gap-3 sm:grid-cols-2"
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
                    });
                  }}
                >
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
                  <Button disabled={busy}>{busy ? "Salvando…" : "Registrar receita"}</Button>
                </form>
                <form
                  className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2"
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

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { money, warrantyDays, type Customer, type Vehicle } from "./pilot-data";
import type { BudgetMutation } from "./financial-model";
import { financialApi } from "./financial-api";
import { AddBudgetItemDialog } from "./add-budget-item-dialog";
import { RemoveBudgetItem } from "./remove-budget-item";
import { WorkshopIdentity } from "./workshop-document-header";
import type { Workshop } from "./workshop-data";
import {
  quoteLabel,
  quoteTotal,
  quotesApi,
  type Quote,
  type QuoteContactMatch,
  type QuoteStatus,
} from "./quotes-api";

const editableStatuses: QuoteStatus[] = ["Rascunho", "Enviado", "Aprovado", "Recusado", "Expirado"];

export function QuotesScreen({
  customers,
  vehicles,
  workshop,
  onConverted,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
  workshop: Workshop;
  onConverted: (orderId: string) => void;
}) {
  const { accessLevel, isLocalBypass } = useAuth();
  const internal =
    isLocalBypass || ["owner", "admin", "staff"].includes(accessLevel ?? "");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [financialAllowed, setFinancialAllowed] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [document, setDocument] = useState(false);
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const reload = async () => {
    setLoading(true);
    try {
      setQuotes(await quotesApi.list());
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!internal) return;
    void reload();
    financialApi
      .access()
      .then(setFinancialAllowed)
      .catch(() => setFinancialAllowed(false))
      .finally(() => setCheckingPermission(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internal]);

  /** Cliente cadastrado ou contato avulso guardado no próprio orçamento. */
  const partyName = (quote: Quote) =>
    quote.customerId
      ? (customers.find((c) => c.id === quote.customerId)?.name ?? "Cliente")
      : (quote.contactName ?? "Contato");
  const vehicleLabel = (id: string | null) => {
    const vehicle = vehicles.find((v) => v.id === id);
    return vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : "Sem veículo";
  };
  const open = useMemo(() => quotes.find((quote) => quote.id === openId) ?? null, [quotes, openId]);

  const apply = async (run: () => Promise<Quote>, message: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await run();
      setQuotes((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(message);
    } catch (failure) {
      setError(
        `${failure instanceof Error ? failure.message : "Não foi possível concluir."} Recarregue a lista antes de tentar novamente.`,
      );
      throw failure;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (!internal)
    return <p className="text-sm text-muted-foreground">Área restrita à equipe da oficina.</p>;

  const saveItem = async (mutation: BudgetMutation) => {
    if (!open) return;
    await apply(() => quotesApi.mutateItem(open, mutation), "Orçamento atualizado.");
  };

  return (
    <section aria-label="Orçamentos avulsos">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">
            Pré-orçamentos com numeração própria (ORC). Não entram no Financeiro nem contam como OS
            ativa até serem convertidos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo orçamento
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mb-4 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Número</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Veículo</th>
              <th className="p-3">Data</th>
              <th className="p-3">Total</th>
              <th className="p-3">Situação</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-4 text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && quotes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-muted-foreground">
                  Nenhum orçamento avulso criado ainda.
                </td>
              </tr>
            )}
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-t">
                <td className="p-3 font-medium">{quoteLabel(quote)}</td>
                <td className="p-3">{partyName(quote)}</td>
                <td className="p-3">{vehicleLabel(quote.vehicleId)}</td>
                <td className="p-3">{new Date(quote.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="p-3">{money(quoteTotal(quote))}</td>
                <td className="p-3">{quote.status}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(quote.id)}>
                    Abrir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <NewQuoteDialog
          customers={customers}
          vehicles={vehicles}
          onClose={() => setCreating(false)}
          onCreated={(quote) => {
            setQuotes((list) => [quote, ...list]);
            setCreating(false);
            setOpenId(quote.id);
            setNotice(`${quoteLabel(quote)} criado.`);
          }}
        />
      )}

      {open && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value && !busy) {
              setOpenId(null);
              setDocument(false);
            }
          }}
        >
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {quoteLabel(open)} · {partyName(open)}
              </DialogTitle>
              <DialogDescription>
                {vehicleLabel(open.vehicleId)} · situação: {open.status} · garantia de{" "}
                {open.warrantyDays} dias
              </DialogDescription>
            </DialogHeader>

            {open.description && <p className="text-sm">{open.description}</p>}

            <div className="space-y-2">
              {open.items.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum item lançado.</p>
              )}
              {open.items.map((item) => (
                <div key={item.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{item.name}</span>
                    <span>{money(item.price)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.type}
                    {item.quantity ? ` · ${item.quantity} un.` : ""}
                  </p>
                  <RemoveBudgetItem
                    item={item}
                    save={saveItem}
                    {...(open.status === "Convertido"
                      ? { blocked: "Orçamento já convertido em OS: somente leitura." }
                      : {})}
                  />
                </div>
              ))}
              <p className="text-right text-sm font-semibold">Total: {money(quoteTotal(open))}</p>
            </div>

            <DialogFooter className="flex-wrap gap-2">
              {open.status !== "Convertido" && (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => setAddingItem(true)}>
                    Adicionar item
                  </Button>
                  <select
                    aria-label="Situação do orçamento"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={open.status}
                    disabled={busy}
                    onChange={(event) =>
                      void apply(
                        () => quotesApi.setStatus(open, event.target.value as QuoteStatus),
                        "Situação atualizada.",
                      ).catch(() => {})
                    }
                  >
                    {editableStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <Button
                    disabled={busy || open.items.length === 0}
                    onClick={async () => {
                      if (lock.current) return;
                      if (!open.customerId) {
                        setError("");
                        setLinking(true);
                        return;
                      }
                      const vehicleId =
                        open.vehicleId ??
                        vehicles.find((v) => v.customerId === open.customerId)?.id ??
                        null;
                      if (!vehicleId) {
                        setError(
                          "Cadastre um veículo para este cliente antes de converter o orçamento em OS.",
                        );
                        return;
                      }
                      lock.current = true;
                      setBusy(true);
                      setError("");
                      try {
                        const order = await quotesApi.convert(open, vehicleId, null);
                        await reload();
                        setOpenId(null);
                        onConverted(order.id);
                      } catch (failure) {
                        setError(
                          `${failure instanceof Error ? failure.message : "Não foi possível converter."} Recarregue a lista antes de tentar novamente.`,
                        );
                      } finally {
                        lock.current = false;
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Processando…" : "Converter em OS"}
                  </Button>
                </>
              )}
              <Button variant="ghost" disabled={busy} onClick={() => setDocument((value) => !value)}>
                <FileText className="mr-2 h-4 w-4" />
                {document ? "Ocultar documento" : "Ver documento"}
              </Button>
            </DialogFooter>

            {document && (
              <article className="border bg-white p-5 text-slate-900" aria-label="Documento do orçamento">
                <WorkshopIdentity workshop={workshop} />
                <div className="mt-4 flex items-baseline justify-between">
                  <h3 className="text-lg font-bold">Orçamento</h3>
                  <span className="text-sm font-semibold text-orange-800">
                    #{quoteLabel(open)}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Cliente</dt>
                    <dd>{partyName(open)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Contato</dt>
                    <dd>
                      {open.customerId
                        ? (customers.find((c) => c.id === open.customerId)?.phone ?? "—")
                        : [open.contactPhone, open.contactEmail].filter(Boolean).join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Veículo</dt>
                    <dd>{vehicleLabel(open.vehicleId)}</dd>
                  </div>
                </dl>
                <ul className="mt-4 space-y-1 text-sm">
                  {open.items.map((item) => (
                    <li key={item.id} className="flex justify-between border-b py-1">
                      <span>
                        {item.name}
                        {item.quantity ? ` (${item.quantity})` : ""}
                      </span>
                      <span>{money(item.price)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-right font-semibold">Total: {money(quoteTotal(open))}</p>
                {open.notes && <p className="mt-3 text-sm">{open.notes}</p>}
                <p className="mt-3 text-xs text-slate-600">
                  Garantia de {open.warrantyDays} dias após a conclusão do serviço.
                </p>
              </article>
            )}
          </DialogContent>
        </Dialog>
      )}

      {linking && open && !open.customerId && (
        <LinkContactDialog
          quote={open}
          onClose={() => setLinking(false)}
          onLinked={(updated) => {
            setQuotes((list) => list.map((item) => (item.id === updated.id ? updated : item)));
            setLinking(false);
            setNotice(
              "Contato vinculado a um cliente. Confirme o veículo e converta o orçamento em OS.",
            );
          }}
        />
      )}

      {addingItem && open && (
        <AddBudgetItemDialog
          onClose={() => setAddingItem(false)}
          save={saveItem}
          financialAllowed={financialAllowed}
          checkingPermission={checkingPermission}
        />
      )}
    </section>
  );
}

function NewQuoteDialog({
  customers,
  vehicles,
  onClose,
  onCreated,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
  onClose: () => void;
  onCreated: (quote: Quote) => void;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const options = vehicles.filter((vehicle) => vehicle.customerId === customerId);
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !lock.current) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo orçamento</DialogTitle>
          <DialogDescription>
            Orçamento avulso, sem abrir OS. Garantia padrão de {warrantyDays} dias.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Cliente
            <select
              className="mt-1 h-11 w-full rounded-md border bg-background px-3"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setVehicleId("");
              }}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Veículo (opcional)
            <select
              className="mt-1 h-11 w-full rounded-md border bg-background px-3"
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
            >
              <option value="">Sem veículo</option>
              {options.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model} · {vehicle.plate}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Problema / descrição
            <Input
              className="mt-1 h-11"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: revisão de freios"
            />
          </label>
          <label className="block text-sm font-medium">
            Observações comerciais
            <Input
              className="mt-1 h-11"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: validade de 7 dias"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !customerId}
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError("");
              try {
                onCreated(
                  await quotesApi.create({
                    customerId,
                    vehicleId: vehicleId || null,
                    description: description.trim(),
                    notes: notes.trim(),
                  }),
                );
              } catch (failure) {
                setError(
                  failure instanceof Error ? failure.message : "Não foi possível criar o orçamento.",
                );
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? "Criando…" : "Criar orçamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkContactDialog({
  quote,
  onClose,
  onLinked,
}: {
  quote: Quote;
  onClose: () => void;
  onLinked: (quote: Quote) => void;
}) {
  const [matches, setMatches] = useState<QuoteContactMatch[] | null>(null);
  const [chosen, setChosen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    quotesApi
      .matchContact(quote.id)
      .then((list) => setMatches(list ?? []))
      .catch((failure: unknown) => {
        setMatches([]);
        setError(
          failure instanceof Error ? failure.message : "Não foi possível buscar clientes compatíveis.",
        );
      });
  }, [quote.id]);

  const link = async (existing: string | null) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      onLinked(await quotesApi.linkCustomer(quote, existing));
    } catch (failure) {
      setError(
        `${failure instanceof Error ? failure.message : "Não foi possível vincular."} Atualize a lista antes de tentar novamente.`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !lock.current) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular contato a um cliente</DialogTitle>
          <DialogDescription>
            {quote.contactName} · {quote.contactPhone}
            {quote.contactEmail ? ` · ${quote.contactEmail}` : ""}. A OS precisa de um cliente
            cadastrado.
          </DialogDescription>
        </DialogHeader>

        {matches === null && <p className="text-sm text-muted-foreground">Buscando…</p>}

        {matches !== null && matches.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm">
              Já existe cliente compatível. Escolha qual deseja vincular:
            </p>
            {matches.map((match) => (
              <label key={match.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <input
                  type="radio"
                  name="cliente-compativel"
                  className="mt-1"
                  value={match.id}
                  checked={chosen === match.id}
                  onChange={() => setChosen(match.id)}
                />
                <span>
                  <span className="font-medium">{match.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {match.phone}
                    {match.email ? ` · ${match.email}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {matches !== null && matches.length === 0 && (
          <p className="text-sm">
            Nenhum cliente compatível encontrado. O cliente será criado com os dados deste contato.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          {matches !== null && matches.length > 0 && (
            <Button disabled={busy || !chosen} onClick={() => void link(chosen)}>
              {busy ? "Vinculando…" : "Vincular ao cliente escolhido"}
            </Button>
          )}
          {matches !== null && matches.length === 0 && (
            <Button disabled={busy} onClick={() => void link(null)}>
              {busy ? "Criando…" : "Criar cliente com estes dados"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

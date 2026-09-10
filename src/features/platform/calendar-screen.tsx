import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { platformApi, type CalendarEvent } from "./platform-api";

export function CalendarScreen() {
  const [month, setMonth] = useState(new Date()),
    [events, setEvents] = useState<CalendarEvent[]>([]),
    [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [cancelling, setCancelling] = useState(false);
  const inputDateTime = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  };
  const load = useCallback(async () => {
    setError("");
    try {
      setEvents(
        await platformApi.calendar(
          startOfMonth(month).toISOString(),
          addMonths(startOfMonth(month), 1).toISOString(),
        ),
      );
    } catch {
      setError("Não foi possível carregar a agenda.");
    }
  }, [month]);
  useEffect(() => {
    void load();
  }, [load]);
  const days = useMemo(() => {
    const first = startOfMonth(month),
      last = endOfMonth(month),
      result: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++)
      result.push(new Date(first.getFullYear(), first.getMonth(), d));
    return result;
  }, [month]);
  const filtered = events.filter((e) =>
    `${e.title} ${e.notes ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing?.title || !editing.starts_at) return;
    setSaving(true);
    try {
      await platformApi.saveEvent({
        ...editing,
        title: editing.title,
        starts_at: editing.starts_at,
        category: editing.category ?? "other",
      });
      setEditing(null);
      await load();
    } catch {
      setError("Não foi possível salvar o evento.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="page-heading flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Agenda da oficina</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compromissos, entregas e atendimentos organizados pela equipe.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              starts_at: new Date().toISOString().slice(0, 16),
              category: "appointment",
            })
          }
        >
          <Plus />
          Criar evento
        </Button>
      </div>
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-lg border bg-white p-3 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <Button size="icon" variant="outline" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft />
            </Button>
            <strong className="text-base capitalize tracking-tight sm:text-lg">
              {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
            </strong>
            <Button size="icon" variant="outline" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight />
            </Button>
          </div>
          <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground sm:text-xs">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid grid grid-cols-7">
            {days.map((day, i) => (
              <div
                key={i}
                className={`calendar-day min-w-0 p-1.5 text-sm sm:p-2 ${day && format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "calendar-day-today" : ""}`}
              >
                {day && (
                  <>
                    <span
                      className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold ${format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "bg-primary text-white" : "text-slate-700"}`}
                    >
                      {day.getDate()}
                    </span>
                    {events
                      .filter((e) => e.starts_at.slice(0, 10) === format(day, "yyyy-MM-dd"))
                      .slice(0, 2)
                      .map((e) => (
                        <button
                          key={e.id}
                          className="calendar-event mt-1 block w-full truncate rounded-sm px-1.5 py-1 text-left text-[10px] font-medium sm:text-[11px]"
                          onClick={() => setEditing(e)}
                          title={`${e.title} — ${new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                        >
                          <span className="hidden sm:inline">
                            {new Date(e.starts_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {e.title}
                          </span>
                          <span className="sm:hidden">{e.title}</span>
                        </button>
                      ))}
                    {events.filter(
                      (event) => event.starts_at.slice(0, 10) === format(day, "yyyy-MM-dd"),
                    ).length > 2 && (
                      <span className="mt-1 block text-[10px] font-semibold text-primary">
                        +
                        {events.filter(
                          (event) => event.starts_at.slice(0, 10) === format(day, "yyyy-MM-dd"),
                        ).length - 2}{" "}
                        eventos
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="overflow-hidden rounded-lg border bg-white xl:sticky xl:top-24">
          <div className="border-b px-4 py-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" /> Eventos do mês
            </h2>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar evento"
              />
            </div>
          </div>
          <div className="max-h-[32rem] divide-y overflow-auto">
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setEditing(e)}
                className="group flex w-full gap-3 p-4 text-left transition-colors hover:bg-slate-50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                  <Clock3 className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-sm">{e.title}</b>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {new Date(e.starts_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </button>
            ))}
            {!filtered.length && (
              <div className="p-6 text-center">
                <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Nenhum evento encontrado</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crie um evento ou ajuste a busca deste mês.
                </p>
              </div>
            )}
          </div>
          {error && <p className="border-t p-3 text-sm text-red-700">{error}</p>}
        </section>
      </div>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={save}>
            <Input
              required
              maxLength={160}
              placeholder="Título"
              value={editing?.title ?? ""}
              onChange={(e) => setEditing((v) => ({ ...v, title: e.target.value }))}
            />
            <Input
              required
              type="datetime-local"
              value={inputDateTime(editing?.starts_at)}
              onChange={(e) => {
                const value = e.target.value;
                setEditing((v) => ({
                  ...v,
                  starts_at: value ? new Date(value).toISOString() : "",
                }));
              }}
            />
            <Textarea
              placeholder="Observações"
              value={editing?.notes ?? ""}
              onChange={(e) => setEditing((v) => ({ ...v, notes: e.target.value }))}
            />
            <div className="flex justify-between">
              {editing?.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving || cancelling}
                  onClick={() => {
                    setCancelling(true);
                    setError("");
                    void platformApi
                      .cancelEvent(editing.id!)
                      .then(() => {
                        setEditing(null);
                        return load();
                      })
                      .catch(() => setError("Não foi possível cancelar o evento."))
                      .finally(() => setCancelling(false));
                  }}
                >
                  {cancelling ? "Cancelando…" : "Cancelar evento"}
                </Button>
              ) : (
                <span />
              )}
              <Button disabled={saving || cancelling}>{saving ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

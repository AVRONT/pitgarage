import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
    [saving, setSaving] = useState(false);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Compromissos definidos pela equipe.</p>
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
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section className="rounded-lg border bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <Button size="icon" variant="outline" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft />
            </Button>
            <strong className="capitalize">
              {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
            </strong>
            <Button size="icon" variant="outline" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {"DSTQQSS".split("").map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7">
            {days.map((day, i) => (
              <div
                key={i}
                className={`min-h-20 border p-1 text-sm ${day && format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "bg-orange-50 ring-1 ring-orange-400" : ""}`}
              >
                {day && (
                  <>
                    <span>{day.getDate()}</span>
                    {events
                      .filter((e) => e.starts_at.slice(0, 10) === format(day, "yyyy-MM-dd"))
                      .slice(0, 2)
                      .map((e) => (
                        <button
                          key={e.id}
                          className="mt-1 block w-full truncate rounded bg-slate-900 px-1 text-left text-[10px] text-white"
                          onClick={() => setEditing(e)}
                        >
                          {e.title}
                        </button>
                      ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-semibold">Próximos eventos</h2>
          <Input
            className="mt-3"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
          />
          <div className="mt-3 space-y-2">
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setEditing(e)}
                className="block w-full rounded border p-3 text-left"
              >
                <b>{e.title}</b>
                <span className="block text-xs text-muted-foreground">
                  {new Date(e.starts_at).toLocaleString("pt-BR")}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="text-sm text-muted-foreground">Nenhum evento neste mês.</p>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
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
              value={editing?.starts_at?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setEditing((v) => ({ ...v, starts_at: new Date(e.target.value).toISOString() }))
              }
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
                  onClick={() =>
                    void platformApi.cancelEvent(editing.id!).then(() => {
                      setEditing(null);
                      return load();
                    })
                  }
                >
                  Cancelar evento
                </Button>
              ) : (
                <span />
              )}
              <Button disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

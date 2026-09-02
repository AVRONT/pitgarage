import { useState } from "react";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { workshopStorageKey, type Workshop } from "./workshop-data";

export function WorkshopIdentity({ workshop }: { workshop: Workshop }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-orange-700 text-white">
        <Wrench className="h-6 w-6" />
      </span>
      <div className="min-w-0 break-words">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-75">PitGarage</p>
        <h2 className="mt-1 text-xl font-bold">{workshop.name}</h2>
        <div className="mt-2 space-y-1 text-sm opacity-80">
          {workshop.cnpj && <p>CNPJ: {workshop.cnpj}</p>}
          {workshop.phone && <p>Telefone: {workshop.phone}</p>}
          {workshop.address && <p>{workshop.address}</p>}
          {workshop.hours && <p className="whitespace-pre-line">{workshop.hours}</p>}
        </div>
      </div>
    </div>
  );
}

export function WorkshopSettings({
  workshop,
  onSave,
}: {
  workshop: Workshop;
  onSave: (value: Workshop) => void;
}) {
  const [draft, setDraft] = useState(workshop);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const fields: [keyof Workshop, string][] = [
    ["name", "Nome da oficina"],
    ["cnpj", "CNPJ"],
    ["phone", "Telefone"],
    ["address", "Endereço"],
    ["hours", "Horário / observação de atendimento"],
  ];
  return (
    <section className="max-w-3xl">
      <h1 className="text-2xl font-bold">Configurações da oficina</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dados exibidos nos orçamentos e resumos. Salvos somente neste navegador.
      </p>
      <form
        className="mt-6 space-y-5 rounded-lg border bg-white p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const clean = Object.fromEntries(
            Object.entries(draft).map(([key, value]) => [key, value.trim()]),
          ) as Workshop;
          if (!clean.name) {
            setError(true);
            setMessage("Informe o nome da oficina.");
            return;
          }
          try {
            localStorage.setItem(workshopStorageKey, JSON.stringify(clean));
            onSave(clean);
            setDraft(clean);
            setError(false);
            setMessage("Dados da oficina salvos neste navegador.");
          } catch {
            setError(true);
            setMessage(
              "Não foi possível salvar. Seus campos foram mantidos; verifique se o navegador permite salvar dados e tente novamente.",
            );
          }
        }}
      >
        {fields.map(([key, label]) => (
          <div key={key}>
            <label className="mb-2 block text-sm font-medium" htmlFor={`workshop-${key}`}>
              {label}
              {key !== "name" && " (opcional)"}
            </label>
            <Input
              id={`workshop-${key}`}
              value={draft[key]}
              maxLength={key === "hours" || key === "address" ? 300 : 120}
              onChange={(event) => {
                setDraft({ ...draft, [key]: event.target.value });
                setMessage("");
              }}
            />
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          O ícone atual é mantido. Estes dados são demonstrativos, sem validação cadastral ou
          fiscal. Alterações aparecem também ao visualizar OS antigas.
        </p>
        {message && (
          <p
            role={error ? "alert" : "status"}
            className={error ? "text-sm text-red-700" : "text-sm text-emerald-700"}
          >
            {message}
          </p>
        )}
        <Button type="submit">Salvar dados da oficina</Button>
      </form>
    </section>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWorkshopField, type Workshop } from "./workshop-data";
import { saveWorkshop } from "./workshop-api";
import { WorkshopDocumentPreview } from "./workshop-document-preview";

export function WorkshopSettings({
  workshop,
  canEdit,
  onSave,
}: {
  workshop: Workshop;
  canEdit: boolean;
  onSave: (value: Workshop) => void;
}) {
  const [draft, setDraft] = useState(workshop);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = (Object.keys(workshop) as (keyof Workshop)[]).some(
    (key) => draft[key] !== workshop[key],
  );
  const fields: [keyof Workshop, string][] = [
    ["name", "Nome da oficina / nome fantasia"],
    ["legalName", "Razão social"],
    ["cnpj", "CNPJ"],
    ["phone", "Telefone"],
    ["address", "Endereço"],
    ["postalCode", "CEP"],
    ["hours", "Horário / observação de atendimento"],
  ];
  return (
    <section id="oficina" className="scroll-mt-28">
      <h1 className="text-2xl font-bold">Configurações da oficina</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ajuste os dados e confira como aparecem nos documentos. As alterações só valem após salvar.
      </p>
      <div className="mt-6 grid items-start gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          className="min-w-0 space-y-5 rounded-lg border bg-white p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const clean = Object.fromEntries(
              Object.entries(draft).map(([key, value]) => [
                key,
                formatWorkshopField(key as keyof Workshop, value),
              ]),
            ) as Workshop;
            if (!clean.name) {
              setError(true);
              setMessage("Informe o nome da oficina.");
              return;
            }
            try {
              localStorage.setItem(workshopStorageKey, JSON.stringify(createWorkshopRecord(clean)));
              onSave(clean);
              setDraft(clean);
              setError(false);
              setMessage("Configurações salvas");
            } catch {
              setError(true);
              setMessage(
                "Não foi possível salvar. Seus campos foram mantidos; verifique se o navegador permite salvar dados e tente novamente.",
              );
            }
          }}
        >
          <div className="border-b pb-4">
            <h2 className="font-semibold">Dados da oficina</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              O nome identifica a oficina. Os demais campos são opcionais.
            </p>
          </div>
          {fields.map(([key, label]) => (
            <div key={key}>
              <label className="mb-2 block text-sm font-medium" htmlFor={`workshop-${key}`}>
                {label}
              </label>
              <Input
                id={`workshop-${key}`}
                value={draft[key]}
                type={key === "phone" ? "tel" : "text"}
                inputMode={key === "postalCode" ? "numeric" : key === "phone" ? "tel" : "text"}
                aria-required={key === "name"}
                aria-invalid={key === "name" && error && !draft.name.trim()}
                maxLength={key === "hours" || key === "address" ? 300 : 120}
                onChange={(event) => {
                  setDraft({ ...draft, [key]: event.target.value });
                  setMessage("");
                  setError(false);
                }}
                onBlur={() =>
                  setDraft((current) => ({
                    ...current,
                    [key]: formatWorkshopField(key, current[key]),
                  }))
                }
              />
            </div>
          ))}
          <p className="text-xs leading-relaxed text-muted-foreground">
            CNPJ, CEP e telefone recebem apenas formatação visual quando reconhecidos. Não há
            consulta cadastral ou emissão fiscal. Dados salvos somente neste navegador.
          </p>
          <div className="border-t pt-4">
            <p role="status" className="mb-3 min-h-5 text-sm text-muted-foreground">
              {dirty
                ? "Alterações não salvas"
                : message === "Configurações salvas"
                  ? message
                  : "Nenhuma alteração pendente"}
            </p>
            {error && (
              <p role="alert" className="mb-3 text-sm text-red-700">
                {message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Salvar configurações</Button>
              <Button
                type="button"
                variant="outline"
                disabled={!dirty}
                onClick={() => {
                  setDraft(workshop);
                  setMessage("");
                  setError(false);
                }}
              >
                Cancelar alterações
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Sair sem salvar descarta o rascunho. Documentos fechados usam os dados congelados na
              conclusão quando esse registro existe.
            </p>
          </div>
        </form>
        <WorkshopDocumentPreview workshop={draft} />
      </div>
    </section>
  );
}

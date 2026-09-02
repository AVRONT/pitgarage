import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Workshop } from "./workshop-data";
import type { Customer, ServiceOrder, Vehicle } from "./pilot-data";
import { createBackup, parseBackup, type PilotBackup } from "./pilot-storage";

export function PilotBackupSettings({
  customers,
  vehicles,
  orders,
  workshop,
  onImport,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
  orders: ServiceOrder[];
  workshop: Workshop;
  onImport: (backup: PilotBackup) => boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PilotBackup>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      setPending(backup);
      setError(false);
      setMessage("");
    } catch (reason) {
      setPending(undefined);
      setError(true);
      setMessage(reason instanceof Error ? reason.message : "Não foi possível validar o backup.");
    }
  };

  return (
    <section className="mt-7 rounded-lg border bg-white p-5 sm:p-6" aria-labelledby="backup-title">
      <h2 id="backup-title" className="font-semibold">
        Backup dos dados
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Exporte ou restaure clientes, veículos, ordens de serviço e configurações deste navegador.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const backup = createBackup({ customers, vehicles, orders }, workshop);
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `pitgarage-backup-${backup.exportedAt.slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 0);
            setError(false);
            setMessage("Backup exportado.");
          }}
        >
          <Download className="h-4 w-4" /> Exportar backup
        </Button>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Importar backup
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={selectBackup}
        />
      </div>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-3 text-sm ${error ? "text-red-700" : "text-muted-foreground"}`}
        >
          {message}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        A importação valida todo o arquivo e pede confirmação antes de substituir os dados atuais.
      </p>
      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar backup validado?</DialogTitle>
            <DialogDescription>
              Os dados atuais deste navegador serão substituídos pelo conteúdo exportado em{" "}
              {pending
                ? new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(pending.exportedAt))
                : "data não informada"}
              .
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(undefined)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!pending) return;
                const imported = onImport(pending);
                setPending(undefined);
                setError(!imported);
                setMessage(
                  imported
                    ? "Backup importado com sucesso."
                    : "Não foi possível gravar o backup; os dados atuais foram preservados.",
                );
              }}
            >
              Confirmar importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

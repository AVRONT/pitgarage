import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { canRemoveBudgetItem } from "./financial-model";
import type { BudgetItem, ServiceOrder } from "./pilot-data";
import type { SavePart } from "./financial-api";

export function RemoveBudgetItem({
  order,
  item,
  save,
  blocked,
}: {
  order?: ServiceOrder;
  item: BudgetItem;
  save: SavePart;
  /** Motivo já conhecido pelo chamador (orçamento avulso convertido, por exemplo). */
  blocked?: string;
}) {
  const { accessLevel, isLocalBypass } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  if (!isLocalBypass && !["owner", "admin", "staff"].includes(accessLevel ?? "")) return null;
  const allowed = !blocked && (order ? canRemoveBudgetItem(order, item) : true);
  const blocker = allowed
    ? ""
    : blocked
      ? blocked
      : item.executed
        ? "Este item já foi executado e não pode ser removido; ele permanece no histórico."
        : `A OS está em “${order?.status}”. A remoção só é permitida nas etapas Recebido, Em diagnóstico e Aguardando aprovação.`;

  return (
    <>
      <div className="mt-2 flex flex-col items-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={!allowed || busy}
          aria-label={"Remover " + item.name}
          title={allowed ? "Remover item adicionado por engano" : blocker}
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        {blocker && <p className="text-xs text-muted-foreground">{blocker}</p>}
      </div>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!lock.current) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover item do orçamento?</DialogTitle>
            <DialogDescription>
              {item.name} será removido junto com seus dados financeiros associados. Isso não é uma
              recusa do cliente. Os demais itens serão mantidos.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" autoFocus disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !allowed}
              onClick={async () => {
                if (lock.current || !allowed) return;
                lock.current = true;
                setBusy(true);
                setError("");
                try {
                  await save({ removeItem: item.id });
                  setOpen(false);
                } catch (failure) {
                  const detail = failure instanceof Error ? failure.message.trim() : "";
                  setError(
                    `${detail || "Não foi possível confirmar a remoção."} Recarregue a OS para conferir a versão mais recente antes de tentar novamente.`,
                  );
                } finally {

                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              {busy ? "Removendo…" : "Remover item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

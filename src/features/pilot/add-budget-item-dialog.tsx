import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  partAmounts,
  roundMoney,
  suggestedPrice,
  validatePart,
  type PartFinancialInput,
} from "./financial-model";
import type { SavePart } from "./financial-api";
const money = (value: number | null) =>
  value === null
    ? "Não informado"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AddBudgetItemDialog({
  onClose,
  save,
  financialAllowed,
  checkingPermission,
}: {
  onClose: () => void;
  save: SavePart;
  financialAllowed: boolean;
  checkingPermission: boolean;
}) {
  const [type, setType] = useState<"Serviço" | "Peça">("Serviço");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [cost, setCost] = useState("");
  const [markup, setMarkup] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const itemId = useRef("i-" + crypto.randomUUID());
  const form = useRef<HTMLFormElement>(null);
  const internal = type === "Peça" && financialAllowed;
  const input: PartFinancialInput = {
    itemId: itemId.current,
    newItem: { name: name.trim(), type },
    quantity: type === "Peça" ? Number(quantity) : 1,
    unitCost: internal && cost !== "" ? Number(cost) : null,
    markup: internal && markup !== "" ? Number(markup) : null,
    unitPrice: Number(price),
  };
  const valid = price !== "" && !validatePart(input);
  const suggestion = internal ? suggestedPrice(input.unitCost, input.markup) : null;
  const amounts = valid
    ? partAmounts(
        { price: roundMoney(input.unitPrice * input.quantity), quantity: input.quantity },
        input.unitCost,
      )
    : null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar item ao orçamento</DialogTitle>
          <DialogDescription>O item será criado aguardando a decisão do cliente.</DialogDescription>
        </DialogHeader>
        <form
          ref={form}
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current || checkingPermission) return;
            if (!form.current?.reportValidity()) return;
            if (!input.newItem!.name) {
              form.current?.querySelector<HTMLInputElement>('[name="description"]')?.focus();
              setError("Informe a descrição do item.");
              return;
            }
            const issue = validatePart(input);
            if (issue) {
              setError(issue);
              return;
            }
            lock.current = true;
            setBusy(true);
            setError("");
            try {
              await save(input);
              onClose();
            } catch {
              setError(
                "Não foi possível confirmar a gravação. Seus campos foram mantidos. Se a OS mudou, recarregue-a antes de tentar novamente.",
              );
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy || checkingPermission} className="min-w-0 space-y-4">
            <label className="block text-sm font-medium">
              Tipo do item
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="mt-1 h-11 w-full rounded-md border bg-background px-3"
              >
                <option>Serviço</option>
                <option>Peça</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Descrição
              <Input
                name="description"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-11"
                placeholder={
                  type === "Peça"
                    ? "Ex.: Pastilha de freio dianteira"
                    : "Ex.: Diagnóstico eletrônico"
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {type === "Peça" && (
                <label className="text-sm font-medium">
                  Quantidade
                  <Input
                    type="number"
                    required
                    min="1"
                    max="100000"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="mt-1 h-11"
                  />
                </label>
              )}
              <label className="text-sm font-medium">
                {type === "Peça" ? "Venda unitária final (R$)" : "Valor da mão de obra (R$)"}
                <Input
                  type="number"
                  required
                  min="0"
                  max="100000000"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 h-11"
                />
              </label>
            </div>
            {internal && (
              <section
                aria-label="Dados internos da peça"
                className="space-y-3 rounded-md bg-muted/40 p-4"
              >
                <div>
                  <h3 className="text-sm font-semibold">Dados internos da peça</h3>
                  <p className="text-xs text-muted-foreground">
                    Visíveis somente para a equipe com permissão financeira. Não aparecem para o
                    cliente.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Custo unitário (R$)
                    <Input
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      placeholder="Não informado"
                      className="mt-1 h-11"
                    />
                  </label>
                  <label className="text-sm">
                    Acréscimo sobre custo (%)
                    <Input
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      value={markup}
                      onChange={(e) => setMarkup(e.target.value)}
                      placeholder="Não informado"
                      className="mt-1 h-11"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>Preço sugerido: {money(suggestion)}</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={suggestion === null}
                    onClick={() => setPrice(String(suggestion))}
                  >
                    Usar preço sugerido
                  </Button>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <span>
                    Lucro unitário:{" "}
                    {money(
                      valid && input.unitCost !== null
                        ? roundMoney(input.unitPrice - input.unitCost)
                        : null,
                    )}
                  </span>
                  <span>Lucro total: {money(amounts?.profit ?? null)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alterar custo ou acréscimo não substitui o preço final. Acréscimo é calculado
                  sobre o custo, não é margem.
                </p>
              </section>
            )}
            <p className="text-sm">
              Total do item:{" "}
              <strong>{money(valid ? roundMoney(input.quantity * input.unitPrice) : null)}</strong>
            </p>
          </fieldset>
          {checkingPermission && (
            <p role="status" className="text-sm">
              Verificando acesso…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy || checkingPermission}>
              {busy ? "Salvando…" : "Adicionar ao orçamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

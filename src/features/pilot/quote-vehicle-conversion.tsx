import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { quotesApi, type Quote } from "./quotes-api";
import type { Vehicle } from "./pilot-data";

export function QuoteVehicleConversion({
  quote,
  vehicles,
  onClose,
  onConverted,
}: {
  quote: Quote;
  vehicles: Vehicle[];
  onClose: () => void;
  onConverted: (id: string) => void;
}) {
  const [matches, setMatches] = useState<Awaited<ReturnType<typeof quotesApi.matchVehicle>> | null>(
    null,
  );
  const [chosen, setChosen] = useState(quote.vehicleId ?? "");
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState("Carro");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState(quote.vehicleModelText ?? "");
  const [plate, setPlate] = useState(quote.vehiclePlateText ?? "");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("0");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    quotesApi
      .matchVehicle(quote.id)
      .then((rows) => {
        if (active) setMatches(rows);
      })
      .catch(() => {
        if (active) setError("Não foi possível conferir a placa. Feche e tente novamente.");
      });
    return () => {
      active = false;
    };
  }, [quote.id]);
  const conflicts = matches?.some((v) => v.deleted || v.customerId !== quote.customerId);
  const options = quote.vehiclePlateText
    ? (matches?.filter((v) => !v.deleted && v.customerId === quote.customerId) ?? [])
    : vehicles.filter((v) => !v.deletedAt && v.customerId === quote.customerId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Veículo da OS</DialogTitle>
          <DialogDescription>
            Confirme o veículo. O cadastro só será criado junto com a OS; o orçamento original será
            preservado.
          </DialogDescription>
        </DialogHeader>
        {matches === null && !error && <p role="status">Conferindo placa…</p>}
        {conflicts && (
          <p role="alert">
            Esta placa já pertence a outro cliente ou cadastro excluído. Corrija o vínculo antes de
            converter.
          </p>
        )}
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current || matches === null || conflicts) return;
            lock.current = true;
            setBusy(true);
            setError("");
            try {
              const result = await quotesApi.convertWithVehicle(
                quote,
                creating ? null : chosen || null,
                creating
                  ? {
                      kind,
                      brand,
                      model,
                      plate: plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                      year: Number(year),
                      color: "",
                    }
                  : null,
                Number(mileage),
              );
              onConverted(result.id);
            } catch {
              setError(
                "Conversão não confirmada. A placa pode já existir ou o orçamento mudou. Recarregue a lista antes de tentar novamente.",
              );
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy || matches === null || Boolean(conflicts)} className="space-y-3">
            {!creating && (
              <label className="block text-sm">
                Vincular veículo existente
                <select
                  required
                  className="h-10 w-full rounded-md border"
                  value={chosen}
                  onChange={(e) => setChosen(e.target.value)}
                >
                  <option value="">Selecione explicitamente</option>
                  {options.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.model} · {v.plate}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!quote.vehicleId && matches?.length === 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreating(!creating);
                  setChosen("");
                }}
              >
                {creating ? "Escolher existente" : "Criar veículo"}
              </Button>
            )}
            {creating && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Tipo
                  <select
                    className="h-10 w-full rounded-md border"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option>Carro</option>
                    <option>Moto</option>
                  </select>
                </label>
                <label className="text-sm">
                  Marca
                  <Input required value={brand} onChange={(e) => setBrand(e.target.value)} />
                </label>
                <label className="text-sm">
                  Modelo
                  <Input required value={model} onChange={(e) => setModel(e.target.value)} />
                </label>
                <label className="text-sm">
                  Placa
                  <Input
                    required
                    pattern="[A-Za-z0-9]{7}"
                    maxLength={7}
                    readOnly={Boolean(quote.vehiclePlateText)}
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  />
                </label>
                <label className="text-sm">
                  Ano
                  <Input
                    required
                    type="number"
                    min="1900"
                    max="2100"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </label>
              </div>
            )}
            <label className="block text-sm">
              Quilometragem de entrada
              <Input
                required
                type="number"
                min="0"
                max="2000000"
                step="1"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
              />
            </label>
            <Button disabled={!creating && !chosen}>
              {busy ? "Convertendo…" : "Confirmar e criar OS"}
            </Button>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

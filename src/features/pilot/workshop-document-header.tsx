import { Wrench } from "lucide-react";
import { formatWorkshopField, type Workshop } from "./workshop-data";

export function WorkshopIdentity({ workshop }: { workshop: Workshop }) {
  const details = [
    workshop.legalName?.trim(),
    workshop.cnpj.trim() && `CNPJ: ${formatWorkshopField("cnpj", workshop.cnpj)}`,
    workshop.phone.trim() && `Telefone: ${formatWorkshopField("phone", workshop.phone)}`,
    workshop.address.trim(),
    workshop.postalCode?.trim() && `CEP: ${formatWorkshopField("postalCode", workshop.postalCode)}`,
    workshop.hours.trim(),
  ].filter(Boolean);
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className="brand-mark grid h-11 w-11 shrink-0 place-items-center rounded-md bg-orange-700 text-white"
        aria-hidden="true"
      >
        <Wrench className="h-6 w-6" />
      </span>
      <div className="min-w-0 break-words">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-75">PitGarage</p>
        {workshop.name.trim() && <h2 className="mt-1 text-xl font-bold">{workshop.name}</h2>}
        {details.length > 0 && (
          <div className="mt-2 space-y-1 text-sm opacity-80">
            {details.map((detail, index) => (
              <p key={index} className="whitespace-pre-line">
                {detail}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

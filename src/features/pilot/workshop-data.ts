import { normalizePhone } from "./pilot-validation";

export const workshopStorageKey = "pitgarage-workshop-settings-v1";
export const defaultWorkshop = {
  name: "Oficina Pit Stop",
  legalName: "",
  cnpj: "",
  phone: "",
  address: "",
  postalCode: "",
  hours: "Oficina fictícia para demonstração.",
};
export type Workshop = typeof defaultWorkshop;

// Formatting only: incomplete or nonnumeric entries remain editable, without fiscal validation.
export function formatWorkshopField(key: keyof Workshop, value: string): string {
  const clean = value.trim();
  const digits = clean.replace(/\D/g, "");
  if (key === "cnpj" && /^[\d\s./-]+$/.test(clean) && digits.length === 14)
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (key === "postalCode" && /^[\d\s-]+$/.test(clean) && digits.length === 8)
    return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  if (key === "phone" && /^[\d\s()+-]+$/.test(clean)) {
    const phone = normalizePhone(clean);
    if (phone.length === 10 || phone.length === 11)
      return phone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
  }
  return clean;
}

export function readWorkshop(): Workshop {
  try {
    const saved = JSON.parse(localStorage.getItem(workshopStorageKey) ?? "null");
    return Object.fromEntries(
      Object.entries(defaultWorkshop).map(([key, fallback]) => [
        key,
        typeof saved?.[key] === "string" && (key !== "name" || saved[key].trim())
          ? saved[key]
          : fallback,
      ]),
    ) as Workshop;
  } catch {
    return { ...defaultWorkshop };
  }
}

export const workshopStorageKey = "pitgarage-workshop-settings-v1";
export const defaultWorkshop = {
  name: "Oficina Pit Stop",
  cnpj: "",
  phone: "",
  address: "",
  hours: "Oficina fictícia para demonstração.",
};
export type Workshop = typeof defaultWorkshop;

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

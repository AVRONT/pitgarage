import { supabase } from "@/integrations/supabase/client";
import { defaultWorkshop, readWorkshop, type Workshop } from "./workshop-data";

type Row = {
  name: string;
  legal_name: string;
  cnpj: string;
  phone: string;
  address: string;
  postal_code: string;
  hours: string;
  updated_by: string | null;
};

const toWorkshop = (row: Row): Workshop => ({
  name: row.name,
  legalName: row.legal_name,
  cnpj: row.cnpj,
  phone: row.phone,
  address: row.address,
  postalCode: row.postal_code,
  hours: row.hours,
});

const toRow = (value: Workshop) => ({
  name: value.name,
  legal_name: value.legalName,
  cnpj: value.cnpj,
  phone: value.phone,
  address: value.address,
  postal_code: value.postalCode,
  hours: value.hours,
});

const columns = "name,legal_name,cnpj,phone,address,postal_code,hours,updated_by";

/** Canonical workshop identity for every internal device. */
export async function loadWorkshop(): Promise<Workshop> {
  const { data, error } = await supabase
    .from("workshop_settings")
    .select(columns)
    .maybeSingle<Row>();
  if (error) throw error;
  if (!data) return { ...defaultWorkshop };
  const cloud = toWorkshop(data);
  // One-time migration: an untouched central record adopts values still saved in this browser.
  if (!data.updated_by) {
    const local = readWorkshop();
    const differs = (Object.keys(defaultWorkshop) as (keyof Workshop)[]).some(
      (key) => local[key].trim() && local[key] !== cloud[key],
    );
    if (differs) {
      const migrated = await saveWorkshop(local).catch(() => null);
      if (migrated) return migrated;
    }
  }
  return cloud;
}

export async function saveWorkshop(value: Workshop): Promise<Workshop> {
  const { data, error } = await supabase
    .from("workshop_settings")
    .update(toRow(value))
    .eq("id", true)
    .select(columns)
    .maybeSingle<Row>();
  if (error) throw error;
  if (!data) throw new Error("Não foi possível salvar as configurações da oficina.");
  return toWorkshop(data);
}

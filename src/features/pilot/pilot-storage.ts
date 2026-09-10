import type { Customer, ServiceOrder, Vehicle } from "./pilot-data";
import { defaultWorkshop, workshopStorageKey, type Workshop } from "./workshop-data";

export const pilotStorageKey = "pitgarage-pilot-v012";
export const pilotSchemaVersion = 1;
export const backupFormat = "pitgarage-local-backup";
export const backupFormatVersion = 1;

export interface PilotData {
  customers: Customer[];
  vehicles: Vehicle[];
  orders: ServiceOrder[];
}

export interface PilotBackup {
  format: typeof backupFormat;
  formatVersion: typeof backupFormatVersion;
  exportedAt: string;
  data: PilotData;
  workshop: Workshop;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasStrings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === "string");
const isOptionalString = (value: unknown) => value === undefined || typeof value === "string";

const isCustomer = (value: unknown): value is Customer =>
  isRecord(value) &&
  hasStrings(value, ["id", "name", "phone", "email", "since"]) &&
  isOptionalString(value["cpf"]) &&
  isOptionalString(value["deletedAt"]);

const isVehicle = (value: unknown): value is Vehicle =>
  isRecord(value) &&
  hasStrings(value, ["id", "customerId", "kind", "brand", "model", "plate", "color"]) &&
  (value["kind"] === "Carro" || value["kind"] === "Moto") &&
  typeof value["year"] === "number" &&
  Number.isFinite(value["year"]) &&
  typeof value["mileage"] === "number" &&
  Number.isFinite(value["mileage"]) &&
  isOptionalString(value["deletedAt"]);

const approvalStatuses = ["Aprovado", "Recusado", "Aguardando aprovação"];
const orderStatuses = [
  "Recebido",
  "Em diagnóstico",
  "Aguardando aprovação",
  "Aguardando peça",
  "Em manutenção",
  "Serviço concluído",
  "Aguardando retirada",
  "Entregue",
];

const isBudgetItem = (value: unknown) =>
  isRecord(value) &&
  hasStrings(value, ["id", "type", "name", "approval"]) &&
  (value["type"] === "Serviço" || value["type"] === "Peça") &&
  approvalStatuses.includes(value["approval"] as string) &&
  typeof value["price"] === "number" &&
  Number.isFinite(value["price"]) &&
  (value["cost"] === undefined ||
    (typeof value["cost"] === "number" && Number.isFinite(value["cost"]))) &&
  (value["executed"] === undefined || typeof value["executed"] === "boolean") &&
  (value["additional"] === undefined || typeof value["additional"] === "boolean");

const isEvidence = (value: unknown) =>
  isRecord(value) &&
  hasStrings(value, ["id", "kind", "name", "caption"]) &&
  (value["kind"] === "Foto" || value["kind"] === "Vídeo") &&
  (value["path"] === undefined ||
    (typeof value["path"] === "string" &&
      /^[0-9a-f-]{36}\/e-[0-9a-f-]{36}\.[a-z0-9]{1,5}$/i.test(value["path"]))) &&
  isOptionalString(value["mimeType"]) &&
  (value["size"] === undefined ||
    (typeof value["size"] === "number" && Number.isFinite(value["size"]) && value["size"] > 0));

const isWorkshop = (value: unknown): value is Workshop =>
  isRecord(value) && hasStrings(value, Object.keys(defaultWorkshop));

const isPayment = (value: unknown) =>
  isRecord(value) &&
  typeof value["amount"] === "number" &&
  Number.isFinite(value["amount"]) &&
  (value["method"] === "PIX" || value["method"] === "Cartão") &&
  (value["status"] === "Pendente" || value["status"] === "Pago") &&
  typeof value["date"] === "string";

const isActivity = (value: unknown) =>
  isRecord(value) && hasStrings(value, ["id", "type", "description", "at"]);

const isStatusHistory = (value: unknown) =>
  isRecord(value) &&
  hasStrings(value, ["id", "from", "to", "at"]) &&
  orderStatuses.includes(value["from"] as string) &&
  orderStatuses.includes(value["to"] as string);

const isOrder = (value: unknown): value is ServiceOrder =>
  isRecord(value) &&
  hasStrings(value, [
    "id",
    "customerId",
    "vehicleId",
    "status",
    "openedAt",
    "complaint",
    "diagnosis",
    "findings",
    "notes",
  ]) &&
  orderStatuses.includes(value["status"] as string) &&
  typeof value["entryMileage"] === "number" &&
  Number.isFinite(value["entryMileage"]) &&
  Array.isArray(value["team"]) &&
  value["team"].every((item) => typeof item === "string") &&
  Array.isArray(value["budget"]) &&
  value["budget"].every(isBudgetItem) &&
  Array.isArray(value["evidence"]) &&
  value["evidence"].every(isEvidence) &&
  isOptionalString(value["completedAt"]) &&
  isOptionalString(value["updatedAt"]) &&
  (value["payment"] === undefined || isPayment(value["payment"])) &&
  (value["workshopSnapshot"] === undefined || isWorkshop(value["workshopSnapshot"])) &&
  (value["activities"] === undefined ||
    (Array.isArray(value["activities"]) && value["activities"].every(isActivity))) &&
  (value["statusHistory"] === undefined ||
    (Array.isArray(value["statusHistory"]) && value["statusHistory"].every(isStatusHistory)));

export function createPilotRecord(data: PilotData) {
  return { schemaVersion: pilotSchemaVersion, ...data };
}

export function createWorkshopRecord(workshop: Workshop) {
  return { schemaVersion: pilotSchemaVersion, ...workshop };
}

export function createBackup(
  data: PilotData,
  workshop: Workshop,
  exportedAt = new Date().toISOString(),
): PilotBackup {
  return {
    format: backupFormat,
    formatVersion: backupFormatVersion,
    exportedAt,
    data,
    workshop,
  };
}

export function parseBackup(source: string): PilotBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("O arquivo não contém um JSON válido.");
  }
  if (!isRecord(parsed) || parsed["format"] !== backupFormat)
    throw new Error("Este arquivo não é um backup do PitGarage.");
  if (parsed["formatVersion"] !== backupFormatVersion)
    throw new Error("A versão deste backup não é compatível com o piloto atual.");
  if (typeof parsed["exportedAt"] !== "string" || Number.isNaN(Date.parse(parsed["exportedAt"])))
    throw new Error("O backup não possui uma data de exportação válida.");
  if (!isRecord(parsed["data"])) throw new Error("O backup não contém os dados operacionais.");
  const { customers, vehicles, orders } = parsed["data"];
  if (!Array.isArray(customers) || !customers.every(isCustomer))
    throw new Error("A lista de clientes do backup é inválida.");
  if (!Array.isArray(vehicles) || !vehicles.every(isVehicle))
    throw new Error("A lista de veículos do backup é inválida.");
  if (!Array.isArray(orders) || !orders.every(isOrder))
    throw new Error("A lista de ordens de serviço do backup é inválida.");
  const customerIds = new Set(customers.map((customer) => customer.id));
  const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  if (
    customerIds.size !== customers.length ||
    vehicleIds.size !== vehicles.length ||
    new Set(orders.map((order) => order.id)).size !== orders.length
  )
    throw new Error("O backup contém identificadores duplicados.");
  if (
    vehicles.some((vehicle) => !customerIds.has(vehicle.customerId)) ||
    orders.some((order) => !customerIds.has(order.customerId) || !vehicleIds.has(order.vehicleId))
  )
    throw new Error("O backup contém vínculos inválidos entre clientes, veículos e ordens.");
  if (!isWorkshop(parsed["workshop"]))
    throw new Error("Os dados da oficina do backup são inválidos.");
  return parsed as unknown as PilotBackup;
}

export function persistImportedBackup(backup: PilotBackup) {
  const previousPilot = localStorage.getItem(pilotStorageKey);
  const previousWorkshop = localStorage.getItem(workshopStorageKey);
  try {
    localStorage.setItem(pilotStorageKey, JSON.stringify(createPilotRecord(backup.data)));
    localStorage.setItem(workshopStorageKey, JSON.stringify(createWorkshopRecord(backup.workshop)));
  } catch (error) {
    if (previousPilot === null) localStorage.removeItem(pilotStorageKey);
    else localStorage.setItem(pilotStorageKey, previousPilot);
    if (previousWorkshop === null) localStorage.removeItem(workshopStorageKey);
    else localStorage.setItem(workshopStorageKey, previousWorkshop);
    throw error;
  }
}

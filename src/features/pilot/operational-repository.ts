import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import type { Customer, ServiceOrder, Vehicle } from "./pilot-data";

export interface OperationalData {
  customers: Customer[];
  vehicles: Vehicle[];
  orders: ServiceOrder[];
}

export interface NewOrderBundle {
  customer?: Customer | undefined;
  vehicle?: Vehicle | undefined;
  order: ServiceOrder;
}

export interface OperationalRepository {
  reloadOrder(order: ServiceOrder): Promise<ServiceOrder>;
  load(): Promise<OperationalData>;
  createOrder(bundle: NewOrderBundle): Promise<OperationalData>;
  saveOrder(order: ServiceOrder): Promise<void>;
  deleteCustomer(customerId: string, deletedAt: string): Promise<void>;
  deleteVehicle(vehicleId: string, deletedAt: string): Promise<void>;
  reset(): Promise<OperationalData>;
}

const emptyData = (): OperationalData => ({ customers: [], vehicles: [], orders: [] });
const devStorageKey = "pitgarage-dev-operational-v1";

const asJson = (value: unknown) => value as Json;
const asArray = <T>(value: Json | null) => (Array.isArray(value) ? (value as T[]) : []);

function mapCustomer(row: {
  id: string;
  auth_user_id: string | null;
  name: string;
  phone: string;
  email: string;
  cpf: string | null;
  since: string;
  deleted_at: string | null;
}): Customer {
  return {
    id: row.id,
    ...(row.auth_user_id ? { authUserId: row.auth_user_id } : {}),
    name: row.name,
    phone: row.phone,
    email: row.email,
    ...(row.cpf ? { cpf: row.cpf } : {}),
    since: row.since,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  };
}

function mapVehicle(row: {
  id: string;
  customer_id: string;
  kind: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  mileage: number;
  color: string;
  deleted_at: string | null;
}): Vehicle {
  return {
    id: row.id,
    customerId: row.customer_id,
    kind: row.kind as Vehicle["kind"],
    brand: row.brand,
    model: row.model,
    year: row.year,
    plate: row.plate,
    mileage: row.mileage,
    color: row.color,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  };
}

function mapOrder(row: {
  id: string;
  order_number: number;
  customer_id: string;
  vehicle_id: string;
  status: string;
  opened_at: string;
  completed_at: string | null;
  entry_mileage: number;
  complaint: string;
  diagnosis: string;
  findings: string;
  notes: string;
  team: Json;
  budget: Json;
  evidence: Json;
  payment: Json | null;
  status_history: Json;
  activities: Json;
  workshop_snapshot: Json | null;
  updated_at: string;
}): ServiceOrder {
  return {
    id: `OS-${row.order_number}`,
    databaseId: row.id,
    customerId: row.customer_id,
    vehicleId: row.vehicle_id,
    status: row.status as ServiceOrder["status"],
    openedAt: row.opened_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    entryMileage: row.entry_mileage,
    complaint: row.complaint,
    diagnosis: row.diagnosis,
    findings: row.findings,
    notes: row.notes,
    team: asArray<string>(row.team),
    budget: asArray<ServiceOrder["budget"][number]>(row.budget),
    evidence: asArray<ServiceOrder["evidence"][number]>(row.evidence),
    ...(row.payment
      ? { payment: row.payment as unknown as NonNullable<ServiceOrder["payment"]> }
      : {}),
    statusHistory: asArray<NonNullable<ServiceOrder["statusHistory"]>[number]>(row.status_history),
    activities: asArray<NonNullable<ServiceOrder["activities"]>[number]>(row.activities),
    ...(row.workshop_snapshot
      ? {
          workshopSnapshot: row.workshop_snapshot as unknown as NonNullable<
            ServiceOrder["workshopSnapshot"]
          >,
        }
      : {}),
    updatedAt: row.updated_at,
  };
}

export class OrderVersionConflict extends Error {
  constructor() {
    super(
      "Esta OS foi alterada por outra pessoa. Recarregue para ver a versão mais recente antes de continuar.",
    );
    this.name = "OrderVersionConflict";
  }
}

class CloudOperationalRepository implements OperationalRepository {
  private orderVersions = new Map<string, string>();

  async reloadOrder(order: ServiceOrder) {
    if (!order.databaseId) throw new Error("OS sem identificador persistente.");
    const { data, error } = await supabase
      .from("service_orders")
      .select("*")
      .eq("id", order.databaseId)
      .single();
    if (error || !data) throw new Error("Não foi possível recarregar a OS.");
    const latest = mapOrder(data);
    this.orderVersions.set(data.id, data.updated_at);
    return latest;
  }

  async load() {
    const [customersResult, vehiclesResult, ordersResult] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("vehicles").select("*"),
      supabase.from("service_orders").select("*").order("order_number", { ascending: false }),
    ]);
    const error = customersResult.error ?? vehiclesResult.error ?? ordersResult.error;
    if (error) throw error;
    this.orderVersions = new Map((ordersResult.data ?? []).map((row) => [row.id, row.updated_at]));
    return {
      customers: (customersResult.data ?? []).map(mapCustomer),
      vehicles: (vehiclesResult.data ?? []).map(mapVehicle),
      orders: (ordersResult.data ?? []).map(mapOrder),
    };
  }

  async createOrder(bundle: NewOrderBundle) {
    const { data: created, error } = await supabase.rpc("create_service_order_atomic", {
      existing_customer_id: (bundle.customer ? null : bundle.order.customerId) as string,
      new_customer: bundle.customer ? asJson(bundle.customer) : null,
      existing_vehicle_id: (bundle.vehicle ? null : bundle.order.vehicleId) as string,
      new_vehicle: bundle.vehicle ? asJson(bundle.vehicle) : null,
      order_data: asJson({
        entryMileage: bundle.order.entryMileage,
        complaint: bundle.order.complaint,
      }),
    });
    if (error) throw error;
    try {
      const data = await this.load();
      this.orderVersions.set(created.id, created.updated_at);
      // Another operator may have created a newer OS while the list was loading.
      return {
        ...data,
        orders: [
          mapOrder(created),
          ...data.orders.filter((order) => order.databaseId !== created.id),
        ],
      };
    } catch {
      throw new Error(
        `OS-${created.order_number} foi criada, mas a lista não pôde ser atualizada. Recarregue antes de criar outra OS.`,
      );
    }
  }

  async saveOrder(order: ServiceOrder) {
    if (!order.databaseId) throw new Error("OS sem identificador persistente.");
    const expectedVersion = this.orderVersions.get(order.databaseId);
    if (!expectedVersion) throw new Error("Recarregue a OS antes de salvar.");
    const nextVersion = new Date(
      Math.max(Date.now(), Date.parse(expectedVersion) + 1),
    ).toISOString();
    const { data, error } = await supabase
      .from("service_orders")
      .update({
        status: order.status,
        completed_at: order.completedAt ?? null,
        entry_mileage: order.entryMileage,
        diagnosis: order.diagnosis,
        findings: order.findings,
        notes: order.notes,
        team: asJson(order.team),
        budget: asJson(order.budget),
        evidence: asJson(order.evidence),
        payment: order.payment ? asJson(order.payment) : null,
        status_history: asJson(order.statusHistory ?? []),
        activities: asJson(order.activities ?? []),
        workshop_snapshot: order.workshopSnapshot ? asJson(order.workshopSnapshot) : null,
        updated_at: nextVersion,
      })
      .eq("id", order.databaseId)
      .eq("updated_at", expectedVersion)
      .select("id, updated_at")
      .single();
    if (error?.code === "PGRST116" || (!error && !data)) {
      // Missing rows may also mean lost access; confirm a readable newer version.
      const current = await supabase
        .from("service_orders")
        .select("updated_at")
        .eq("id", order.databaseId)
        .maybeSingle();
      if (!current.error && current.data && current.data.updated_at !== expectedVersion) {
        throw new OrderVersionConflict();
      }
    }
    if (error || !data)
      throw new Error(
        "A OS pode ter sido alterada por outra pessoa ou seu acesso mudou. Recarregue antes de continuar.",
      );
    this.orderVersions.set(data.id, data.updated_at);
  }

  async deleteCustomer(customerId: string, deletedAt: string) {
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", customerId)
      .select("id")
      .single();
    if (error) throw error;
  }

  async deleteVehicle(vehicleId: string, deletedAt: string) {
    const { error } = await supabase
      .from("vehicles")
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", vehicleId)
      .select("id")
      .single();
    if (error) throw error;
  }

  async reset(): Promise<OperationalData> {
    throw new Error("A limpeza de dados cloud não está disponível pela aplicação.");
  }
}

class LocalOperationalRepository implements OperationalRepository {
  async reloadOrder(order: ServiceOrder) {
    const latest = this.read().orders.find((item) => item.id === order.id);
    if (!latest) throw new Error("Não foi possível recarregar a OS.");
    return latest;
  }
  private read(): OperationalData {
    try {
      const saved = localStorage.getItem(devStorageKey);
      return saved ? (JSON.parse(saved) as OperationalData) : emptyData();
    } catch {
      return emptyData();
    }
  }

  private write(data: OperationalData) {
    localStorage.setItem(devStorageKey, JSON.stringify(data));
  }

  async load() {
    return this.read();
  }

  async createOrder(bundle: NewOrderBundle) {
    const data = this.read();
    const customer = bundle.customer
      ? { ...bundle.customer, id: crypto.randomUUID() }
      : data.customers.find((item) => item.id === bundle.order.customerId);
    if (!customer) throw new Error("Cliente não encontrado.");
    const vehicle = bundle.vehicle
      ? { ...bundle.vehicle, id: crypto.randomUUID(), customerId: customer.id }
      : data.vehicles.find((item) => item.id === bundle.order.vehicleId);
    if (!vehicle) throw new Error("Veículo não encontrado.");
    const order = {
      ...bundle.order,
      id: `OS-DEV-${Date.now()}`,
      databaseId: crypto.randomUUID(),
      customerId: customer.id,
      vehicleId: vehicle.id,
    };
    const next = {
      customers: bundle.customer ? [...data.customers, customer] : data.customers,
      vehicles: bundle.vehicle ? [...data.vehicles, vehicle] : data.vehicles,
      orders: [order, ...data.orders],
    };
    this.write(next);
    return next;
  }

  async saveOrder(order: ServiceOrder) {
    const data = this.read();
    this.write({
      ...data,
      orders: data.orders.map((item) => (item.id === order.id ? order : item)),
    });
  }

  async deleteCustomer(customerId: string, deletedAt: string) {
    const data = this.read();
    this.write({
      ...data,
      customers: data.customers.map((item) =>
        item.id === customerId ? { ...item, deletedAt } : item,
      ),
      vehicles: data.vehicles.map((item) =>
        item.customerId === customerId ? { ...item, deletedAt } : item,
      ),
    });
  }

  async deleteVehicle(vehicleId: string, deletedAt: string) {
    const data = this.read();
    this.write({
      ...data,
      vehicles: data.vehicles.map((item) =>
        item.id === vehicleId ? { ...item, deletedAt } : item,
      ),
    });
  }

  async reset() {
    const data = emptyData();
    this.write(data);
    return data;
  }
}

export const createOperationalRepository = (localBypass: boolean): OperationalRepository => {
  if (
    localBypass &&
    (!import.meta.env.DEV ||
      typeof window === "undefined" ||
      !["localhost", "127.0.0.1"].includes(window.location.hostname))
  ) {
    throw new Error("Adapter local disponível somente em desenvolvimento local.");
  }
  return localBypass ? new LocalOperationalRepository() : new CloudOperationalRepository();
};

export async function loadCustomerPortal() {
  const { error: linkError } = await supabase.rpc("try_link_my_customer");
  if (linkError) throw linkError;
  const { data: customers, error: customerError } = await supabase.rpc("get_my_customer");
  if (customerError) throw customerError;
  const customerRow = customers?.[0];
  if (!customerRow) return null;
  const [vehiclesResult, ordersResult] = await Promise.all([
    supabase.rpc("get_my_vehicles"),
    supabase.rpc("get_my_service_orders"),
  ]);
  const error = vehiclesResult.error ?? ordersResult.error;
  if (error) throw error;
  return {
    customer: mapCustomer({ ...customerRow, auth_user_id: null, deleted_at: null }),
    vehicles: (vehiclesResult.data ?? []).map((row) => mapVehicle({ ...row, deleted_at: null })),
    orders: (ordersResult.data ?? []).map((row) => ({
      id: `OS-${row.order_number}`,
      databaseId: row.id,
      customerId: customerRow.id,
      vehicleId: row.vehicle_id,
      status: row.status as ServiceOrder["status"],
      openedAt: row.opened_at,
      ...(row.completed_at ? { completedAt: row.completed_at } : {}),
      entryMileage: 0,
      complaint: "",
      diagnosis: "",
      findings: "",
      notes: "",
      team: [],
      budget: [],
      evidence: [],
    })),
  };
}

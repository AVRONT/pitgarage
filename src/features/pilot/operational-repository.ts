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

class CloudOperationalRepository implements OperationalRepository {
  async load() {
    const [customersResult, vehiclesResult, ordersResult] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("vehicles").select("*"),
      supabase.from("service_orders").select("*").order("order_number", { ascending: false }),
    ]);
    const error = customersResult.error ?? vehiclesResult.error ?? ordersResult.error;
    if (error) throw error;
    return {
      customers: (customersResult.data ?? []).map(mapCustomer),
      vehicles: (vehiclesResult.data ?? []).map(mapVehicle),
      orders: (ordersResult.data ?? []).map(mapOrder),
    };
  }

  async createOrder(bundle: NewOrderBundle) {
    const { error } = await supabase.rpc("create_service_order_atomic", {
      existing_customer_id: bundle.customer ? null : bundle.order.customerId,
      new_customer: bundle.customer ? asJson(bundle.customer) : null,
      existing_vehicle_id: bundle.vehicle ? null : bundle.order.vehicleId,
      new_vehicle: bundle.vehicle ? asJson(bundle.vehicle) : null,
      order_data: asJson({
        entryMileage: bundle.order.entryMileage,
        complaint: bundle.order.complaint,
      }),
    });
    if (error) throw error;
    return this.load();
  }

  async saveOrder(order: ServiceOrder) {
    if (!order.databaseId) throw new Error("OS sem identificador persistente.");
    const { error } = await supabase
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
        updated_at: order.updatedAt ?? new Date().toISOString(),
      })
      .eq("id", order.databaseId);
    if (error) throw error;
  }

  async deleteCustomer(customerId: string, deletedAt: string) {
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", customerId);
    if (error) throw error;
  }

  async deleteVehicle(vehicleId: string, deletedAt: string) {
    const { error } = await supabase
      .from("vehicles")
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq("id", vehicleId);
    if (error) throw error;
  }

  async reset(): Promise<OperationalData> {
    throw new Error("A limpeza de dados cloud não está disponível pela aplicação.");
  }
}

class LocalOperationalRepository implements OperationalRepository {
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

export const createOperationalRepository = (localBypass: boolean): OperationalRepository =>
  localBypass ? new LocalOperationalRepository() : new CloudOperationalRepository();

export async function loadCustomerPortal() {
  const { error: linkError } = await supabase.rpc("try_link_my_customer");
  if (linkError) throw linkError;
  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .limit(1);
  if (customerError) throw customerError;
  const customerRow = customers?.[0];
  if (!customerRow) return null;
  const [vehiclesResult, ordersResult] = await Promise.all([
    supabase.from("vehicles").select("*").eq("customer_id", customerRow.id),
    supabase.rpc("get_my_service_orders"),
  ]);
  const error = vehiclesResult.error ?? ordersResult.error;
  if (error) throw error;
  return {
    customer: mapCustomer(customerRow),
    vehicles: (vehiclesResult.data ?? []).map(mapVehicle),
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

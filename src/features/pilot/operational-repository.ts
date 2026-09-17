import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import type { Customer, ServiceOrder, Vehicle } from "./pilot-data";
import type { QuickOrderDraft } from "./quick-order-model";
import { financialRpc } from "./financial-api";
import { roundMoney, validatePart, canRemoveBudgetItem, type FinancialMutation } from "./financial-model";

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
  savePartFinancial(order: ServiceOrder, input: FinancialMutation): Promise<ServiceOrder>;
  reloadOrder(order: ServiceOrder): Promise<ServiceOrder>;
  load(): Promise<OperationalData>;
  createOrder(bundle: NewOrderBundle): Promise<OperationalData>;
  createQuickOrder(draft: QuickOrderDraft, workshopSnapshot?: ServiceOrder["workshopSnapshot"]): Promise<OperationalData>;
  saveOrder(order: ServiceOrder): Promise<void>;
  deleteOrder(order: ServiceOrder): Promise<void>;
  cancelOrder(order: ServiceOrder, reason: string): Promise<ServiceOrder>;
  updateComplaint(order: ServiceOrder, complaint: string): Promise<ServiceOrder>;
  updateVehicle(vehicle: Vehicle): Promise<Vehicle>;
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
  vehicle_id: string | null;
  flow_type?: string;
  quick_vehicle_brand?: string | null;
  quick_vehicle_model?: string | null;
  quick_vehicle_year?: number | null;
  creation_request_id?: string | null;
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
  discount_amount?: number | null;
  discount_reason?: string | null;
  status_history: Json;
  activities: Json;
  workshop_snapshot: Json | null;
  updated_at: string;
  warranty_days?: number | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;

}): ServiceOrder {
  return {
    id: `OS-${row.order_number}`,
    databaseId: row.id,
    customerId: row.customer_id,
    ...(row.vehicle_id ? { vehicleId: row.vehicle_id } : {}),
    flowType: row.flow_type === "quick" ? "quick" : "standard",
    ...(row.quick_vehicle_brand ? { quickVehicleBrand: row.quick_vehicle_brand } : {}),
    ...(row.quick_vehicle_model ? { quickVehicleModel: row.quick_vehicle_model } : {}),
    ...(row.quick_vehicle_year == null ? {} : { quickVehicleYear: row.quick_vehicle_year }),
    ...(row.creation_request_id ? { creationRequestId: row.creation_request_id } : {}),
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
    discountAmount: row.discount_amount ?? 0,
    discountReason: row.discount_reason ?? "",
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
    ...(row.warranty_days == null ? {} : { warrantyDays: row.warranty_days }),

    ...(row.cancelled_at ? { cancelledAt: row.cancelled_at } : {}),
    ...(row.cancelled_by ? { cancelledBy: row.cancelled_by } : {}),
    ...(row.cancel_reason ? { cancelReason: row.cancel_reason } : {}),
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

  async savePartFinancial(order: ServiceOrder, input: FinancialMutation) {
    if (!order.databaseId) throw new Error("OS sem identificador persistente.");
    const expected = this.orderVersions.get(order.databaseId);
    if (!expected) throw new Error("Recarregue a OS antes de salvar.");
    try {
      const row = await financialRpc<Parameters<typeof mapOrder>[0]>(
        "correction" in input ? "correct_order_financial" : "discount" in input ? "set_order_discount" : "receipt" in input ? "record_order_payment" : "removeItem" in input ? "remove_budget_item" : input.newItem ? "add_budget_item" : "save_part_financial",
        "correction" in input ? {
          order_id: order.databaseId, expected_version: expected, request_id: input.correction.id,
          correction_type: input.correction.type, payload: input.correction.payload, reason: input.correction.reason,
        } : "discount" in input ? {
          order_id: order.databaseId, expected_version: expected, request_id: input.discount.id,
          amount: input.discount.amount, reason: input.discount.reason,
        } : "receipt" in input ? {
          order_id: order.databaseId, expected_version: expected, receipt: input.receipt,
        } : "removeItem" in input ? {
          order_id: order.databaseId,
          expected_version: expected,
          item_id: input.removeItem,
        } : {
          ...(input.newItem
            ? { item_name: input.newItem.name, item_type: input.newItem.type }
            : {}),
          order_id: order.databaseId,
          expected_version: expected,
          item_id: input.itemId,
          unit_cost: input.unitCost,
          markup: input.markup,
          quantity: input.quantity,
          unit_price: input.unitPrice,
        },
      );
      this.orderVersions.set(row.id, row.updated_at);
      return mapOrder(row);
    } catch (error) {
      if ((error as { code?: string }).code === "40001") throw new OrderVersionConflict();
      throw error;
    }
  }

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
        ...(bundle.order.creationRequestId ? {
          creationRequestId: bundle.order.creationRequestId,
          quickVehicleBrand: bundle.order.quickVehicleBrand,
          quickVehicleModel: bundle.order.quickVehicleModel,
          quickVehicleYear: bundle.order.quickVehicleYear,
          seedService: bundle.order.budget[0]?.name,
          seedAmount: bundle.order.budget[0]?.price,
          discountAmount: bundle.order.discountAmount ?? 0,
          discountReason: bundle.order.discountReason ?? "",
          receivedAmount: bundle.order.payment?.amount ?? 0,
          paymentMethod: bundle.order.payment?.method,
          internalCost: bundle.order.internalCost,
          cardFee: bundle.order.cardFee ?? 0,
        } : {}),
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

  async createQuickOrder(draft: QuickOrderDraft, workshopSnapshot?: ServiceOrder["workshopSnapshot"]) {
    const { data: created, error } = await (supabase.rpc("create_quick_service_order" as never, {
      request_id: draft.requestId,
      existing_customer_id: draft.customerId ?? null,
      new_customer: draft.newCustomer ? asJson(draft.newCustomer) : null,
      existing_vehicle_id: draft.vehicleId ?? null,
      vehicle_brand: draft.vehicleBrand,
      vehicle_model: draft.vehicleModel,
      vehicle_year: draft.vehicleYear,
      service_name: draft.service,
      service_amount: draft.amount,
      discount_amount: draft.discountAmount,
      discount_reason: draft.discountReason,
      received_amount: draft.receivedAmount,
      payment_method: draft.receivedAmount > 0 ? draft.paymentMethod : null,
      workshop_snapshot: workshopSnapshot ? asJson(workshopSnapshot) : null,
      internal_cost: draft.internalCost ?? null,
      card_fee: draft.cardFee,
    } as never) as unknown as Promise<{ data: Parameters<typeof mapOrder>[0] | null; error: { message: string } | null }>);
    if (error || !created) throw new Error(error?.message ?? "Não foi possível finalizar o atendimento rápido.");
    const data = await this.load();
    this.orderVersions.set(created.id, created.updated_at);
    return { ...data, orders: [mapOrder(created), ...data.orders.filter((order) => order.databaseId !== created.id)] };
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
        warranty_days: order.warrantyDays ?? null,
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

  async deleteOrder(order: ServiceOrder) {
    if (!order.databaseId) throw new Error("OS sem identificador persistente.");
    const expected = this.orderVersions.get(order.databaseId);
    if (!expected) throw new Error("Recarregue a OS antes de excluir.");
    const { error } = await supabase.rpc("delete_service_order", {
      order_id: order.databaseId,
      expected_version: expected,
    });
    if (error) {
      if (error.code === "40001") throw new OrderVersionConflict();
      throw new Error(error.message);
    }
    this.orderVersions.delete(order.databaseId);
  }

  async cancelOrder(order: ServiceOrder, reason: string) {
    if (!order.databaseId) throw new Error("OS sem identificador persistente.");
    const expected = this.orderVersions.get(order.databaseId);
    if (!expected) throw new Error("Recarregue a OS antes de cancelar.");
    const { data, error } = await supabase.rpc("cancel_service_order", {
      order_id: order.databaseId,
      expected_version: expected,
      reason,
    });
    if (error) {
      if (error.code === "40001") throw new OrderVersionConflict();
      throw new Error(error.message);
    }
    const row = data as unknown as Parameters<typeof mapOrder>[0];
    this.orderVersions.set(row.id, row.updated_at);
    return mapOrder(row);
  }

  async updateComplaint(order: ServiceOrder, complaint: string) {
    if (!order.databaseId) throw new Error("OS sem identificador persistente.");
    const expected = this.orderVersions.get(order.databaseId);
    if (!expected) throw new Error("Recarregue a OS antes de salvar.");
    const { data, error } = await supabase.rpc("update_order_complaint", {
      order_id: order.databaseId,
      expected_version: expected,
      new_complaint: complaint,
    });
    if (error) {
      if (error.code === "40001") throw new OrderVersionConflict();
      throw new Error(error.message);
    }
    const row = data as unknown as Parameters<typeof mapOrder>[0];
    this.orderVersions.set(row.id, row.updated_at);
    return mapOrder(row);
  }

  async updateVehicle(vehicle: Vehicle) {
    const { data, error } = await supabase
      .from("vehicles")
      .update({
        kind: vehicle.kind,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        plate: vehicle.plate,
        mileage: vehicle.mileage,
        color: vehicle.color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", vehicle.id)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505")
        throw new Error("Esta placa já pertence a outro veículo ativo.");
      if (error.code === "PGRST116")
        throw new Error("Veículo não encontrado ou sem permissão para editar.");
      throw new Error(error.message);
    }
    return mapVehicle(data);
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
  async savePartFinancial(order: ServiceOrder, input: FinancialMutation): Promise<ServiceOrder> {
    if ("correction" in input) throw new Error("Correções financeiras exigem uma sessão real da oficina.");
    if ("discount" in input) throw new Error("Descontos exigem uma sessão real da oficina.");
    if ("receipt" in input) throw new Error("Pagamentos exigem uma sessão real da oficina.");
    if ("removeItem" in input) {
      const item = order.budget.find((entry) => entry.id === input.removeItem);
      if (!item || !canRemoveBudgetItem(order, item))
        throw new Error("Volte ao orçamento pelo fluxo da OS antes de remover este item.");
      const updated: ServiceOrder = {
        ...order,
        budget: order.budget.filter((entry) => entry.id !== input.removeItem),
        activities: [...(order.activities ?? []), {
          id: "a-" + crypto.randomUUID(), type: "budget",
          description: "Item removido do orçamento: " + item.name, at: new Date().toISOString(),
        }],
      };
      await this.saveOrder(updated);
      return updated;
    }
    // Local demo retains commercial item creation, never private financial data.
    if (!input.newItem || input.unitCost !== null || input.markup !== null)
      throw new Error("O financeiro exige o ambiente da oficina com permissões ativas.");
    const issue = validatePart(input);
    if (issue || !input.newItem.name.trim()) throw new Error(issue || "Informe a descrição.");
    if (order.budget.some((item) => item.id === input.itemId)) throw new OrderVersionConflict();
    const now = new Date().toISOString();
    const updated: ServiceOrder = {
      ...order,
      budget: [
        ...order.budget,
        {
          id: input.itemId,
          name: input.newItem.name.trim(),
          type: input.newItem.type,
          price: roundMoney(input.unitPrice * input.quantity),
          approval: "Aguardando aprovação",
          executed: false,
          ...(input.newItem.type === "Peça"
            ? {
                quantity: input.quantity,
                unitPrice: input.unitPrice,
                availability: "Disponível" as const,
              }
            : {}),
        },
      ],
      activities: [
        ...(order.activities ?? []),
        {
          id: "a-" + crypto.randomUUID(),
          type: "budget",
          description: "Item incluído no orçamento: " + input.newItem.name.trim(),
          at: now,
        },
      ],
    };
    await this.saveOrder(updated);
    return updated;
  }
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

  async createQuickOrder(draft: QuickOrderDraft, workshopSnapshot?: ServiceOrder["workshopSnapshot"]) {
    const data = this.read();
    const existing = data.orders.find((order) => order.creationRequestId === draft.requestId);
    if (existing) return data;
    const customer = draft.newCustomer
      ? { id: crypto.randomUUID(), name: draft.newCustomer.name, phone: draft.newCustomer.phone,
          email: "", ...(draft.newCustomer.cpf ? { cpf: draft.newCustomer.cpf } : {}), since: String(new Date().getFullYear()) }
      : data.customers.find((item) => item.id === draft.customerId);
    if (!customer) throw new Error("Cliente não encontrado.");
    const vehicle = draft.vehicleId ? data.vehicles.find((item) => item.id === draft.vehicleId && item.customerId === customer.id) : undefined;
    if (draft.vehicleId && !vehicle) throw new Error("O veículo não pertence ao cliente selecionado.");
    const now = new Date().toISOString();
    const total = draft.amount - draft.discountAmount;
    const payment = draft.receivedAmount > 0 && draft.paymentMethod ? {
      amount: draft.receivedAmount, method: draft.paymentMethod,
      status: draft.receivedAmount >= total ? "Pago" as const : "Parcial" as const, date: now,
      receipts: [{ id: draft.requestId, amount: draft.receivedAmount, method: draft.paymentMethod,
        date: now, note: "", recordedBy: "local", actorName: "Usuário interno" }],
    } : undefined;
    const order: ServiceOrder = {
      id: `OS-DEV-${Date.now()}`, databaseId: crypto.randomUUID(), customerId: customer.id,
      ...(vehicle ? { vehicleId: vehicle.id } : {}), flowType: "quick",
      quickVehicleBrand: draft.vehicleBrand, quickVehicleModel: draft.vehicleModel,
      quickVehicleYear: draft.vehicleYear, creationRequestId: draft.requestId,
      status: "Entregue", openedAt: now.slice(0,10), completedAt: now.slice(0,10), entryMileage: 0,
      complaint: draft.service, diagnosis: "", findings: "", notes: "", team: [], evidence: [],
      budget: [{ id: `quick-${draft.requestId}`, type: "Serviço", name: draft.service.trim(),
        price: draft.amount, approval: "Aprovado", executed: true }],
      discountAmount: draft.discountAmount, discountReason: draft.discountReason,
      ...(payment ? { payment } : {}), ...(workshopSnapshot ? { workshopSnapshot } : {}), warrantyDays: draft.warrantyDays,
      activities: [{ id: `a-${draft.requestId}`, type: "created", description: "OS Rápida criada", at: now }],
      statusHistory: [{ id: `s-${draft.requestId}`, from: "Recebido", to: "Entregue", at: now }], updatedAt: now,
    };
    const next = { customers: draft.newCustomer ? [...data.customers, customer] : data.customers,
      vehicles: data.vehicles, orders: [order, ...data.orders] };
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

  async deleteOrder(order: ServiceOrder) {
    const data = this.read();
    this.write({ ...data, orders: data.orders.filter((item) => item.id !== order.id) });
  }

  async cancelOrder(order: ServiceOrder, reason: string) {
    const updated: ServiceOrder = {
      ...order,
      cancelledAt: new Date().toISOString(),
      cancelReason: reason.trim(),
      activities: [
        ...(order.activities ?? []),
        {
          id: "a-" + crypto.randomUUID(),
          type: "status",
          description: "OS cancelada: " + reason.trim(),
          at: new Date().toISOString(),
        },
      ],
    };
    await this.saveOrder(updated);
    return updated;
  }

  async updateComplaint(order: ServiceOrder, complaint: string) {
    const cleaned = complaint.trim();
    if (!cleaned) throw new Error("Informe o problema relatado.");
    const updated: ServiceOrder = {
      ...order,
      complaint: cleaned,
      activities: [
        ...(order.activities ?? []),
        {
          id: "a-" + crypto.randomUUID(),
          type: "diagnosis",
          description: `Problema relatado editado de "${order.complaint}" para "${cleaned}"`,
          at: new Date().toISOString(),
        },
      ],
    };
    await this.saveOrder(updated);
    return updated;
  }

  async updateVehicle(vehicle: Vehicle) {
    const data = this.read();
    this.write({
      ...data,
      vehicles: data.vehicles.map((item) => (item.id === vehicle.id ? vehicle : item)),
    });
    return vehicle;
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

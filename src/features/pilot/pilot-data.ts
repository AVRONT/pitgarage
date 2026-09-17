export const orderStatuses = [
  "Recebido",
  "Em diagnóstico",
  "Aguardando aprovação",
  "Aguardando peça",
  "Em manutenção",
  "Serviço concluído",
  "Aguardando retirada",
  "Entregue",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export type ApprovalStatus = "Aprovado" | "Recusado" | "Aguardando aprovação";
export type VehicleKind = "Carro" | "Moto";

export interface Customer {
  id: string;
  authUserId?: string | undefined;
  name: string;
  phone: string;
  email: string;
  cpf?: string;
  since: string;
  deletedAt?: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  kind: VehicleKind;
  brand: string;
  model: string;
  year: number;
  plate: string;
  mileage: number;
  color: string;
  deletedAt?: string;
}

export interface BudgetItem {
  id: string;
  type: "Serviço" | "Peça";
  name: string;
  cost?: number;
  quantity?: number;
  unitPrice?: number;
  price: number;
  approval: ApprovalStatus;
  availability?: "Disponível" | "Solicitada" | "Aguardando peça";
  additional?: boolean;
  executed?: boolean;
}

export interface Evidence {
  id: string;
  kind: "Foto" | "Vídeo";
  name: string;
  caption: string;
  path?: string;
  mimeType?: string;
  size?: number;
}

export interface Payment {
  receipts?: import("./payment-model").Receipt[];
  legacy?: Record<string, unknown>;
  amount: number;
  method: "PIX" | "Cartão" | "Dinheiro";
  status: "Pendente" | "Pago" | "Parcial" | "Em aberto";
  date: string;
}

export interface OrderActivity {
  id: string;
  type: "created" | "status" | "diagnosis" | "budget" | "execution" | "payment";
  description: string;
  at: string;
  action?: "commercial_discount";
  requestId?: string;
  previousAmount?: number;
  newAmount?: number;
  previousReason?: string;
  reason?: string;
  recordedBy?: string;
  actorName?: string;
}

export interface StatusHistoryEntry {
  id: string;
  from: OrderStatus;
  to: OrderStatus;
  at: string;
}

export interface ServiceOrder {
  id: string;
  databaseId?: string | undefined;
  customerId: string;
  vehicleId?: string | undefined;
  flowType?: "standard" | "quick" | undefined;
  quickVehicleBrand?: string | undefined;
  quickVehicleModel?: string | undefined;
  quickVehicleYear?: number | undefined;
  creationRequestId?: string | undefined;
  status: OrderStatus;
  openedAt: string;
  completedAt?: string | undefined;
  workshopSnapshot?: {
    name: string;
    legalName: string;
    cnpj: string;
    phone: string;
    address: string;
    postalCode: string;
    hours: string;
  };
  entryMileage: number;
  complaint: string;
  diagnosis: string;
  findings: string;
  notes: string;
  team: string[];
  budget: BudgetItem[];
  evidence: Evidence[];
  payment?: Payment | undefined;
  discountAmount?: number;
  discountReason?: string;
  statusHistory?: StatusHistoryEntry[];
  activities?: OrderActivity[];
  updatedAt?: string;
  /** Prazo de garantia congelado na conclusão da OS. */
  warrantyDays?: number | undefined;
  cancelledAt?: string | undefined;
  cancelledBy?: string | undefined;
  cancelReason?: string | undefined;
}

/** Garantia padrão vigente para novas OS, orçamentos e documentos comerciais. */
export const warrantyDays = 90;

/** OS concluídas antes do snapshot mantêm explicitamente os 30 dias originais. */
export const orderWarrantyDays = (order: ServiceOrder) =>
  order.warrantyDays ?? (order.completedAt ? 30 : warrantyDays);

export const warrantyDeadline = (order: ServiceOrder) => {
  if (!order.completedAt) return null;
  const end = parsePilotDate(order.completedAt, true);
  if (!end) return null;
  end.setUTCDate(end.getUTCDate() + orderWarrantyDays(order));
  return end;
};

export const isOrderCancelled = (order: ServiceOrder) => Boolean(order.cancelledAt);


/** Mesmas regras aplicadas em public.delete_service_order. */
export function orderDeleteBlockers(order: ServiceOrder): string[] {
  const blockers: string[] = [];
  if (isOrderCancelled(order)) blockers.push("a OS está cancelada");
  if (order.status !== "Recebido") blockers.push("a OS já saiu da etapa Recebido");
  if (order.diagnosis.trim() || order.findings.trim()) blockers.push("há diagnóstico registrado");
  if (order.budget.length) blockers.push("há itens no orçamento");
  if (order.evidence.length) blockers.push("há fotos ou vídeos anexados");
  if (order.payment) blockers.push("há pagamento registrado");
  if (order.completedAt) blockers.push("o serviço já foi concluído");
  return blockers;
}

/** Mesmas regras aplicadas em public.cancel_service_order. */
export function orderCancelBlocker(order: ServiceOrder): string | null {
  if (isOrderCancelled(order)) return "Esta OS já está cancelada.";
  if (order.payment || order.budget.some((item) => item.executed))
    return "Esta OS tem pagamento registrado ou serviço executado: o cancelamento precisa de tratamento manual.";
  if (["Serviço concluído", "Aguardando retirada", "Entregue"].includes(order.status))
    return "OS concluída ou entregue não pode ser cancelada automaticamente.";
  return null;
}

export function logicallyDeleteCustomer(
  customers: Customer[],
  vehicles: Vehicle[],
  customerId: string,
  deletedAt: string,
) {
  return {
    customers: customers.map((customer) =>
      customer.id === customerId ? { ...customer, deletedAt } : customer,
    ),
    vehicles: vehicles.map((vehicle) =>
      vehicle.customerId === customerId ? { ...vehicle, deletedAt } : vehicle,
    ),
  };
}

export function logicallyDeleteVehicle(vehicles: Vehicle[], vehicleId: string, deletedAt: string) {
  return vehicles.map((vehicle) =>
    vehicle.id === vehicleId ? { ...vehicle, deletedAt } : vehicle,
  );
}

export const initialCustomers: Customer[] = [
  {
    id: "c1",
    name: "João da Silva",
    phone: "(11) 99876-4321",
    email: "joao.silva@example.com",
    since: "2023",
  },
  {
    id: "c2",
    name: "Mariana Costa",
    phone: "(11) 98765-1122",
    email: "mariana.costa@example.com",
    since: "2024",
  },
  {
    id: "c3",
    name: "Carlos Mendes",
    phone: "(11) 97654-8899",
    email: "carlos.mendes@example.com",
    since: "2022",
  },
  {
    id: "c4",
    name: "Ana Paula Souza",
    phone: "(11) 96543-7711",
    email: "ana.souza@example.com",
    since: "2025",
  },
  {
    id: "c5",
    name: "Ricardo Nunes",
    phone: "(11) 95432-6600",
    email: "ricardo.nunes@example.com",
    since: "2024",
  },
];

export const initialVehicles: Vehicle[] = [
  {
    id: "v1",
    customerId: "c1",
    kind: "Carro",
    brand: "Honda",
    model: "Civic",
    year: 2020,
    plate: "ABC1D23",
    mileage: 72000,
    color: "Prata",
  },
  {
    id: "v2",
    customerId: "c2",
    kind: "Moto",
    brand: "Honda",
    model: "CG 160",
    year: 2022,
    plate: "RTE4F56",
    mileage: 28400,
    color: "Vermelha",
  },
  {
    id: "v3",
    customerId: "c3",
    kind: "Carro",
    brand: "Toyota",
    model: "Corolla",
    year: 2018,
    plate: "FGR8H91",
    mileage: 96500,
    color: "Preto",
  },
  {
    id: "v4",
    customerId: "c4",
    kind: "Moto",
    brand: "Yamaha",
    model: "Fazer 250",
    year: 2021,
    plate: "QAZ7B12",
    mileage: 36100,
    color: "Azul",
  },
  {
    id: "v5",
    customerId: "c5",
    kind: "Carro",
    brand: "Volkswagen",
    model: "T-Cross",
    year: 2023,
    plate: "DFG5J67",
    mileage: 19800,
    color: "Branco",
  },
  {
    id: "v6",
    customerId: "c1",
    kind: "Moto",
    brand: "Royal Enfield",
    model: "Meteor 350",
    year: 2022,
    plate: "KLM2N34",
    mileage: 12500,
    color: "Verde",
  },
];

export const initialOrders: ServiceOrder[] = [
  {
    id: "OS-1049",
    customerId: "c5",
    vehicleId: "v5",
    status: "Recebido",
    openedAt: "2026-09-01",
    entryMileage: 19840,
    complaint: "Luz de revisão acesa e ruído leve ao passar em lombadas.",
    diagnosis: "",
    findings: "",
    notes: "Entrada recente para demonstração do fluxo.",
    team: [],
    budget: [],
    evidence: [],
    statusHistory: [],
    activities: [
      {
        id: "a-1049-1",
        type: "created",
        description: "OS criada",
        at: "2026-09-01T14:20:00-03:00",
      },
    ],
    updatedAt: "2026-09-01T14:20:00-03:00",
  },
  {
    id: "OS-1048",
    customerId: "c1",
    vehicleId: "v1",
    status: "Aguardando aprovação",
    openedAt: "2026-09-01",
    entryMileage: 72000,
    complaint: "Ruído forte ao frear e vibração no volante em velocidades acima de 80 km/h.",
    diagnosis: "Desgaste acentuado das pastilhas dianteiras e discos com empenamento leve.",
    findings: "Amortecedor dianteiro direito apresenta início de vazamento.",
    notes: "Cliente utiliza o veículo diariamente para trabalho.",
    team: ["Marcelo", "Diego"],
    statusHistory: [
      { id: "s-1048-1", from: "Recebido", to: "Em diagnóstico", at: "2026-09-01T14:45:00-03:00" },
      {
        id: "s-1048-2",
        from: "Em diagnóstico",
        to: "Aguardando aprovação",
        at: "2026-09-01T15:32:00-03:00",
      },
    ],
    activities: [
      {
        id: "a-1048-1",
        type: "created",
        description: "OS criada",
        at: "2026-09-01T14:20:00-03:00",
      },
      {
        id: "a-1048-2",
        type: "diagnosis",
        description: "Diagnóstico registrado",
        at: "2026-09-01T14:45:00-03:00",
      },
      {
        id: "a-1048-3",
        type: "status",
        description: "Status alterado de Em diagnóstico para Aguardando aprovação",
        at: "2026-09-01T15:32:00-03:00",
      },
    ],
    updatedAt: "2026-09-01T15:32:00-03:00",
    evidence: [
      {
        id: "e1",
        kind: "Foto",
        name: "pastilha-dianteira.jpg",
        caption: "Desgaste da pastilha dianteira esquerda",
      },
      {
        id: "e2",
        kind: "Vídeo",
        name: "ruido-freio.mp4",
        caption: "Ruído durante teste de frenagem",
      },
    ],
    budget: [
      {
        id: "i1",
        type: "Peça",
        name: "Jogo de pastilhas dianteiras",
        cost: 420,
        price: 546,
        approval: "Aprovado",
        availability: "Disponível",
        executed: false,
      },
      {
        id: "i2",
        type: "Serviço",
        name: "Troca das pastilhas e revisão dos freios",
        price: 380,
        approval: "Aprovado",
        executed: false,
      },
      {
        id: "i3",
        type: "Peça",
        name: "Par de discos dianteiros",
        cost: 890,
        price: 1157,
        approval: "Aguardando aprovação",
        availability: "Solicitada",
        executed: false,
      },
      {
        id: "i4",
        type: "Serviço",
        name: "Troca e assentamento dos discos",
        price: 420,
        approval: "Aguardando aprovação",
        executed: false,
      },
      {
        id: "i5",
        type: "Peça",
        name: "Amortecedor dianteiro direito",
        cost: 610,
        price: 793,
        approval: "Aguardando aprovação",
        availability: "Aguardando peça",
        additional: true,
        executed: false,
      },
      {
        id: "i15",
        type: "Serviço",
        name: "Alinhamento preventivo",
        price: 180,
        approval: "Recusado",
        executed: false,
      },
    ],
  },
  {
    id: "OS-1047",
    customerId: "c2",
    vehicleId: "v2",
    status: "Aguardando peça",
    openedAt: "2026-09-01",
    entryMileage: 28400,
    complaint: "Moto falhando em baixa rotação e demora para ligar pela manhã.",
    diagnosis: "Bateria com baixa capacidade e vela com desgaste.",
    findings: "Sem outros problemas identificados.",
    notes: "Aguardar chegada da bateria.",
    team: ["Rafael"],
    evidence: [
      { id: "e3", kind: "Vídeo", name: "partida-fria.mp4", caption: "Teste de partida a frio" },
    ],
    budget: [
      {
        id: "i6",
        type: "Peça",
        name: "Bateria 6Ah",
        cost: 240,
        price: 312,
        approval: "Aprovado",
        availability: "Aguardando peça",
        executed: false,
      },
      {
        id: "i7",
        type: "Serviço",
        name: "Substituição de bateria e vela",
        price: 160,
        approval: "Aprovado",
        executed: false,
      },
    ],
  },
  {
    id: "OS-1046",
    customerId: "c3",
    vehicleId: "v3",
    status: "Em manutenção",
    openedAt: "2026-08-31",
    entryMileage: 96500,
    complaint: "Revisão dos 100 mil km antecipada e barulho na suspensão.",
    diagnosis: "Bieletas com folga e óleo próximo do limite de troca.",
    findings: "Filtros sujos.",
    notes: "Cliente aprovou revisão completa.",
    team: ["Marcelo", "Diego"],
    evidence: [],
    budget: [
      {
        id: "i8",
        type: "Serviço",
        name: "Revisão preventiva completa",
        price: 740,
        approval: "Aprovado",
        executed: true,
      },
      {
        id: "i9",
        type: "Peça",
        name: "Kit de filtros e óleo",
        cost: 480,
        price: 624,
        approval: "Aprovado",
        availability: "Disponível",
        executed: true,
      },
      {
        id: "i10",
        type: "Peça",
        name: "Par de bieletas",
        cost: 310,
        price: 403,
        approval: "Aprovado",
        availability: "Disponível",
        executed: false,
      },
    ],
  },
  {
    id: "OS-1045",
    customerId: "c4",
    vehicleId: "v4",
    status: "Serviço concluído",
    openedAt: "2026-08-28",
    completedAt: "2026-08-31",
    entryMileage: 36100,
    complaint: "Troca de óleo e revisão antes de viagem.",
    diagnosis: "Manutenção preventiva, sem falhas adicionais.",
    findings: "Relação em boas condições.",
    notes: "Veículo pronto para retirada.",
    team: ["Rafael"],
    evidence: [],
    budget: [
      {
        id: "i11",
        type: "Peça",
        name: "Óleo e filtro",
        cost: 135,
        price: 175.5,
        approval: "Aprovado",
        availability: "Disponível",
        executed: true,
      },
      {
        id: "i12",
        type: "Serviço",
        name: "Troca de óleo e checklist",
        price: 180,
        approval: "Aprovado",
        executed: true,
      },
    ],
    payment: { amount: 355.5, method: "PIX", status: "Pago", date: "2026-08-31" },
  },
  {
    id: "OS-1039",
    customerId: "c1",
    vehicleId: "v1",
    status: "Entregue",
    openedAt: "2026-03-12",
    completedAt: "2026-03-13",
    entryMileage: 64820,
    complaint: "Ar-condicionado com baixa eficiência.",
    diagnosis: "Carga de gás baixa, sem vazamento aparente.",
    findings: "Filtro de cabine saturado.",
    notes: "Serviço entregue.",
    team: ["Diego"],
    evidence: [],
    budget: [
      {
        id: "i13",
        type: "Serviço",
        name: "Higienização e recarga do ar",
        price: 450,
        approval: "Aprovado",
        executed: true,
      },
      {
        id: "i14",
        type: "Peça",
        name: "Filtro de cabine",
        cost: 70,
        price: 91,
        approval: "Aprovado",
        availability: "Disponível",
        executed: true,
      },
    ],
    payment: { amount: 541, method: "Cartão", status: "Pago", date: "2026-03-13" },
    statusHistory: [
      { id: "s-1039-1", from: "Recebido", to: "Em diagnóstico", at: "2026-03-12T09:20:00-03:00" },
      {
        id: "s-1039-2",
        from: "Em diagnóstico",
        to: "Em manutenção",
        at: "2026-03-12T13:10:00-03:00",
      },
      {
        id: "s-1039-3",
        from: "Em manutenção",
        to: "Serviço concluído",
        at: "2026-03-13T11:30:00-03:00",
      },
      {
        id: "s-1039-4",
        from: "Serviço concluído",
        to: "Aguardando retirada",
        at: "2026-03-13T12:00:00-03:00",
      },
      {
        id: "s-1039-5",
        from: "Aguardando retirada",
        to: "Entregue",
        at: "2026-03-13T17:10:00-03:00",
      },
    ],
    activities: [
      {
        id: "a-1039-1",
        type: "created",
        description: "OS criada",
        at: "2026-03-12T08:55:00-03:00",
      },
      {
        id: "a-1039-2",
        type: "diagnosis",
        description: "Diagnóstico registrado",
        at: "2026-03-12T09:20:00-03:00",
      },
      {
        id: "a-1039-3",
        type: "budget",
        description: "Itens do orçamento aprovados",
        at: "2026-03-12T11:05:00-03:00",
      },
      {
        id: "a-1039-4",
        type: "execution",
        description: "Serviços marcados como executados",
        at: "2026-03-13T11:20:00-03:00",
      },
      {
        id: "a-1039-5",
        type: "payment",
        description: "Pagamento registrado por Cartão",
        at: "2026-03-13T16:50:00-03:00",
      },
      {
        id: "a-1039-6",
        type: "status",
        description: "Status alterado para Entregue",
        at: "2026-03-13T17:10:00-03:00",
      },
    ],
    updatedAt: "2026-03-13T17:10:00-03:00",
  },
];

export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const parsePilotDate = (value: unknown, calendarDate = false): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = calendarDate && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00Z`
    : value;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const formatDate = (value: unknown) => {
  const date = parsePilotDate(value, true);
  return date
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date)
    : "—";
};

export const formatDateTime = (value: unknown) => {
  const date = parsePilotDate(value);
  return date
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "—";
};

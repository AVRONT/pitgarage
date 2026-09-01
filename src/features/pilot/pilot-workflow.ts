import { orderStatuses, type OrderStatus, type ServiceOrder } from "./pilot-data";

export type WorkflowTab = "overview" | "diagnosis" | "budget" | "execution" | "payment";
export type WorkflowActionId =
  | "start-diagnosis"
  | "record-diagnosis"
  | "create-budget"
  | "submit-approval"
  | "record-decisions"
  | "resolve-parts"
  | "start-maintenance"
  | "execute-services"
  | "complete-service"
  | "prepare-pickup"
  | "confirm-delivery"
  | "review-history";

export interface WorkflowAction {
  id: WorkflowActionId;
  label: string;
  tab: WorkflowTab;
  targetStatus?: OrderStatus;
  confirmation?: string;
}

export interface WorkflowIssue {
  level: "blocker" | "warning";
  message: string;
}

export interface WorkflowEvaluation {
  currentIndex: number;
  approvedCount: number;
  executedCount: number;
  pendingExecutionCount: number;
  waitingApprovalCount: number;
  blockingPartCount: number;
  paymentPending: boolean;
  blockers: string[];
  warnings: string[];
  nextAction: WorkflowAction;
  recommendedStatus?: OrderStatus;
  inconsistency?: string;
}

const statusIndex = (status: OrderStatus) => orderStatuses.indexOf(status);
const isPartBlocked = (item: ServiceOrder["budget"][number]) =>
  item.type === "Peça" && item.approval === "Aprovado" && item.availability !== "Disponível";

export function getStatusPrerequisites(order: ServiceOrder, target: OrderStatus): string[] {
  const approved = order.budget.filter((item) => item.approval === "Aprovado");
  const waiting = order.budget.filter((item) => item.approval === "Aguardando aprovação");
  const missing: string[] = [];
  const targetIndex = statusIndex(target);

  if (targetIndex >= statusIndex("Aguardando aprovação")) {
    if (!order.diagnosis.trim()) missing.push("registrar o diagnóstico");
    if (!order.budget.length) missing.push("montar o orçamento");
  }
  if (targetIndex >= statusIndex("Aguardando peça")) {
    if (waiting.length) missing.push(`registrar a decisão de ${waiting.length} item(ns)`);
    if (!approved.length) missing.push("ter ao menos um item aprovado");
  }
  if (targetIndex >= statusIndex("Em manutenção")) {
    const blockedParts = approved.filter(isPartBlocked).length;
    if (blockedParts) missing.push(`disponibilizar ${blockedParts} peça(s) aprovada(s)`);
  }
  if (targetIndex >= statusIndex("Serviço concluído")) {
    const pending = approved.filter((item) => !item.executed).length;
    if (pending) missing.push(`concluir ${pending} serviço(s) aprovado(s)`);
  }
  if (targetIndex >= statusIndex("Aguardando retirada") && !order.completedAt) {
    missing.push("concluir formalmente o serviço");
  }
  return missing;
}

export function evaluateOrderWorkflow(order: ServiceOrder): WorkflowEvaluation {
  const approved = order.budget.filter((item) => item.approval === "Aprovado");
  const waitingApprovalCount = order.budget.filter(
    (item) => item.approval === "Aguardando aprovação",
  ).length;
  const executedCount = approved.filter((item) => item.executed).length;
  const blockingPartCount = approved.filter(isPartBlocked).length;
  const paymentPending = !order.payment || order.payment.status !== "Pago";
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!order.diagnosis.trim()) blockers.push("Diagnóstico ainda não registrado.");
  if (!order.budget.length) blockers.push("Orçamento ainda não montado.");
  if (waitingApprovalCount)
    blockers.push(`${waitingApprovalCount} item(ns) aguardando aprovação do cliente.`);
  if (blockingPartCount)
    blockers.push(`${blockingPartCount} peça(s) aprovada(s) ainda indisponível(is).`);
  if (approved.length && executedCount < approved.length)
    blockers.push(`${executedCount} de ${approved.length} serviços aprovados concluídos.`);
  if (!order.team.length) warnings.push("Responsável ainda não definido.");
  if (paymentPending) warnings.push("Pagamento ainda não registrado como pago.");
  if (order.budget.length && !waitingApprovalCount && !approved.length)
    warnings.push(
      "Nenhum item foi aprovado pelo cliente; o encerramento deste caso segue pendente de validação.",
    );

  let nextAction: WorkflowAction;
  if (order.status === "Recebido") {
    nextAction = {
      id: "start-diagnosis",
      label: "Iniciar diagnóstico",
      tab: "diagnosis",
      targetStatus: "Em diagnóstico",
    };
  } else if (!order.diagnosis.trim()) {
    nextAction = { id: "record-diagnosis", label: "Registrar diagnóstico", tab: "diagnosis" };
  } else if (!order.budget.length) {
    nextAction = { id: "create-budget", label: "Montar orçamento", tab: "budget" };
  } else if (order.status === "Em diagnóstico") {
    nextAction = {
      id: "submit-approval",
      label: "Aguardar aprovação do cliente",
      tab: "budget",
      targetStatus: "Aguardando aprovação",
      confirmation:
        "Confirmar que o orçamento foi colocado em aprovação? Não há envio real pelo sistema.",
    };
  } else if (waitingApprovalCount) {
    nextAction = { id: "record-decisions", label: "Registrar decisões do cliente", tab: "budget" };
  } else if (!approved.length) {
    nextAction = { id: "record-decisions", label: "Revisar decisões do cliente", tab: "budget" };
  } else if (blockingPartCount) {
    nextAction = {
      id: "resolve-parts",
      label: "Atualizar disponibilidade das peças",
      tab: "budget",
      targetStatus: "Aguardando peça",
    };
  } else if (order.status === "Aguardando aprovação" || order.status === "Aguardando peça") {
    nextAction = {
      id: "start-maintenance",
      label: "Iniciar manutenção",
      tab: "execution",
      targetStatus: "Em manutenção",
    };
  } else if (executedCount < approved.length) {
    nextAction = { id: "execute-services", label: "Executar serviços aprovados", tab: "execution" };
  } else if (order.status === "Em manutenção") {
    nextAction = {
      id: "complete-service",
      label: "Concluir serviço",
      tab: "execution",
      targetStatus: "Serviço concluído",
      confirmation: "Todos os itens aprovados foram executados. Confirmar a conclusão do serviço?",
    };
  } else if (order.status === "Serviço concluído") {
    nextAction = {
      id: "prepare-pickup",
      label: "Preparar retirada",
      tab: "payment",
      targetStatus: "Aguardando retirada",
      confirmation:
        "Confirmar que o veículo está pronto para retirada? O pagamento não bloqueia esta ação no piloto.",
    };
  } else if (order.status === "Aguardando retirada") {
    nextAction = {
      id: "confirm-delivery",
      label: "Confirmar entrega do veículo",
      tab: "payment",
      targetStatus: "Entregue",
      confirmation: paymentPending
        ? "O pagamento está pendente. Confirmar mesmo assim a entrega do veículo?"
        : "Confirmar a entrega do veículo ao cliente?",
    };
  } else {
    nextAction = { id: "review-history", label: "Consultar histórico", tab: "overview" };
  }

  let recommendedStatus: OrderStatus | undefined;
  const currentIndex = statusIndex(order.status);
  if (
    currentIndex > statusIndex("Em diagnóstico") &&
    (!order.diagnosis.trim() || !order.budget.length)
  )
    recommendedStatus = "Em diagnóstico";
  else if (currentIndex > statusIndex("Aguardando aprovação") && waitingApprovalCount)
    recommendedStatus = "Aguardando aprovação";
  else if (currentIndex > statusIndex("Aguardando peça") && blockingPartCount)
    recommendedStatus = "Aguardando peça";
  else if (currentIndex > statusIndex("Em manutenção") && approved.some((item) => !item.executed))
    recommendedStatus = "Em manutenção";
  else if (currentIndex >= statusIndex("Aguardando retirada") && !order.completedAt)
    recommendedStatus = "Serviço concluído";

  return {
    currentIndex,
    approvedCount: approved.length,
    executedCount,
    pendingExecutionCount: approved.length - executedCount,
    waitingApprovalCount,
    blockingPartCount,
    paymentPending,
    blockers,
    warnings,
    nextAction,
    recommendedStatus,
    inconsistency: recommendedStatus
      ? `Esta OS está em “${order.status}”, mas seus dados indicam “${recommendedStatus}”.`
      : undefined,
  };
}

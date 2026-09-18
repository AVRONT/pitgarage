import { CheckCircle2, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  formatDate,
  money,
  orderWarrantyDays,
  warrantyDeadline,
  type Customer,
  type Vehicle,
  type ServiceOrder,
} from "./pilot-data";

import { WorkshopIdentity } from "./workshop-document-header";
import { type Workshop } from "./workshop-data";
import { paymentSummary } from "./payment-model";

export function FinalOrderSummary({
  order,
  customer,
  vehicle,
  workshop,
  open,
  onOpenChange,
}: {
  order: ServiceOrder;
  customer: Customer;
  vehicle: Vehicle;
  workshop: Workshop;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const summary = paymentSummary(order);
  const warrantyEnd = warrantyDeadline(order);
  const delivered = order.status === "Entregue";

  const groups = [
    {
      title: "Serviços realizados",
      items: order.budget.filter((item) => item.type === "Serviço" && item.executed),
    },
    {
      title: "Peças utilizadas",
      items: order.budget.filter((item) => item.type === "Peça" && item.executed),
    },
    {
      title: "Itens não realizados",
      items: order.budget.filter((item) => !item.executed || item.approval === "Recusado"),
    },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="client-quote-print max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        <DialogTitle className="sr-only no-print">Resumo final · {order.id}</DialogTitle>
        <DialogDescription className="sr-only no-print">
          Documento de conclusão da ordem de serviço, somente leitura.
        </DialogDescription>
        <article className="document-paper bg-white text-slate-900">
          <header className="document-header bg-slate-900 p-6 pr-12 text-white md:p-9">
            <WorkshopIdentity workshop={order.workshopSnapshot ?? workshop} />
            <div className="mt-7 flex flex-col gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-orange-300">Ordem de serviço · {order.id}</p>
                <h2 className="mt-1 text-2xl font-bold">
                  {delivered ? "OS finalizada" : "Serviço concluído"}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {order.completedAt
                    ? `Conclusão registrada em ${formatDate(order.completedAt)}`
                    : "Conclusão sem data registrada"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                {order.status}
              </div>
            </div>
          </header>
          <div className="space-y-6 p-6 md:p-9">
            <div className="no-print flex justify-end">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir resumo
              </Button>
            </div>
            <dl className="grid gap-5 rounded-lg border border-slate-200 bg-slate-50/60 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Cliente", customer.name],
                ["Veículo", `${vehicle.brand} ${vehicle.model}`],
                ["Placa", vehicle.plate],
                ["Quilometragem na entrada", `${order.entryMileage.toLocaleString("pt-BR")} km`],
                ["Responsáveis", order.team.join(", ") || "Não informados"],
                ["Conclusão", order.completedAt ? formatDate(order.completedAt) : "Não registrada"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 break-words">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-6 md:grid-cols-2">
              <section>
                <h3 className="font-bold">Problema relatado</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {order.complaint || "Não informado."}
                </p>
              </section>
              <section>
                <h3 className="font-bold">Diagnóstico</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {order.diagnosis || "Não registrado."}
                </p>
                {order.findings && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                    {order.findings}
                  </p>
                )}
              </section>
            </div>
            {groups.map((group) => (
              <section key={group.title}>
                <h3 className="border-b pb-2 font-bold">{group.title}</h3>
                {group.items.length ? (
                  <ul className="divide-y">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                        <div className="min-w-0 break-words">
                          <p className="font-medium">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.approval} ·{" "}
                            {item.executed ? "Execução registrada" : "Sem execução registrada"}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {money(item.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Nenhum item registrado nesta categoria.
                  </p>
                )}
              </section>
            ))}
            <section className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold">Fechamento da OS</h3>
                  <span
                    className={
                      summary.balance > 0
                        ? "text-sm font-semibold text-amber-700"
                        : "text-sm font-semibold text-emerald-700"
                    }
                  >
                    {summary.balance > 0 ? "Pagamento pendente" : "Pagamento em dia"}
                  </span>
                </div>
              </div>
              <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
                {[
                  ["Total da OS", summary.total],
                  ["Valor recebido", summary.paid],
                  ["Falta receber", summary.balance],
                ].map(([label, value]) => (
                  <div key={String(label)} className="bg-white p-5">
                    <p className="text-xs font-semibold text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-bold tabular-nums text-slate-950">
                      {money(Number(value))}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 bg-white px-5 py-4 text-sm text-slate-600">
                <p className="flex justify-between gap-4">
                  <span>Serviços e peças</span>
                  <span>{money(summary.subtotal)}</span>
                </p>
                {summary.discount > 0 && (
                  <p className="flex justify-between gap-4">
                    <span>Desconto</span>
                    <span>− {money(summary.discount)}</span>
                  </p>
                )}
                {order.payment?.date && (
                  <p>Pagamento registrado em {formatDate(order.payment.date)}.</p>
                )}
              </div>
            </section>
            <section className="rounded-lg border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-bold">Garantia do serviço</h3>
                  <p className="text-sm text-slate-500">
                    Período registrado conforme as regras atuais da OS.
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Período</dt>
                  <dd className="mt-1 font-semibold">{orderWarrantyDays(order)} dias</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Conclusão</dt>
                  <dd className="mt-1 font-semibold">
                    {order.completedAt ? formatDate(order.completedAt) : "Não registrada"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Garantia até</dt>
                  <dd className="mt-1 font-semibold">
                    {warrantyEnd
                      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(warrantyEnd)
                      : "Não calculada"}
                  </dd>
                </div>
              </dl>
            </section>
            <footer className="border-t pt-4 text-xs leading-relaxed text-slate-500">
              Este resumo reflete os registros atuais da OS e pode ser usado para consulta e
              compartilhamento. Não substitui documento fiscal nem termo contratual de garantia.
            </footer>
          </div>
        </article>
      </DialogContent>
    </Dialog>
  );
}

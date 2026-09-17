import { Printer } from "lucide-react";
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

  const groups = [
    {
      title: "Serviços executados",
      items: order.budget.filter((item) => item.type === "Serviço" && item.executed),
    },
    {
      title: "Peças utilizadas",
      items: order.budget.filter((item) => item.type === "Peça" && item.executed),
    },
    {
      title: "Itens recusados / sem execução registrada",
      items: order.budget.filter((item) => !item.executed || item.approval === "Recusado"),
    },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="client-quote-print max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        <DialogTitle className="sr-only no-print">Resumo final · {order.id}</DialogTitle>
        <DialogDescription className="sr-only no-print">
          Documento demonstrativo, somente leitura.
        </DialogDescription>
        <article className="document-paper bg-white text-slate-900">
          <header className="document-header bg-slate-900 p-6 pr-12 text-white md:p-9">
            <WorkshopIdentity workshop={order.workshopSnapshot ?? workshop} />
            <p className="mt-6 text-sm font-semibold uppercase tracking-wider">
              Resumo final · {order.id}
            </p>
            <p className="mt-1 text-sm">{order.status}</p>
          </header>
          <div className="space-y-6 p-6 md:p-9">
            <div className="no-print flex justify-end">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir resumo
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-5 rounded-md border p-5">
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
            <section>
              <h3 className="font-bold">Problema relatado</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {order.complaint || "Não informado."}
              </p>
            </section>
            <section>
              <h3 className="font-bold">Diagnóstico</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                {order.diagnosis || "Não registrado."}
              </p>
              {order.findings && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{order.findings}</p>
              )}
            </section>
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
                        <span className="shrink-0 tabular-nums">{money(item.price)}</span>
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
            <section className="rounded-md border border-orange-200 bg-orange-50 p-5">
              <p className="flex justify-between gap-4 text-sm"><span>Serviços e peças</span><span>{money(summary.subtotal)}</span></p>
              {summary.discount > 0 && <p className="mt-2 flex justify-between gap-4 text-sm"><span>Desconto</span><span>− {money(summary.discount)}</span></p>}
              <h3 className="mt-3 text-sm font-semibold">Total final</h3>
              <p className="mt-1 text-2xl font-bold tabular-nums">{money(summary.total)}</p>
              <p className="mt-3 text-sm">
                Pagamento:{" "}
                {summary.status} · Recebido: {money(summary.paid)} · Saldo: {money(summary.balance)}
              </p>
              {order.payment?.date && (
                <p className="mt-1 text-sm">
                  Data do pagamento registrado: {formatDate(order.payment.date)}
                </p>
              )}
            </section>
            <section>
              <h3 className="font-bold">Garantia demonstrativa</h3>
              <p className="mt-2 text-sm">
                {warrantyEnd
                  ? `${orderWarrantyDays(order)} dias após a conclusão, até ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(warrantyEnd)}. ${warrantyEnd >= new Date("2026-09-01T12:00:00Z") ? "ATIVA" : "EXPIRADA"} na data de referência do piloto (01/09/2026).`
                  : "Sem data de conclusão registrada para calcular a garantia."}
              </p>
            </section>
            <footer className="border-t pt-4 text-xs text-slate-500">
              Documento demonstrativo do PitGarage. Reflete os registros atuais da OS; não substitui
              documento fiscal nem termo definitivo de garantia.
            </footer>
          </div>
        </article>
      </DialogContent>
    </Dialog>
  );
}

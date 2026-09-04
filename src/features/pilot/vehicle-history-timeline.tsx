import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { money, type ServiceOrder } from "./pilot-data";
import { historyDate, historyEntry, historyMileage } from "./vehicle-history";

export function VehicleHistory({
  orders,
  onOrder,
  renderStatus,
}: {
  orders: ServiceOrder[];
  onOrder: (id: string) => void;
  renderStatus: (status: ServiceOrder["status"]) => ReactNode;
}) {
  return (
    <section aria-labelledby="vehicle-history-title" className="min-w-0">
      <h2 id="vehicle-history-title" className="text-xl font-bold">
        Histórico do veículo
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Atendimentos do mais recente ao mais antigo.
      </p>
      {!orders.length ? (
        <p className="mt-5 rounded-md border bg-card p-6 text-sm text-muted-foreground">
          Este veículo ainda não possui histórico de serviços.
        </p>
      ) : (
        <ol className="mt-5 ml-2 space-y-4 border-l border-border pl-5">
          {orders.map((order) => {
            const entry = historyEntry(order);
            return (
              <li key={order.id} className="relative min-w-0">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[26px] top-6 h-2.5 w-2.5 rounded-full ${entry.completed ? "bg-emerald-600" : "bg-primary"}`}
                />
                <article className="rounded-md border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Entrada: {historyDate(order.openedAt)} ·{" "}
                        {historyMileage(order.entryMileage)}
                      </p>
                      <h3 className="mt-1 font-bold">{order.id}</h3>
                    </div>
                    {renderStatus(order.status)}
                  </div>
                  <p
                    className={`mt-2 text-xs font-medium ${entry.completed ? "text-emerald-700" : "text-primary"}`}
                  >
                    {entry.completed
                      ? `Atendimento concluído · Conclusão: ${historyDate(order.completedAt)}`
                      : "Em andamento · atendimento ainda não concluído"}
                  </p>
                  {!entry.completed && order.completedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Data de conclusão registrada anteriormente: {historyDate(order.completedAt)}
                    </p>
                  )}
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Problema relatado</dt>
                      <dd className="mt-1 line-clamp-2 break-words">
                        {order.complaint || "Não informado"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Diagnóstico</dt>
                      <dd className="mt-1 line-clamp-2 break-words">
                        {order.diagnosis || "Não registrado"}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    Execução registrada: {entry.services.length} serviço(s) · {entry.parts.length}{" "}
                    peça(s) · {entry.evidenceCount} evidência(s)
                  </p>
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer rounded-sm py-2 font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      Detalhes do atendimento
                    </summary>
                    <div className="mt-3 space-y-4">
                      {[
                        {
                          title: "Serviços executados",
                          items: entry.services,
                          empty: "Nenhum serviço com execução registrada.",
                        },
                        {
                          title: "Peças utilizadas",
                          items: entry.parts,
                          empty: "Nenhuma peça com utilização registrada.",
                        },
                      ].map((group) => (
                        <section key={group.title}>
                          <h4 className="font-semibold">{group.title}</h4>
                          {group.items.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                              {group.items.map((item, index) => (
                                <li key={`${item.id}-${index}`} className="break-words">
                                  {item.name || "Item sem descrição"}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-muted-foreground">{group.empty}</p>
                          )}
                        </section>
                      ))}
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">
                            Responsáveis registrados
                          </dt>
                          <dd className="mt-1 break-words">{entry.team || "Não informados"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            Total aprovado no orçamento
                          </dt>
                          <dd className="mt-1 font-semibold">
                            {entry.approvedTotal === null
                              ? "Não disponível"
                              : money(entry.approvedTotal)}
                          </dd>
                          <dd className="mt-1 text-xs text-muted-foreground">
                            Não comprova execução ou pagamento.
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Garantia</dt>
                          <dd className="mt-1">Sem registro específico de garantia.</dd>
                          <dd className="mt-1 text-xs text-muted-foreground">
                            A simulação da OS não é uma garantia registrada.
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">Evidências</dt>
                          <dd className="mt-1">
                            {entry.evidenceCount
                              ? `${entry.evidenceCount} registro(s) na ordem completa`
                              : "Nenhuma evidência registrada"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </details>
                  <Button variant="outline" className="mt-3" onClick={() => onOrder(order.id)}>
                    Ver ordem completa<span className="sr-only"> · {order.id}</span>
                  </Button>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

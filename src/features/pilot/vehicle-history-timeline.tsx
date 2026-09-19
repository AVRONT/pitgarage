import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Check, Circle } from "lucide-react";
import type { ServiceOrder } from "./pilot-data";
import { historyDate, historyEntry, historyMileage } from "./vehicle-history";

export function VehicleHistory({
  orders,
  onOrder,
  onNewOrder,
  renderStatus,
}: {
  orders: ServiceOrder[];
  onOrder: (id: string) => void;
  onNewOrder: () => void;
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
        <div className="mt-5 rounded-lg border border-dashed bg-muted/20 px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Este veículo ainda não possui histórico de serviços.
          </p>
          <Button className="mt-4" onClick={onNewOrder}>
            Nova OS
          </Button>
        </div>
      ) : (
        <ol className="mt-5 ml-2 border-l border-border pl-5">
          {orders.map((order) => {
            const entry = historyEntry(order);
            return (
              <li key={order.id} className="relative min-w-0 pb-7 last:pb-0">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${entry.completed ? "bg-emerald-600" : "bg-primary"}`}
                />
                <article className="min-w-0 border-b border-border/70 pb-7 last:border-b-0 last:pb-0">
                  <p className="text-sm font-semibold text-foreground">
                    {historyDate(order.openedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{order.id}</h3>
                    {renderStatus(order.status)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {historyMileage(order.entryMileage)}
                    {entry.completed && order.completedAt
                      ? ` · Concluída em ${historyDate(order.completedAt)}`
                      : " · Atendimento em andamento"}
                  </p>

                  <div className="mt-4 space-y-4 text-sm">
                    {order.complaint.trim() && (
                      <section>
                        <h4 className="text-xs font-semibold text-muted-foreground">
                          Problema relatado
                        </h4>
                        <p className="mt-1 break-words leading-relaxed">{order.complaint}</p>
                      </section>
                    )}

                    <section>
                      <h4 className="text-xs font-semibold text-muted-foreground">
                        Serviços realizados
                      </h4>
                      {entry.services.length ? (
                        <ul className="mt-1.5 space-y-1.5">
                          {entry.services.map((item, index) => (
                            <li key={`${item.id}-${index}`} className="flex gap-2 break-words">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              <span>{item.name || "Item sem descrição"}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-muted-foreground">
                          Nenhum serviço com execução registrada.
                        </p>
                      )}
                    </section>

                    <section>
                      <h4 className="text-xs font-semibold text-muted-foreground">
                        Peças utilizadas
                      </h4>
                      {entry.parts.length ? (
                        <ul className="mt-1.5 space-y-1.5">
                          {entry.parts.map((item, index) => (
                            <li key={`${item.id}-${index}`} className="flex gap-2 break-words">
                              <Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-current text-muted-foreground" />
                              <span>{item.name || "Item sem descrição"}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-muted-foreground">
                          Nenhuma peça com utilização registrada.
                        </p>
                      )}
                    </section>

                    {order.diagnosis.trim() && (
                      <section>
                        <h4 className="text-xs font-semibold text-muted-foreground">Diagnóstico</h4>
                        <p className="mt-1 break-words leading-relaxed">{order.diagnosis}</p>
                      </section>
                    )}
                    {order.findings.trim() && (
                      <section>
                        <h4 className="text-xs font-semibold text-muted-foreground">Constatações</h4>
                        <p className="mt-1 break-words leading-relaxed">{order.findings}</p>
                      </section>
                    )}
                    {order.notes.trim() && (
                      <section>
                        <h4 className="text-xs font-semibold text-muted-foreground">Observações</h4>
                        <p className="mt-1 break-words leading-relaxed">{order.notes}</p>
                      </section>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 w-full sm:w-auto"
                    onClick={() => onOrder(order.id)}
                  >
                    Ver OS completa<span className="sr-only"> · {order.id}</span>
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

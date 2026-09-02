import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkshopIdentity } from "./workshop-document-header";
import { type Workshop } from "./workshop-data";
import { money } from "./pilot-data";

// Presentation fixture only. Never inserted into the operational orders or localStorage.
const exampleItems = [
  { name: "Troca de óleo", price: 180 },
  { name: "Filtro de óleo", price: 70 },
  { name: "Mão de obra", price: 150 },
];

export function WorkshopDocumentPreview({ workshop }: { workshop: Workshop }) {
  return (
    <aside className="min-w-0 xl:sticky xl:top-24" aria-label="Prévia dos documentos">
      <Tabs defaultValue="quote">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Seus documentos</h2>
          <TabsList aria-label="Tipo de documento">
            <TabsTrigger value="quote">Orçamento</TabsTrigger>
            <TabsTrigger value="summary">Resumo da OS</TabsTrigger>
          </TabsList>
        </div>
        {["quote", "summary"].map((mode) => (
          <TabsContent key={mode} value={mode}>
            <p className="mb-3 text-xs text-muted-foreground">
              Prévia {mode === "quote" ? "do orçamento" : "do resumo da OS"} · exemplo fictício, sem
              vínculo com atendimentos.
            </p>
            <article
              className="overflow-hidden border bg-white text-slate-900 shadow-sm"
              aria-label={mode === "quote" ? "Prévia do orçamento" : "Prévia do resumo da OS"}
            >
              <header className="document-header border-b-2 border-orange-700 px-5 py-6 sm:px-7">
                <WorkshopIdentity workshop={workshop} />
                <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-bold">
                    {mode === "quote" ? "Orçamento" : "Resumo final"}
                  </h3>
                  <span className="text-sm font-semibold text-orange-800">#OS-1052 · exemplo</span>
                </div>
              </header>
              <div className="space-y-5 p-5 sm:p-7">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Cliente", "João da Silva"],
                    ["Veículo", "Honda Civic 2020"],
                    ["Placa", "ABC1D23"],
                    ["Quilometragem", "72.000 km"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="border-t pt-4 text-sm">
                  <p className="font-semibold">
                    {mode === "quote" ? "Problema relatado" : "Diagnóstico"}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {mode === "quote"
                      ? "Revisão e troca de óleo."
                      : "Manutenção preventiva, sem falhas adicionais."}
                  </p>
                </div>
                <section>
                  <h4 className="mb-2 text-sm font-semibold">
                    {mode === "quote"
                      ? "Serviços e peças"
                      : "Serviços executados e peças utilizadas"}
                  </h4>
                  <ul className="divide-y border-y">
                    {exampleItems.map((item) => (
                      <li key={item.name} className="flex justify-between gap-3 py-3 text-sm">
                        <div>
                          <p>{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {mode === "quote"
                              ? "Aguardando aprovação"
                              : "Aprovado · execução registrada"}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums">{money(item.price)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">
                    {mode === "quote" ? "Total orçado" : "Valor final"}
                  </span>
                  <strong className="text-2xl tabular-nums">
                    {money(exampleItems.reduce((sum, item) => sum + item.price, 0))}
                  </strong>
                </div>
                {mode === "summary" && (
                  <p className="border-t pt-4 text-sm text-slate-600">
                    Responsável: equipe de exemplo
                    <br />
                    Pagamento: PIX · Pago
                    <br />
                    Conclusão: 01/09/2026
                  </p>
                )}
                <p className="border-t pt-4 text-xs text-slate-500">
                  Dados de exemplo para conferir a apresentação. Não é um documento fiscal.
                </p>
              </div>
            </article>
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  );
}

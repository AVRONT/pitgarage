# Três ajustes controlados no PitGarage — plano para autorização

## 3. Bug de excluir item do orçamento (diagnóstico fechado)

### Onde está falhando

- Componente: `src/features/pilot/remove-budget-item.tsx` (ícone de lixeira + confirmação).
- Estado: `savePart` em `src/features/pilot/pilot-app.tsx` (linhas 682–737) e a trava
  `writeFailed` (linha 538).
- Camada de dados: `CloudOperationalRepository.savePartFinancial` →
  RPC `public.remove_budget_item(order_id, expected_version, item_id)`.
- Tradução de erro: `financialRpc` em `src/features/pilot/financial-api.ts`.

### Causa real encontrada

1. **Trava global de gravação que nunca é liberada.** Qualquer falha de gravação da OS
   (não só de orçamento) marca `writeFailed = true`. Isso só é desfeito quando a janela de
   conflito de versão é usada para recarregar a OS. Se a falha foi do tipo genérico
   (linha 697, mensagem "Não foi possível confirmar a gravação"), nenhuma janela aparece e a
   trava fica ligada até o F5. A partir daí a lixeira rejeita na hora, sem chamar o banco:
   é exatamente o sintoma de "botão não responde" / "loading trava".
2. **Divergência entre tela e banco.** Com a trava ligada, as ações que atualizam a tela antes
   de gravar (`persist`, linha 683, que retorna sem avisar nada) mostram a mudança na interface
   mas não gravam. É o sintoma de "item sai da tela e volta depois do F5".
3. **Erro real escondido.** `remove-budget-item.tsx` captura qualquer falha e mostra sempre a
   mesma frase "Recarregue a OS". E `financialRpc` traduz o erro de permissão de equipe (42501)
   como "Você não tem permissão financeira", que é a mensagem errada para este fluxo.
4. **Bloqueio legítimo sem explicação.** Fora das etapas Recebido / Em diagnóstico /
   Aguardando aprovação, ou em item já executado, a lixeira fica desabilitada — correto,
   mas sem dizer o motivo, parece defeito.

O RPC `remove_budget_item` está correto: trava a OS, confere a versão, apaga o registro
financeiro da peça, remove o item preservando a ordem e registra a atividade — tudo numa
transação. **Nada disso será recriado.**

### Correção proposta

- Liberar a trava de gravação de forma controlada: toda falha passa a oferecer "recarregar
  esta OS" (o mesmo caminho já existente do conflito de versão), que sincroniza com o banco e
  destrava; nunca mais fica travado silenciosamente até o F5.
- Nunca mostrar mudança na tela sem gravação confirmada: quando a gravação é recusada, a tela
  volta ao estado do banco e o aviso aparece.
- Mostrar o motivo real da recusa na confirmação de exclusão (sem permissão, etapa que não
  permite remover, versão desatualizada) e corrigir a mensagem de permissão de equipe.
- Explicar no próprio botão desabilitado por que aquele item não pode ser removido.
- Recalcular lista e total sempre a partir da resposta do banco.
- Proteções mantidas: item executado e etapas avançadas continuam bloqueados; cliente nunca
  remove nada; nada é afrouxado para o botão funcionar.

## 1. Garantia: 30 → 90 dias, com histórico preservado

Hoje o prazo está escrito direto no código, em dois pontos (`pilot-app.tsx` linha 2864 e
`final-order-summary.tsx` linha 27), e o texto "30 dias" aparece fixo nos dois documentos.
Nenhuma OS guarda o prazo com que foi fechada — por isso a constante sozinha não serve.

Plano:

- novo campo de snapshot na OS (`warranty_days`), gravado no momento em que a OS é marcada
  como concluída, junto com o snapshot da oficina que já existe;
- **backfill**: toda OS já concluída (com data de conclusão registrada) recebe 30 dias na
  própria migration, de forma explícita; OS ainda abertas ficam sem valor até a conclusão;
- OS locais/no navegador que já estejam concluídas também recebem 30 na leitura;
- constante única `warrantyDays = 90` em `pilot-data.ts`, usada por OS nova, orçamento avulso
  e documento comercial;
- o card de garantia e o documento final passam a ler **o snapshot da OS** quando existir, e
  só usam a constante quando ainda não houver conclusão. Documento histórico nunca depende
  da constante atual;
- os textos fixos "30 dias" passam a exibir o prazo lido, não um número escrito no código.

## 2. Orçamento avulso (ORC-X)

Reutiliza o modelo atual: itens de orçamento e a estrutura de custo/markup privado são
reaproveitados; aprovação por item, evidências, pagamento e status de OS não entram.

Modelo de dados:

- `public.quotes`: número próprio por sequência `ORC`, cliente, veículo opcional, descrição,
  observações, status (Rascunho, Enviado, Aprovado, Recusado, Expirado, Convertido), itens em
  JSON no mesmo formato do orçamento da OS, prazo de garantia gravado no orçamento, versão
  para concorrência, vínculo com a OS gerada, datas de criação/atualização;
- `public.quote_item_financials`: custo e markup privados, mesma regra da tabela de peças
  (somente quem tem permissão financeira lê);
- RPCs espelhando as da OS: criar orçamento, adicionar item, remover item (mesma camada de
  domínio da OS), atualizar status e `convert_quote_to_order` — transacional, cria a OS pela
  sequência normal, copia itens, quantidades, preços e financeiros, vincula, registra no
  histórico que veio de ORC-X, marca como convertido e mantém o orçamento consultável;
  segundo clique não cria uma segunda OS;
- RLS/GRANT: equipe interna administra; cliente não acessa custo, markup nem exclusões.

Frontend:

- tela "Orçamentos" simples (número, cliente, veículo, data, total, status, abrir);
- ação "Novo orçamento": cliente existente ou novo, veículo opcional, itens usando os
  componentes atuais de adicionar/remover item;
- documento comercial no layout atual, com dados centrais da oficina, total e garantia
  vigente, sem custo, markup, margem ou lucro;
- orçamento avulso não aparece como OS ativa, não entra no Dashboard, nos contadores,
  no faturamento nem no Financeiro.

## Migrations previstas (nenhuma aplicada ainda)

Serão **duas**, não uma:

1. **Garantia**: adiciona `warranty_days` em `service_orders` e faz o backfill explícito de
   30 dias nas OS já concluídas.
2. **Orçamento avulso**: `quotes`, `quote_item_financials`, sequência ORC, GRANT + RLS e as
   funções de criar, adicionar item, remover item, mudar status e converter em OS.

Nenhuma é destrutiva. Nenhum dado de teste será criado em produção; a conferência com OS e
orçamento reais fica como teste manual seu.

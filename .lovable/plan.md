# Três ajustes controlados no PitGarage

## 1. Garantia: 30 → 90 dias

Hoje **não existe fonte central**: o prazo está escrito diretamente em dois lugares
(`pilot-app.tsx` no card "Pagamento e garantia" e `final-order-summary.tsx` no documento final),
sempre como `+ 30` dias e o texto "30 dias".

Plano:

- criar uma constante única (ex. `warrantyDays = 90`) em `pilot-data.ts` e usá-la nos dois pontos,
  no orçamento avulso e no documento comercial;
- OS concluídas continuam intactas: o documento final já congela os dados da oficina na conclusão,
  e vou congelar também o prazo de garantia no momento da conclusão, para que OS antigas
  continuem exibindo os 30 dias com que foram fechadas;
- nenhum outro número "30" do código é tocado.

## 2. Orçamento avulso (ORC-X)

Sim, dá para reutilizar o modelo atual: os itens de orçamento e a estrutura financeira
(custo/markup privado) podem ser reaproveitados; a lógica de aprovação por item, evidências,
pagamento e status de OS **não** entra.

Novo modelo de dados (uma migration):

- `public.quotes`: número próprio (sequência `ORC`), cliente, veículo opcional, descrição,
  observações, status (`Rascunho`, `Enviado`, `Aprovado`, `Recusado`, `Expirado`, `Convertido`),
  itens em JSON no mesmo formato do orçamento da OS, garantia vigente, versão para concorrência,
  vínculo com a OS gerada;
- `public.quote_item_financials`: custo/markup privados, mesma regra da tabela atual de peças
  (somente quem tem permissão financeira lê);
- RPCs espelhando as da OS: criar, adicionar item, remover item, atualizar status e
  `convert_quote_to_order` (transacional, cria a OS pela sequência normal, copia itens,
  quantidades, preços e financeiros, vincula e marca o orçamento como convertido; segundo
  clique não cria segunda OS);
- RLS/GRANT: equipe interna administra; cliente não acessa custo, markup nem exclusões.

Frontend:

- nova tela "Orçamentos" (número, cliente, veículo, data, total, status, abrir);
- ação "Novo orçamento" com cliente existente ou novo, veículo opcional, itens reutilizando
  os componentes atuais de adicionar/remover item;
- documento comercial reutilizando o layout atual, com dados centrais da oficina, total e
  garantia de 90 dias, sem custo/markup/lucro;
- orçamento avulso não entra em OS ativas, Dashboard, contadores nem Financeiro.

## 3. Exclusão de item do orçamento

Analisei o fluxo atual (ícone → confirmação → `remove_budget_item` no banco → atualização da lista).
A arquitetura está correta e será preservada. O que encontrei de errado:

1. **Erro real escondido.** Qualquer falha da remoção mostra sempre a mesma frase
   ("Recarregue a OS…"), então o motivo verdadeiro (sem permissão, etapa que proíbe remover,
   versão desatualizada) nunca aparece. Também a camada financeira traduz o erro de permissão
   de equipe como "você não tem permissão financeira", o que confunde.
2. **Travamento global após um conflito.** Um conflito de versão marca a tela inteira como
   "gravação falhou": daí em diante todo botão de gravar recusa silenciosamente e o
   carregamento parece travado até dar F5.
3. **Bloqueio legítimo parecendo botão morto.** Depois que a OS sai das etapas iniciais
   (ou o item foi executado) a lixeira fica apagada, sem explicar o motivo.

Correção prevista (sem afrouxar proteção nenhuma):

- mostrar a mensagem real do banco na confirmação, com texto claro para cada caso;
- oferecer "recarregar esta OS" no próprio aviso de conflito e liberar a tela após recarregar,
  em vez de travar tudo;
- explicar no botão desabilitado por que aquele item não pode mais ser removido;
- garantir que a lista e o total são recalculados a partir da resposta do banco (fonte única),
  para não sobrar diferença entre tela e banco após F5.

## O que preciso de você

Antes de eu mexer, me diga qual sintoma você viu de fato ao excluir um item, porque isso decide
se a correção acima é suficiente ou se há uma quarta causa: o ícone não abriu a confirmação,
o botão ficou girando sem terminar, apareceu um aviso, ou o item voltou depois do F5?

## Migrations previstas

1. Garantia congelada na conclusão da OS (ajuste mínimo, se necessário).
2. Orçamento avulso: tabelas, sequência ORC, RLS/GRANT e funções (criar, itens, status, conversão).

Nenhuma migration destrutiva; nada de dados de teste em produção. Testes com OS/orçamento real
ficam como conferência manual sua.

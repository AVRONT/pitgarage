# Piloto v0.1.3 — fluxo operacional e rastreabilidade

## Objetivo

Sincronizar o status da ordem com todo o piloto e tornar a tela da OS mais útil durante a demonstração, sem backend, banco, API, Supabase ou arquitetura definitiva.

## Causa encontrada e correção

O progresso já calculava a posição a partir de `order.status`, mas diferentes áreas enviavam objetos completos da OS construídos com o snapshot da renderização. Uma atualização posterior poderia regravar dados anteriores, inclusive o status, causando regressão ou dessincronização aparente.

As alterações agora são funções aplicadas sobre a versão corrente da OS dentro da atualização central de `orders`. O campo `status` do objeto persistido é a única fonte de verdade para dropdown, barra, contador, dashboard, listagem e detalhes.

## Fluxo visual

Os oito estados provisórios continuam na mesma ordem. Etapas anteriores usam indicação de concluídas, a etapa atual recebe destaque e as futuras permanecem neutras. Avanços e regressões pelo dropdown atualizam imediatamente a barra e o contador e permanecem após reload.

O fluxo continua sujeito à validação da oficina e a regressão de status não é bloqueada nesta versão.

## Histórico e atividades

Cada mudança de status registra origem, destino e horário. A timeline também registra eventos relevantes:

- criação da OS;
- atualização de diagnóstico e evidências;
- inclusão e decisão de itens do orçamento;
- problema adicional;
- execução de serviço;
- pagamento;
- mudança de status e conclusão.

`updatedAt` muda apenas junto a esses eventos, não durante navegação.

## Visão rápida da OS

A aba Resumo reúne cliente, veículo, placa, quilometragem, responsável, problema, pendências, valores e atividades. O painel financeiro calcula somente com dados existentes:

- orçado: soma dos itens;
- aprovado e recusado: soma por decisão individual;
- pago: único registro local marcado como pago;
- pendente: aprovado menos pago, limitado a zero.

Esse cálculo não define pagamento parcial ou múltiplas formas, que continuam pendentes.

## Pendências e próxima ação

As pendências são derivadas de diagnóstico, decisões dos itens, responsável, peça e pagamento já existentes. Quando nenhuma for encontrada, a interface informa: “Nenhuma pendência operacional identificada.”

A próxima ação é apenas uma sugestão contextual por status. Os atalhos abrem a área relevante e não alteram automaticamente a OS.

## Busca e compatibilidade

A busca global também localiza o identificador da OS. Registros armazenados pelo Piloto v0.1.2 recebem `statusHistory`, `activities` e `updatedAt` quando ausentes. A adaptação preserva todos os campos existentes e mantém a mesma chave de `localStorage`; somente “Restaurar dados” substitui explicitamente o cenário.

## Dados demonstrativos

O cenário inclui uma OS recém recebida, OS aguardando aprovação, aguardando peça, em manutenção, concluída e entregue. Há exemplos com várias mudanças de status e timeline completa.

## Limitações e decisões temporárias

- estados e sugestões não são regras definitivas;
- atividades existem somente neste navegador;
- horários não possuem autoria ou autenticação;
- o resumo financeiro representa um único pagamento local;
- não há política definitiva de transições;
- o preview de orçamento como cliente não foi incluído para manter o escopo focado; permanece possibilidade futura.

## Próxima tarefa recomendada

Demonstrar o Piloto v0.1.3 e validar com a oficina os estados, pendências úteis, linguagem das atividades, próximas ações e informações essenciais do resumo antes de modelagem permanente.

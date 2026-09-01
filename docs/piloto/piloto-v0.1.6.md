# Piloto v0.1.6 — identidade visual profissional e redesign global

## Problema visual anterior

A v0.1.5 consolidou o workflow funcional, mas a interface ainda usava muitos cards grandes, cantos muito arredondados, sombras e padrões típicos de dashboard genérico. Listagens importantes tinham baixa densidade operacional e pouca diferenciação estrutural.

## Objetivo e direção escolhida

Esta versão aplica uma linguagem visual única de software profissional para oficina: estrutura em azul-marinho e grafite, ação em laranja queimado, fundo off-white, superfícies claras com bordas perceptíveis, sombras mínimas, tipografia compacta e detalhes industriais discretos.

## Padrões principais

- raio base reduzido para 8px e controles com aproximadamente 6px;
- botões sem sombras decorativas e com hierarquia preservada;
- cards apoiados em bordas e contraste de superfície;
- tabs em barra horizontal com indicador inferior;
- dialogs compactos, responsivos e com elevação moderada;
- tabelas operacionais com cabeçalhos, divisórias, hover sutil e adaptação para mobile;
- foco de teclado mais visível e badges semânticos compactos.

## Telas revisadas

Sidebar, header, busca global, visão geral, indicadores, serviços em andamento, atenção operacional, clientes, veículos, ordens de serviço, detalhes, workflow da OS, formulários, dialogs, alertas, painéis financeiros, timelines, estados vazios e visualização do orçamento passaram a compartilhar os mesmos padrões globais.

As listas de clientes, veículos, ordens e serviços em andamento ganharam estrutura de tabela no desktop e linhas compactas adaptativas em telas menores. Ícones de carro e moto continuam reservando o espaço em que uma miniatura poderá ser avaliada no futuro.

## Preservação funcional

O redesign não altera cálculos, validações, persistência, busca, orçamento, aprovação, peças, execução, pagamento, garantia ou histórico. `pilot-workflow.ts`, as ações sugeridas, transições, confirmações, correções de inconsistência e campos de rastreabilidade da v0.1.5 permanecem intactos.

## Imagens de veículos

APIs, scraping, imagens externas ou campos de imagem não foram adicionados intencionalmente. A decisão permanece para estudo separado.

## Responsividade e limitações

Tabelas ocultam cabeçalhos e mantêm linhas compactas no mobile; workflow e tabs conservam rolagem horizontal quando necessária. A versão continua sendo piloto local com dados fictícios e sem backend, autenticação ou arquitetura de produção.

## Próximos passos

Validar a identidade e a densidade com os usuários da oficina, incluindo uso em laptop, tablet e celular. Qualquer estudo de miniaturas de veículos deve ocorrer em tarefa própria.


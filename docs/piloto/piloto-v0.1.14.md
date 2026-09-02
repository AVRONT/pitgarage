# Piloto v0.1.14 — identidade visual da oficina piloto

Data: 02/09/2026. Evolução exclusivamente visual baseada na paleta informada da oficina Abraão & Salomão. Não adiciona regras ou funcionalidades.

## Paleta aplicada

| Papel | Cor |
| --- | --- |
| Fundo geral | `#F5F6F8` |
| Cards, dialogs e header | `#FFFFFF` |
| Superfície secundária | `#F0F2F5` |
| Bordas estruturais | `#D9DEE7` |
| Texto principal / secundário | `#1F2937` / `#667085` |
| Azul principal / hover / apoio | `#173F8F` / `#123473` / `#315EAD` |
| Vermelho principal / escuro | `#D3262E` / `#B51F26` |

A sidebar usa azul principal com seleção azul mais escura e textos claros. Campos usam borda `#8590A2`, mais contrastante que as divisórias. Sucesso usa texto `#166534` e fundo `#EDF7EF`; espera, `#92400E` e `#FFF7E6`; erro, `#B51F26` e `#FFF1F2`. Etapas concluídas usam verde `#15803D` com ícone branco. Essas variantes adaptam contraste, sem mudar a semântica dos estados.

Cabeçalhos de tabela e textos secundários durante hover de linhas usam `#5F687A` sobre cinza para reforçar contraste. Texto secundário sobre branco: 4,97:1; links azuis sobre fundo geral: 5,82:1; texto branco no botão principal: 9,79:1.

## Direção e alcance

- Grandes superfícies claras, cards brancos, bordas discretas, cantos contidos e pouca sombra. Tipografia, respiro e densidade operacional existentes preservados.
- Azul concentra navegação, ação principal, links, foco e etapa atual. Vermelho permanece na faixa da marca, pequenos segmentos dos cabeçalhos e no destaque de Atenção agora; não converte etapas normais em alertas.
- Tokens e compatibilidade centralizados em `src/styles.css`, seguindo a orientação da skill de Sites para reutilizar o tema e componentes existentes. Sem redesenhar tela por tela nem criar controles novos.
- Abrange Dashboard, Clientes, Veículos, lista/detalhe de OS, Nova OS, Configurações, tabelas, buscas, filtros, campos, botões, dialogs, tabs, badges, timeline, estados vazios e feedbacks.
- Textos antes claros sobre fundos escuros foram adaptados, inclusive totais coloridos e botões de foto/vídeo. Documentos mantêm branco, texto escuro e pequenos detalhes azul/vermelho; comportamento de impressão inalterado.
- Identificação visível atualizada para Piloto v0.1.14.

## Preservação e limites

Nenhuma alteração em funções, handlers, validações, workflow, regressão, autocomplete, cálculos, orçamento, diagnóstico, pagamento, garantia, histórico, `deletedAt` ou localStorage. Nenhuma dependência instalada.

As alterações locais anteriores foram mantidas e evoluídas apenas na apresentação solicitada. Documentos da v0.1.13 e de seu patch permanecem intactos; esta versão registra a substituição da paleta, sem apagar o histórico.

O nome PitGarage permanece. Não foi cadastrado o nome Abraão & Salomão nem alterado qualquer dado/configuração da oficina: a aproximação é visual. Ícone existente reutilizado, sem logo oficial ou identidade complexa. Não há novo seletor de temas. Todas as limitações funcionais do piloto continuam válidas.

## Validação

- Revisão no navegador em desktop 1440 × 1000 e tablet 834 × 1112: Dashboard, Clientes, Veículos, lista/detalhe da OS, Nova OS e Configurações com prévia.
- Orçamento da OS-1048 e resumo final da OS-1045, com conferência de impressão emulada clara e sem controles internos.
- Stepper mantém concluídas verdes, atual azul e futuras cinza; `prefers-reduced-motion` continua removendo transições.
- Navegação em contexto isolado, sem salvar cadastros/configurações; comparação do localStorage antes/depois e ausência de erros de execução conferidas. O armazenamento do usuário não foi acessado.
- Build, lint do TSX alterado e `git diff --check`. Avisos preexistentes do build permanecem fora do escopo.

A revisão não substitui teste em tablet físico, impressão em papel ou avaliação prolongada com operadores. Não foi executada próxima tarefa, commit, push ou publicação.

# Piloto v0.1.13 — patch visual grafite, azul e vermelho

Data: 02/09/2026. Ajuste exclusivamente visual sobre a v0.1.13. O documento original e todas as versões anteriores permanecem preservados.

## Paleta vigente

| Aplicação | Cor |
| --- | --- |
| Fundo principal | `#0B1220` |
| Sidebar e header | `#111827` |
| Cards, dialogs e superfícies | `#161E2E` |
| Superfície secundária, seleção e hover neutro | `#1B2535` |
| Bordas estruturais | `#2B3548` |
| Texto principal / secundário | `#F8FAFC` / `#94A3B8` |
| Ação principal / hover | `#2563EB` / `#1D4ED8` |
| Azul de apoio e foco | `#60A5FA` |
| Vermelho da marca / escuro | `#DC2626` / `#B91C1C` |

Campos conservam borda mais clara `#64748B` para identificação. Estados mantêm verde `#22C55E`, âmbar `#F59E0B` e vermelho `#EF4444`, com variantes claras de texto e fundos discretos para contraste. Não há mudança nos nomes ou significados dos estados.

A proporção 70–75% neutros, 15–20% azul e 5–10% vermelho/estados orienta a composição, não representa medição de pixels. A distribuição depende da tela e dos dados apresentados.

## Aplicação global

- Tokens e classes compartilhadas em `src/styles.css` propagam a paleta para Dashboard, Clientes, Veículos, lista/detalhe de OS, Nova OS, Configurações, buscas, filtros, cards, tabelas, campos, botões, tabs, dialogs, badges, estados vazios e feedbacks.
- Fundos anteriormente azulados de seleção, ícones e estados ativos agora usam superfície secundária neutra; azul permanece em texto, bordas e ações relevantes. Títulos auxiliares das páginas passam a texto secundário.
- Marca existente mantém ícone e azul, com faixa vermelha lateral mais perceptível. Cabeçalhos da aplicação e dos documentos recebem um pequeno segmento vermelho.
- Atenção agora tem borda superior vermelha, título/ícone em vermelho claro legível e acentos laterais nos itens. Esse destaque não cria uma classificação de urgência; aprovações pendentes continuam com a semântica existente e badges âmbar.
- Stepper mantém etapas concluídas verdes, atual azul e futuras cinza; lógica, conectores, animações e redução de movimento não foram alterados. Timeline mantém o comportamento existente.
- Orçamento, resumo final e prévias mantêm papel branco e texto escuro. Azul/vermelho apenas nos detalhes da identidade; controles internos continuam ocultos na impressão.

## Preservação

Código da aplicação recebe somente a classe `attention-panel` no Card existente. Demais mudanças de interface são CSS; nenhuma alteração em funções, handlers, dados fictícios, regras, cálculos, workflow, histórico, `deletedAt`, configurações ou localStorage. Nenhuma dependência adicionada. As limitações e decisões provisórias do piloto continuam válidas.

## Validação

- Revisão visual no navegador em desktop 1440 × 1000 e tablet 834 × 1112: Dashboard, Clientes, Veículos, lista/detalhe de OS, Nova OS e Configurações/prévia.
- Orçamento da OS-1048 e resumo final da OS-1045 revisados; impressão emulada nos dois documentos com fundo branco e nenhum botão/campo interno visível.
- Navegação realizada em contexto de navegador isolado, sem salvar ou restaurar cadastros. Comparação exata do armazenamento local antes/depois sem diferenças; nenhum erro de execução capturado. O armazenamento do navegador do usuário não foi acessado nem alterado.
- Build, lint do TSX alterado, formatação dos arquivos de código e `git diff --check` conferidos. Avisos preexistentes do build não fazem parte deste ajuste.

Não foi executada próxima tarefa, commit, push ou publicação.

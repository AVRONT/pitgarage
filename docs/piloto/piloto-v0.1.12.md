# Piloto v0.1.12 — refinamento visual profissional

Data: 02/09/2026. Escopo exclusivamente visual; sem alteração de regras ou fluxos.

## Paleta e aplicação

| Papel | Cor |
| --- | --- |
| Fundo principal | `#0F172A` |
| Sidebar/header | `#111827` |
| Superfícies | `#182233` |
| Bordas | `#2A3546` |
| Texto principal/secundário | `#F8FAFC` / `#94A3B8` |
| Ação/hover | `#2563EB` / `#1D4ED8` |
| Sucesso/atenção/erro | `#22C55E` / `#F59E0B` / `#EF4444` |

Tons derivados para contraste: foco `#60A5FA`, bordas dos campos `#64748B`, texto de estado azul `#93C5FD`, verde `#86EFAC`, âmbar `#FCD34D` e vermelho `#FCA5A5`, sobre fundos escuros correspondentes. Botão destrutivo usa `#B91C1C` para texto branco legível.

- Tokens e camada de compatibilidade em `styles.css` adaptam classes existentes sem reescrever as telas, incluindo diálogos renderizados fora da árvore principal.
- Button, Card, Input, Dialog, Tabs, badges, tabelas e navegação recebem a linguagem sóbria, com cantos próximos de 6 px e sombras discretas.
- Estados ativos azuis, sucesso/conclusão verdes, espera âmbar, erro/recusa vermelhos, neutros cinza. Nomes e regras permanecem iguais.
- Stepper muda somente cores; conectores, transições, ações e `prefers-reduced-motion` preservados.
- Orçamento, resumo e prévia usam `document-paper`, isolando a superfície clara. Cabeçalho e evidências também permanecem legíveis na impressão.

## Preservação

Nenhuma alteração no workflow, regressão, Nova OS/autocomplete, exclusão lógica, diagnóstico, orçamento, cálculos, aprovação, pagamento, garantia, timeline, configurações, restauração ou persistência. Sem migração, reset, backend ou dependência nova. Histórico e versões anteriores intactos.

## Validação

- Revisão visual de Dashboard, Nova OS, detalhe da OS, Clientes, Veículos e Configurações com prévia; desktop 1440 px e tablet 834 px.
- Orçamento OS-1048 e resumo OS-1045 em mídia de impressão: superfície branca e nenhum controle operacional visível.
- Contraste dos pares principais: texto secundário/superfície 6,23:1; botão principal 5,17:1; borda do campo/superfície 3,35:1; textos dos estados acima de 7:1. Não substitui auditoria integral de acessibilidade.
- Movimento reduzido mantém `transition-property: none` no stepper. Foco e desabilitados revisados.
- Comparação dos dados operacionais antes/depois no navegador isolado, sem modificar OS durante a revisão.
- Build, lint dos TSX alterados e `git diff --check`; avisos preexistentes do build não motivam correções fora do escopo.

## Próxima tarefa sugerida (não executada)

Validar conforto visual e leitura com os operadores nos dispositivos reais, considerando luz ambiente, teclado e documentos impressos.

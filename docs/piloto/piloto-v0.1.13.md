# Piloto v0.1.13 — acabamento de produto e identidade azul/vermelho

Data: 02/09/2026. Evolução de apresentação, sem novas regras de atendimento.

## Entregas

- Azul predominante, com pequeno traço vermelho na base do ícone de marca da navegação e do cabeçalho compartilhado dos documentos. Não indica erro, notificação ou ação destrutiva.
- Acabamento centralizado em `styles.css`: títulos mais contidos, pesos tipográficos moderados, alinhamento entre cabeçalhos/linhas de tabela, espaçamento consistente, badges compactos e chevrons discretos.
- Valor das OS alinhado à direita com números tabulares. Filtros e abertura das linhas não mudaram.
- Metadados de responsáveis/datas no detalhe da OS passam a texto secundário sem bordas concorrentes; cliente, veículo, status, resumo financeiro, pendências e próxima ação mantêm destaque.
- Componente de estado vazio compartilhado sem caixas redundantes; diferencia ausência de cadastros de busca/filtro sem resultados.
- Ações explícitas: Criar ordem de serviço e Salvar configurações. Terminologia operacional, confirmação e registro de pagamento preservados.
- Feedback existente de ações com borda discreta, largura adaptável e anúncio `role=status`/`aria-live=polite`. Sem nova dependência, modal ou carregamento artificial.

## Paleta

Mantidos: fundo `#0F172A`, navegação `#111827`, superfícies `#182233`, bordas `#2A3546`, texto `#F8FAFC`/`#94A3B8`, azul `#2563EB` e hover `#1D4ED8`. Assinatura vermelha `#DC2626`, com variante `#B91C1C`. Estados semânticos e tons acessíveis da v0.1.12 permanecem separados da marca.

## Cenário demonstrativo e compatibilidade

Nomes, veículos, valores e serviços revisados e mantidos por já constituírem exemplos plausíveis. Apenas e-mails padrão passaram a `example.com`, sem contato real. IDs, vínculos, preços, estados e atividades fictícias preservados.

Novos defaults são usados somente sem dados salvos ou após a restauração já existente, que exige confirmação. Nenhuma migração, reset ou gravação nova foi adicionada; contatos existentes no localStorage continuam os mesmos. Não foram usados dados pessoais do proprietário ou de cliente de teste.

## Validação

Revisão de Dashboard, Clientes, Veículos, lista/detalhe de OS, Nova OS, Configurações e documentos em desktop/tablet. Conferência de busca sem resultados, cadastros vazios, impressão clara, marca discreta e preservação dos dados operacionais durante navegação. Build, lint dos arquivos TS/TSX alterados e `git diff --check`.

## Limitações preservadas

Aplicação local demonstrativa; sem emissão fiscal, geração própria de PDF, snapshots, backend ou novas dependências. Pagamento, garantia, timeline, exclusão lógica e workflow mantêm as regras anteriores, inclusive suas pendências. Não há carregamento artificial, nem cadastro/atualização de cliente novos fora dos fluxos existentes.

## Próxima tarefa sugerida (não executada)

Realizar uma sessão de demonstração com operadores da oficina para validar clareza das mensagens, leitura de tabelas e prioridade das informações antes de ampliar funcionalidades.

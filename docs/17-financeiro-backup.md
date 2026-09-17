# Financeiro de peças e snapshots — preparação local

## OS Rápida — integração financeira local

A OS Rápida continua em `service_orders` e representa o serviço como um item aprovado e executado no `budget`. Subtotal, desconto comercial, total final, recebimentos, saldo, contas a receber e relatório reutilizam as regras existentes. Sem veículo oficial, as projeções usam o snapshot Marca/Modelo/Ano por `left join`; histórico veicular continua restrito a vínculo real.

`create_quick_service_order` cria e entrega atomicamente, com `creation_request_id` idempotente. Recebimento zero mantém a OS em aberto sem método/recibo; valor positivo exige Dinheiro, PIX ou Cartão e pode ser parcial. Garantia e autor legível são congelados pelo backend. O rascunho que continua como standard é criado diretamente em `Recebido`, após vínculo/cadastro oficial do veículo, sem quick intermediária nem reabertura de OS entregue.

**Migration local:** `20260917030000_quick_service_orders.sql`. Altera `vehicle_id` para opcional somente sob constraint explícita de identidade quick, adiciona tipo/snapshot/idempotência, RPC, proteção de quick entregue, projeções financeiras e backup estruturado. Aplicar junto com o frontend apenas após autorização; nada foi aplicado remotamente.

## Desconto comercial final da OS — local

- `service_orders.discount_amount` guarda reais/centavos, com default zero; `discount_reason` guarda observação opcional. Não há percentual, cupom ou rateio nos itens. Preços aprovados, custos, markup e histórico de aprovação permanecem iguais.
- `set_order_discount` usa bloqueio da linha e versão esperada. A identificação da operação no histórico permite repetir uma requisição sem duplicar o desconto ou o evento; reutilizar o ID com outro conteúdo é recusado. Histórico inclui valor anterior/novo, motivo anterior/novo, autor e data/hora, protegido contra alteração operacional direta.
- Owner/admin podem editar; staff exige `can_view_financial`. Customer não pode. OS cancelada, excluída, concluída ou entregue é somente leitura para desconto. O modal fica em Pagamentos; informar zero remove explicitamente o desconto.
- Total final = subtotal aprovado − desconto. Desconto negativo, com fração de centavo, acima do subtotal ou que reduza o total abaixo do recebido é recusado. Pagamentos antigos e múltiplos recebimentos são preservados; não há estorno automático. Crédito excedente preexistente continua sinalizado e bloqueia novos recebimentos/ajustes incompatíveis.
- Financeiro conserva seu filtro de itens aprovados **e executados** e o período de conclusão. Mostra faturamento bruto, descontos e faturamento final; resultado, ticket, gráficos e consolidado usam receita após desconto. Serviços/peças e rentabilidade de peças mantêm valores anteriores ao desconto, explicitamente identificados; custos desconhecidos continuam desconhecidos.
- Resumo comercial final mostra serviços e peças, desconto quando positivo e total líquido, sem custo/markup/margem. O orçamento aprovado continua com os valores originais.
- Mapeamento cloud, recarga e backup operacional preservam os campos; ausência no legado equivale a zero. O snapshot estruturado já copia a linha completa de `service_orders`, dispensando mudança no job de backup.
- Voltar etapa continua preservando recebimentos. Se a reversão eliminar aprovações e tornar o subtotal inferior ao desconto, a gravação é bloqueada; remover/ajustar o desconto explicitamente antes. Nenhum desconto ou histórico é apagado silenciosamente.

**Migration local:** `20260917010000_order_commercial_discount.sql`, posterior às bases financeiras/recebimentos existentes. Adiciona somente dois campos, proteção de escrita/auditoria e a RPC; atualiza recebimentos, contas a receber e relatório para considerar o desconto. Não aplicar todo o histórico automaticamente: há migrations equivalentes no repositório. Conferir o histórico remoto e publicar o frontend junto da migration, com recarga dos clientes abertos.

**Validação:** testes de cálculo, recarga do repository, backup, modal e documento; SQL executado em PostgreSQL local em memória, incluindo permissões, limites, histórico, reenvio e versões obsoletas. Typecheck e build aprovados. Quatro testes antigos da tela financeira falham por mocks incompletos de `lucide-react`; a mesma falha foi reproduzida com os arquivos originais do HEAD. Sem alterações nesses testes ou nos gráficos fora do pedido.

**Pendente:** conferência visual desktop/mobile, F5 em sessão real, permissões/RLS e concorrência entre sessões no ambiente correto após aplicação autorizada. O conector Supabase está disponível, mas recusou a consulta de metadados do projeto configurado por falta de permissão; a capacidade de aplicar remotamente sem Lovable não está confirmada. Nenhuma migration ou dado remoto foi alterado.

## Evolução — financeiro geral das OS

Esta seção amplia o relatório inicial descrito abaixo, sem apagar seus critérios históricos.

Refinamento de apresentação posterior: os indicadores gerais abrem a tela; os gráficos mostram comparação de faturamento/custo/resultado no período, Carros × Motos e evolução temporal de faturamento/resultado. “Rentabilidade de peças” fica recolhida abaixo do resumo por OS, com custo, lucro e acréscimo implícito por peça. O relatório não retorna nomes das peças nem markup manual; mostra posições no detalhamento e identifica o percentual como implícito. Markup manual continua no editor da OS. Nenhuma RPC, cálculo persistido, permissão ou backup foi alterado nessa reorganização.

- Principal: faturamento das OS, receitas de peças e serviços, custo conhecido das peças, resultado bruto, ticket médio e quantidade de OS. Rentabilidade das peças permanece em detalhamento.
- Mantidos os três status finais e a data de conclusão. Contabilizados somente itens aprovados e explicitamente executados; sem inferir recebimento/pagamento. OS somente com serviços agora entram. O resumo identifica OS, cliente, veículo, classificação real, data e valores.
- Filtros de categoria/período afetam indicadores, resumo e os três gráficos: faturamento/custo/resultado no tempo, comparação por categoria e resultado bruto temporal separado em Carros/Motos.
- Resultado bruto = receita considerada − custo conhecido das peças; não é lucro líquido nem caixa. OS sem peças têm custo de peças zero por ausência de peças. Peças sem custo não recebem estimativas: custo inteiramente ausente deixa resultado da OS e agregado não informado; custo parcialmente conhecido produz resultado provisório, com aviso.
- Sem valor de venda suficiente, a OS continua no resumo/contagem, mas sai das somas e do ticket. Ticket = receita das OS com valor conhecido / quantidade dessas OS. Sem data de conclusão válida, fica fora do período e é sinalizada. Campos desconhecidos aparecem como “Não informado”.
- Custo/markup são pré-carregados de `get_part_financial`, cuja fonte canônica é `order_part_financials`. Não há fallback ao custo legado no JSON; sua transferência é responsabilidade da migration anterior. Não foi criada segunda entrada/fonte de custo ao adicionar a peça.
- Quantidade antiga permanece 1. Na ausência de preço unitário, usa total do item / quantidade. Markup salvo prevalece; na ausência dele, custo positivo e venda final permitem exibir acréscimo implícito = (venda − custo) / custo × 100. Ele é informativo e não é salvo automaticamente. Custo zero não permite essa divisão.
- Preço manual é preservado; apenas “Usar preço sugerido” o substitui. Lucro unitário = venda unitária − custo unitário; lucro total considera quantidade. Margem do detalhamento = lucro das peças / receita das peças com custo conhecido; não é markup.
- Nenhum campo persistido novo: os valores do relatório são projeções. Backup/manual/72h, formato de exportação, histórico, concorrência e demais áreas permanecem iguais.

**Aplicação pendente:** revisar/aplicar somente a nova `20260911030000_financial_order_report.sql` após a base financeira anterior, se esta ainda não estiver aplicada. A RPC nova é necessária porque a anterior retorna apenas peças, sem serviços/contexto da OS. Usa o mesmo `can_view_financial`, não altera tabelas, policies, RPCs antigas nem registros. Publicar o frontend correspondente e validar permissões por chamada direta, cálculos com OS reais e apresentação desktop/mobile. Não reaplicar migrations anteriores já presentes.

**Validação desta evolução:** 20 testes direcionados aprovados, incluindo cálculos, filtros, gráficos/handlers com mocks, markup/preço manual, contratos de permissão e compatibilidade do backup. Esses testes não executam PostgreSQL/RLS nem substituem inspeção visual no navegador. TypeScript foi executado e continua bloqueado pelos imports/tipos MCP preexistentes de `@lovable.dev/mcp-js` ausente localmente; não foram identificados erros nos arquivos financeiros. Nenhuma dependência instalada, migration aplicada, configuração remota alterada, commit ou push.

## Aplicação remota (não executada pelo Codex)

1. Revisar e aplicar `20260911010000_financial_parts_permissions.sql` e depois `20260911020000_structured_backups.sql` em ambiente de teste. Publicar frontend junto com a primeira migration; clientes antigos abertos devem recarregar, pois custo no JSON passa a ser rejeitado.
2. Conferir arquivo privado `pitgarage_private.legacy_financial_budgets` e transferência dos custos legados. A migração é transacional, preserva o orçamento original nessa tabela e aborta diante de IDs de peça duplicados; não corrigir duplicatas automaticamente. Custos inválidos permanecem no arquivo original e são tratados como não informados no relatório.
3. O owner ativo já tem acesso. Pelo painel Financeiro, o owner concede acesso aos perfis operacionais ativos de Abraão e Letícia (ou aos perfis reais correspondentes, após identificação humana). Salomão, se continuar owner, já terá acesso. Nenhum nome, ID ou e-mail foi codificado. Não criar usuários nem promover alguém a owner.
4. Habilitar pg_cron conforme suporte do Lovable/Supabase e revisar/executar `supabase/manual/enable-structured-backup-job.sql` no contexto de administrador. A checagem ocorre diariamente às 03:00 UTC; a função só cria uma cópia se não houver sucesso nas últimas 72 horas. Executar a primeira cópia e verificar `cron.job_run_details`; falhas abortam a transação e podem ser tentadas no próximo ciclo. Não há exclusão/retenção automática.
5. Validar no cloud os papéis owner, staff/admin com permissão, staff sem permissão e customer. Testar chamadas diretas aos RPCs e tabela de custos, concessão/revogação e preservação do owner. Rodar uma edição concorrente da OS, confirmar erro de versão e ausência de sobrescrita.
6. Conferir em desktop/mobile: custo 100, acréscimo 30 → sugestão 130; venda manual 125 × 2 → receita 250, custo 200, lucro bruto 50. Mudar custo/markup não aplica sugestão sem clicar. Testar custo zero, ausência de custo, OS antiga, negativos no lucro, filtros e gráficos vazios.

## Modelo e critério

- `budget.price` continua sendo **total do item**, mantendo todos os cálculos existentes de orçamento/pagamento/histórico. `quantity` e `unitPrice` são opcionais; legado sem quantidade equivale a uma unidade.
- Custo unitário e markup ficam em `order_part_financials`, protegidos por RLS e RPC. O orçamento operacional não transporta esses dados. Mudar uma peça usa RPC transacional com a versão atual da OS e atualiza a versão no repository.
- Novo item de peça entra com preço de venda informado e quantidade 1. Depois de salvo, o editor na própria OS permite definir custo, acréscimo, quantidade e venda com permissão financeira.
- Markup é acréscimo sobre custo. Sugestão só é aplicada por ação explícita. Lucro = venda total − custo unitário × quantidade. Margem = lucro / receita conhecida, quando receita não é zero. Não representa lucro líquido ou resultado de caixa.
- Mudança de quantidade/venda de item aprovado, executado ou OS concluída exige reabertura pelo workflow existente. Custo/markup podem ser completados posteriormente sem alterar a venda.
- Relatório usa peças aprovadas e explicitamente executadas de OS em Serviço concluído, Aguardando retirada ou Entregue. Usa data de conclusão. Não infere execução de aprovação/pagamento. OS sem data são sinalizadas e excluídas, inclusive do filtro Todos. Esse é um critério operacional inicial a validar com a oficina.
- Receita inclui todas as peças elegíveis. Custo, lucro, margem e gráficos usam apenas peças com custo conhecido; contagem de OS incompletas acompanha o relatório. Não mistura receita sem custo ao lucro. Exclusões lógicas de cliente/veículo não apagam receita histórica.
- Qualquer owner ativo tem acesso; admin/staff precisam de concessão explícita. A mesma permissão autoriza consultar custos e registrar os dados das peças, sem alterar os níveis de perfil.

## Backup

Mesmo envelope `pitgarage-local-backup`, versão 1, com `data`, `workshop`, `exportedAt` e extensão `cloud`. Mantém clientes, veículos, OS, histórico, pagamento, orçamento e evidências. A extensão guarda as linhas originais, perfis (sem credenciais Auth), permissões financeiras, custos, arquivo legado, Agenda, notificações e Chat. Não inclui segredos, sessões, contadores antiabuso ou logs de autenticação.

Snapshots ficam na tabela privada `pitgarage_private.structured_backups`, sem grants para frontend, apenas administração. Uma consulta única produz snapshot consistente; trava transacional evita duplicidade. A função não depende de navegador ou Edge Function. O backup manual existente continua funcionando; o parser reconhece o envelope cloud, mas bloqueia importá-lo como backup local para não descartar silenciosamente tabelas/permissões.

**Limites:** sem binários de fotos/vídeos; referências `path/mimeType/size` permanecem. Configurações atuais da oficina são locais ao navegador e não entram na cópia automática (a seção workshop fica vazia, com sinalização na extensão); snapshots de oficina já presentes em OS são preservados. Credenciais de usuários são responsabilidade do backup Auth da plataforma. A cópia fica **no mesmo banco**: protege contra alterações acidentais enquanto o banco existe, mas não contra perda total do banco/projeto. Exportação externa/backup físico permanece responsabilidade da plataforma; nenhum fluxo de restauração remota automática foi criado.

Restauração deve ser revisada e executada por administrador, com tratamento explícito dos IDs de Auth, chaves estrangeiras e custos privados. Não colar payloads sensíveis em logs ou respostas públicas.

## Validação local

Os testes TypeScript de cálculo/contratos não substituem execução das migrations e RLS em PostgreSQL. Não havia PostgreSQL/pg_cron local disponível nesta rodada. Testes remotos e ativação do job continuam pendentes. Nenhuma migration, job, permissão ou dado real foi aplicado pelo Codex.

Resultado: 22 testes direcionados aprovados (financeiro e evidências), lint dos arquivos alterados aprovado com normalização de CRLF somente em memória e diff-check aprovado. TypeScript e build foram executados, mas não concluíram por ausência de `@lovable.dev/mcp-js`, referenciada pela configuração/rotas MCP preexistentes. Nenhuma dependência foi instalada ou configuração MCP alterada. Gráficos e handlers foram exercitados com mocks; inspeção visual real em desktop/mobile e execução de SQL/RLS permanecem pendentes.

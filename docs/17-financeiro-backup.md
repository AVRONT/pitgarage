# Financeiro de peças e snapshots — preparação local

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

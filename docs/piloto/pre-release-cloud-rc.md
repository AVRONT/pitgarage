# Preparação do deploy dos P0 — 21/09/2026

Esta seção é o roteiro vigente **somente para publicar os P0 de persistência e cancelamento**.
O relatório de 03/09 abaixo é histórico: suas instruções de aplicar a base operacional,
bootstrap, mudar contas ou executar testes destrutivos NÃO fazem parte deste deploy.
Nenhuma operação remota, login, credencial, instalação, commit ou push foi realizada nesta preparação.

## Versão e escopo

- Código de produção local revisado: commit `7bb844e` (`fix: persistir clientes e veículos e proteger cancelamento de OS`).
- Projeto indicado no config e URL local: `vzvwprzmlhvfehwykstx`; confirmar identidade no Cloud, não assumir acesso pelo ID.
- Migration única candidata: `supabase/migrations/20260921010000_persist_directory_and_guard_cancellation.sql`.
- SHA-256 do texto com CRLF convertido para LF e `trimEnd()`:
  `b781d95bbd64c831fabb00cad923b660c29e62d808276d12c27cd1258ddb5d08`.
- Nenhuma migration histórica ou de produção foi modificada. A P0 permanece intacta.
- Mudanças desta preparação: teste de convite atualizado para a regra existente; testes PGlite ampliados; este roteiro.
- Este documento/testes locais NÃO chegam automaticamente ao Lovable. Anexar este roteiro ou sincronizá-lo por ação humana autorizada; confirmar que o código P0 já está disponível no checkout usado para publicar.

## Reconciliação de todas as migrations locais

Inventário: **63 arquivos**. Comparação de conteúdo, definições/alterações de objetos,
grants e ordem das substituições. Há 13 pares iguais após normalizar finais de linha e
espaço final, um par com diferença apenas de formatação/comentário, seis pares com diferença
de delimitadores de transação e um par com diferença efetiva de grant.
Essas comparações locais NÃO comprovam o histórico remoto.

Nas tabelas, cada versão identifica unicamente o arquivo com aquele prefixo na pasta.

| Versão descritiva/local | Outra versão local equivalente | Conteúdo |
| --- | --- | --- |
| 20260902230000 | 20260903164522 | Base operacional; somente finais de linha/linha final |
| 20260903190000 | 20260904000706 | Agenda; somente finais de linha/linha final |
| 20260903191000 | 20260904000803 | Segurança/notificações; somente finais de linha/linha final |
| 20260903192000 | 20260904000843 | Chat; somente finais de linha/linha final |
| 20260904010000 | 20260906162401 | Evolução Chat; somente finais de linha/linha final |
| 20260911010000 | 20260911010425 | Custos privados/permissões; somente finais de linha/linha final |
| 20260911020000 | 20260911010500 | Estrutura de backup; somente finais de linha/linha final |
| 20260911030000 | 20260911014840 | Relatório por OS; apenas formatação/comentário |
| 20260912020000 | 20260912024243 | Remover item; somente finais de linha/linha final |
| 20260917010000 | 20260917015948 | Desconto; somente finais de linha/linha final |
| 20260917030000 | 20260917173819 | OS Rápida; somente finais de linha/linha final |
| 20260917040000 | 20260917174027 | Resultado financeiro; somente finais de linha/linha final |
| 20260917050000 | 20260917182335 | Peças da OS Rápida; somente finais de linha/linha final |
| 20260918010000 | 20260918150015 | Cancelamento com movimentações; somente finais de linha/linha final |

| Versão com BEGIN/COMMIT | Versão sem esses delimitadores | Mesmas instruções internas |
| --- | --- | --- |
| 20260911040000 | 20260911022740 | Nome dos itens no relatório |
| 20260912010000 | 20260912021538 | Adicionar item |
| 20260914210007 | 20260914213326 | Pagamentos/contas a receber |
| 20260914210009 | 20260914213403 | Receitas extras |
| 20260914210010 | 20260914213440 | Snapshot de veículo no orçamento |
| 20260914211122 | 20260914213516 | Extensão do backup |

Diferença real: `20260904020000` concede EXECUTE de
`reserve_registration_attempt(inet,text,text)` a `service_role`; `20260904180525`
omite essa linha. Não são cópias exatas. O acesso efetivo depende também das ACLs/default
privileges remotas: verificar, não declarar signup quebrado nem corrigir grants automaticamente.

Demais arquivos (sem par equivalente) e efeitos que devem permanecer históricos:

| Versão | Efeito |
| --- | --- |
| 20260902190000 | Base Auth/perfis/helpers/bootstrap |
| 20260905162832 | Lista de responsáveis |
| 20260907174418 | UPDATE amplo em OS/clientes/veículos/perfis; origem do bypass fechado pelo P0 |
| 20260908232021 | Grants de Chat/notificações |
| 20260909125707 | Evidências e políticas Storage |
| 20260911010611 | pg_cron e agendamento de backup; não simulado como infraestrutura Cloud |
| 20260914005324 | **RESTART da sequência de OS: nunca reaplicar neste deploy** |
| 20260914011729 | Administração por owner/admin, políticas de perfis e convites |
| 20260914012158 | Ajuste posterior do guard de equipe |
| 20260914112752 | Configurações da oficina |
| 20260914112831 | Configurações incluídas no backup |
| 20260914131443 | **UPDATE de um perfil específico para owner: nunca reaplicar neste deploy** |
| 20260914143913 | Colunas/RPC de cancelamento e bloqueio de OS cancelada |
| 20260914173535 | Índice de placa ativa |
| 20260914191718 | RPC de alteração da queixa |
| 20260914193624 | Garantia e preenchimento legado |
| 20260914194251 | Orçamentos comerciais e custos privados |
| 20260914201829 | Contatos/conversão de orçamento e remoção de item |
| 20260916171847 | Pagamento em dinheiro |
| 20260917020000 | Nome do autor do desconto |
| 20260921010000 | P0 atual, única candidata à aplicação |

Os pares destacados pelo pedido não dependem um do outro. Ambos definem os mesmos
objetos; a base operacional falha se reaplicada e o cancelamento repetiria substituições
desnecessárias. Nenhum SQL local consulta uma versão específica em `schema_migrations`:
dependências são por objetos/assinaturas, não pelo nome do arquivo. A CLI, por outro lado,
controla aplicação por versão e não reconhece equivalência de conteúdo entre IDs distintos.

Substituições relevantes: `cancel_service_order` vem de 14143913 e é substituída por
18010000/18150015; a P0 não a substitui. `create_service_order_atomic` evolui da base para
17030000, depois wrapper financeiro 17040000 e peças 17050000. O relatório financeiro é
substituído por várias etapas até 18010000/18150015. Reaplicar uma versão antiga pode
restaurar comportamento antigo, conflitar com renomeações ou tentar recriar objetos.

**Não executar push em lote, reset, repair, reaplicação de versões antigas, exclusão ou
renomeação de arquivos.** Equivalência comprovada deve ser registrada no relatório remoto,
sem alterar o histórico nesta tarefa. Se a ferramenta só permitir replay em lote, PARAR.

## Revisão da P0 e pré-requisitos

A migration P0 está correta para o schema operacional revisado e passou nos testes
PGlite com as versões financeiras/quick atuais. Não exige correção local nesta revisão.

- Cria duas RPCs públicas e uma função/trigger privados de proteção. Não cria tabela,
  não muda RLS e não altera dados existentes ao aplicar.
- RPCs SECURITY DEFINER, `search_path=''`, nomes de objetos qualificados, sem SQL dinâmico;
  somente equipe ativa via `is_team_member`/`current_access_level`. Customer, ausente,
  inativo e anon foram negados nos testes locais.
- UUID obrigatório; casts, NOT NULL, CHECKs, FKs e índices únicos existentes rejeitam
  dados inválidos. Campos extras de identidade/permissão enviados no JSON não são inseridos.
- Mesmo UUID e mesmo cadastro retornam o registro existente sob lock transacional;
  conteúdo diferente, cadastro removido ou conflito de telefone/CPF/e-mail/placa falham.
  Retry após edição concorrente do cadastro pode exigir recarga, intencionalmente sem sobrescrita.
- `create_vehicle` exige cliente salvo e não removido; vínculo Auth de cliente é resolvido
  pelo helper existente, não por UUID fornecido arbitrariamente.
- `cancel_service_order` existente exige owner/admin ativo, motivo, OS existente e versão
  atual; preserva pagamentos/itens/status e registra motivo/autor. Staff não cancela.
- Trigger P0 SECURITY INVOKER bloqueia INSERT com cancelamento e mudanças nos três campos
  por `authenticated`/`anon`. Cancelamento legítimo SECURITY DEFINER continua funcionando.
  `guard_cancelled_order` existente impede alterações posteriores. Edição normal permanece.
- Não é barreira contra administrador SQL/service_role capaz de alterar o banco. Essas
  credenciais não podem chegar ao frontend. Não há isolamento multi-tenant implementado.
- Idempotência de cadastro não é idempotência de DDL: reaplicar P0 gera erro de objeto
  existente. A transação evita aplicação parcial normal; conferir histórico E objetos.

Pré-requisitos diretos: schema privado, roles Supabase, `customers`, `vehicles`,
`service_orders`, `is_team_member()`, `current_access_level()`,
`find_confirmed_auth_user(text)`, constraints/índices da base e três campos de cancelamento.
Pré-requisitos do comportamento preservado: `guard_cancelled_order`, versão atual de
`cancel_service_order` e autorização real dos perfis; componentes financeiros/quick
existentes precisam continuar nas versões atuais. Não é necessário reaplicar suas migrations.

## Consultas somente leitura — antes e depois

Executar no projeto confirmado, sem retornar registros de clientes ou credenciais.

### 1. Histórico

```sql
select version, name
from supabase_migrations.schema_migrations order by version;
```

Esperado: histórico identificável, incluindo versões equivalentes já publicadas. Se for
necessário esclarecer uma equivalência, comparar o campo `statements` dessa versão com
o arquivo local correspondente, sem editar o histórico. Ausência de tabela/histórico
confiável é condição de parada, não autorização para iniciar replay.

### 2. Colunas, constraints, índices e RLS

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name in ('customers','vehicles','service_orders')
order by table_name, ordinal_position;

select conrelid::regclass as relation, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (to_regclass('public.customers'),to_regclass('public.vehicles'),
  to_regclass('public.service_orders')) order by relation, conname;

select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename in ('customers','vehicles','service_orders');

select oid::regclass as relation,relrowsecurity,relforcerowsecurity
from pg_class where oid in (to_regclass('public.customers'),to_regclass('public.vehicles'),
  to_regclass('public.service_orders'));

select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('customers','vehicles','service_orders');
```

Esperado: campos usados pelas RPCs presentes; PKs UUID, vínculo cliente/veículo, índices
únicos e validações da base; `cancelled_at`, `cancelled_by`, `cancel_reason`; RLS habilitada
e políticas de equipe preservadas. Não exigir `vehicle_id NOT NULL`: quick permite nulo
com a constraint de identificação por tipo. Comparar definições, não apenas nomes.

### 3. RPCs/helpers, donos, definições e acesso efetivo

```sql
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
  pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('create_customer','create_vehicle',
  'cancel_service_order','reserve_invite_budget','reserve_registration_attempt'))
  or (n.nspname='pitgarage_private' and p.proname in ('current_access_level',
    'is_team_member','find_confirmed_auth_user','protect_order_cancellation',
    'guard_cancelled_order'))
order by n.nspname,p.proname,arguments;
```

Antes: helpers e cancelamento existentes; os três objetos novos ausentes se P0 nunca
aplicada. Depois: RPCs novas SECURITY DEFINER, `search_path=''`, authenticated=true,
anon=false; trigger function SECURITY INVOKER, path vazio, authenticated=false/anon=false.
Verificar dono administrativo confiável, sem ownership para papéis de cliente, assinaturas
e corpo iguais ao arquivo P0. Não aceitar overloads inesperados como equivalentes.
`cancel_service_order` deve continuar igual à versão 18010000/18150015, com owner/admin,
motivo/versão/auditoria. `reserve_invite_budget` deve corresponder à revisão 14011729,
acessível apenas por papel de serviço; verificar também EXECUTE efetivo de
`reserve_registration_attempt` por `service_role` devido à diferença histórica de grant.

### 4. Todos os triggers de OS e grants de tabelas

```sql
select tgname,tgenabled,pg_get_triggerdef(oid) as definition
from pg_trigger where tgrelid=to_regclass('public.service_orders') and not tgisinternal
order by tgname;

select table_name,grantee,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in ('customers','vehicles','service_orders')
order by table_name,grantee,privilege_type;
```

Esperado: `guard_cancelled_order` habilitado; depois, `protect_order_cancellation`
habilitado para BEFORE INSERT OR UPDATE OF os três campos. Triggers de pagamentos,
custos, quick e demais proteções existentes não removidos/desabilitados. Comparar grants
antes/depois: P0 não altera privilégios das tabelas. Não testar bypass mutando dados reais.

## Decisão segura no Cloud

1. Histórico registra P0 (ou equivalente comprovada), três funções/trigger/ACLs corretos:
   **não reaplicar**; registrar versão real e seguir para deploy.
2. P0 ausente, objetos novos todos ausentes, dependências compatíveis, backup disponível
   e executor capaz de aplicar somente este arquivo com registro normal de migration:
   aplicar o arquivo integral e inalterado uma única vez; repetir consultas de leitura.
3. P0 registrada com objetos divergentes/ausentes, objetos presentes sem histórico
   comprovável, aplicação parcial, overloads, owner indevido, schema/permissões diferentes,
   dependência faltante ou qualquer necessidade de replay antigo/repair: **PARAR**.

Não basta o arquivo ter rodado sem erro: exigir linha no histórico, três definições,
trigger habilitado, grants esperados e dependências intactas. Se a plataforma atribuir
outro ID ao aplicar, registrar esse ID e a equivalência do SQL; nunca criar uma segunda
aplicação apenas para igualar o nome. Se ocorrer falha incerta, reinspecionar antes de retry.

## Pós-deploy e smoke seguro

- Publicar somente frontend que inclua os P0 do commit de referência; manter variáveis,
  Auth, Storage, Functions e configurações hospedadas existentes.
- Confirmar chamadas `create_customer`/`create_vehicle` e espera pelo retorno persistido;
  nunca anunciar sucesso a partir do rascunho. Sem RPC instalada/cache atualizado, parar
  diante de erro, não criar fallback local.
- Abrir aplicação publicada em sessão autorizada, Dashboard, Clientes, Veículos, OS,
  financeiro e histórico; testar leitura/refresh/reabertura sem editar dados reais.
- Login/logout real somente com acesso autorizado e sem registrar credenciais.
- Smoke de escrita (cadastro → veículo → OS → itens → pagamento → entrega/cancelamento)
  somente em homologação isolada/dados descartáveis explicitamente autorizados. Não
  cancelar OS real, não apagar cadastros para limpar teste, não enviar convites/e-mails
  reais. Sem ambiente autorizado, registrar escrita end-to-end como pendência.
- Evidências: projeto, versão publicada, versão remota da migration, definições/ACLs/
  triggers verificados, consultas executadas, etapas do smoke realizadas e limitações.

## Validação local desta preparação e limites

- Suíte completa: 169 testes, 169 aprovados, zero falhas e zero skips; PGlite configurado
  por variável de processo apontando à dependência já instalada, somente bancos em memória.
- `npx --no-install tsc --noEmit`, `npm run build` e `git diff --check`: aprovados.
  Build sem deploy; avisos de vite-tsconfig-paths, tamanho de chunks, tempos de plugins e
  inlineDynamicImports/codeSplitting não foram motivo para alterar a configuração.
- Smoke SQL usa migrations reais da base, agenda, custos, configurações, pagamentos,
  desconto, quick, peças e cancelamento, junto com P0. Cobertura de UUID/retry/duplicidade,
  inputs inválidos, rollback, grants, perfis ativos/inativos/ausentes e bloqueio direto.
- Fluxo SQL: configuração → cliente → veículo → OS normal → serviço/peça → aprovação/
  execução → pagamento parcial/total → entrega → releitura → cancelamento; registros
  financeiros preservados e OS cancelada fora de relatórios/contas a receber/listas ativas.
- Testes existentes complementam histórico técnico, orçamento comercial/conversão,
  OS Rápida, correção financeira, refresh/retry e UI de cadastro (duplo envio/erro/rascunho).
- Não houve navegador, login Auth real, validação visual, transporte PostgREST real ou
  execução de infraestrutura Cloud (Jobs, SMTP, Storage). Auth.uid é uma identidade de
  fixture local; a verificação final de perfil usa a definição real de current_access_level.
  Admin Local não suporta pagamentos/correções reais; não foi alterado para fingir suporte.
- Não foi executado replay indiscriminado dos 63 arquivos: duplicidades e ações históricas
  tornam isso incorreto. A suíte usa cadeias selecionadas em fixtures descartáveis.
- Achado fora dos P0: a timeline do veículo usa `order.status`/`completedAt` sem consultar
  `cancelledAt`, podendo apresentar OS cancelada como em andamento ou concluída. Dados
  permanecem e listas ativas excluem canceladas; apresentação não foi alterada nesta preparação.
- Multi-tenant futuro precisará escopar estas RPCs, RLS, unicidades, vínculo de IDs e
  helpers de autorização por oficina. Acesso atual da equipe é compartilhado, não isolamento
  entre oficinas. Nenhuma arquitetura multi-tenant foi implementada.

---

# Registro histórico — pré-release cloud / release candidate de 03/09/2026

Status: **candidato local, ainda não liberado para uso real na oficina**. Base revisada: commit `943265c`, com árvore inicialmente limpa em `C:\PITGARAGE\pitgarage`. Esta rodada não aplicou SQL, não acessou Lovable e não fez commit/push.

## Estado e limites da auditoria

Auth e bootstrap do primeiro owner já estão aplicados conforme o contexto e histórico do projeto; não foram reinspecionados remotamente nem repetidos. A migration operacional `20260902230000_create_operational_base.sql` continua somente local e **não recebeu alteração nesta rodada**. Nenhuma versão anterior foi sobrescrita.

Revisão estática das três tabelas: PK UUID, sequência única de OS, FKs sem cascade operacional e FK composta veículo/cliente; exclusão de Auth anula somente o vínculo comercial. Constraints/índices, RLS, grants por coluna, revokes, funções definer com search_path vazio, auth.uid e funções invoker/trigger de perfil continuam coerentes com a matriz solicitada. Não houve execução/compilação em PostgreSQL: confirmação real de RLS, rollback e locks continua obrigatória.

## Achados por prioridade

### P0 — integridade e isolamento

- Escrita cloud sem retorno de linha podia parecer sucesso após perda de permissão ou desaparecimento do registro. UPDATE de OS e exclusões lógicas agora exigem retorno de exatamente uma linha; erro deixa de ser sucesso silencioso.
- Duas instâncias podiam sobrescrever a mesma OS sem detectar que a base mudou. O repositório usa o `updated_at` lido como precondição de UPDATE, avança a versão e guarda a versão retornada. Divergência/nenhuma linha exige recarga, sem merge automático.
- Escritas de uma tela são serializadas; chamadas ao repositório saíram do updater de estado React, que pode ser reexecutado. Após falha, a fila para e a tela exige conferência dos dados salvos. Nova OS aguarda escritas anteriores antes de recarregar a lista.
- Na troca de conta, a identidade anterior é retirada antes de carregar o perfil do novo usuário. Isso evita manter a aplicação da conta anterior montada durante a consulta.

Essas correções protegem os caminhos do runtime atual, não tornam histórico/JSON imutáveis nem impedem um operador autorizado de modificar dados diretamente pela API. O controle de versão precisa passar pelo teste real de duas sessões.

### P1 — fluxo e primeira impressão

- Sucesso de exclusão só aparece após confirmação. Feedback de gravação pendente é distinto de sucesso; falha persistente não desaparece em três segundos.
- Busca textual já não retorna todos os clientes com CPF por comparação com uma sequência vazia; busca sem resultado tem orientação.
- Dashboard vazio orienta a primeira OS; ausência de aprovações não é apresentada como valor pendente de R$ 0,00. Data demonstrativa fixa foi retirada do título, sem mudar datas/regras dos atendimentos.
- Equipe mostra carregamento, erro com retry, vazio e salvamento; controles ficam indisponíveis durante gravação. Explica que ajustes dependem de Salvar e mantém o rascunho em falha. Layout e quebra de e-mail evitam compressão excessiva.
- Portal oferece retry e descarta respostas de consultas anteriores. Cadastro informa o vínculo necessário, sem prometer uma área inexistente.
- Nova OS: botões de seleção/cadastro quebram linha no celular. Detalhe da OS: contêiner posicionado mantém os rótulos acessíveis do stepper dentro da rolagem, eliminando largura indevida da página. Lógica, ordem, animações e reduced-motion preservados.
- Mensagens de diagnóstico/pagamento não dizem “localmente” quando o runtime está em cloud.

### P2/P3 — documentados, sem ampliação de escopo

- P2: idempotência entre reenvios após resposta incerta ainda não existe; conferir a lista antes de repetir criação. Não equivale ao bloqueio de duplo clique.
- P2: backup cloud/recuperação, autoria imutável, validação interna dos JSONs e paginação para grandes volumes continuam pendentes. Não anunciar o backup legado como cloud.
- P2: cargo/responsáveis, visibilidade financeira, CPF básico, telefone único e garantia/datas demonstrativas continuam provisórios; não são regras definitivas aprovadas para produção.
- P2: salvar perfil e recarregar lista ainda pode descartar rascunhos de outras linhas; editar e salvar uma conta por vez até melhoria futura.
- P3: nome técnico owner em alguns pontos, identificação visual v0.1.15 e avisos do scaffold de build não foram motivo para redesign/refatoração.

## Matriz de acesso revisada

| Perfil | Acesso previsto |
| --- | --- |
| customer ativo | RPCs do próprio cadastro, veículos e resumo de OS; nenhum custo/JSON interno, acesso de terceiro ou escrita operacional. |
| staff ativo | Operação interna; sem alteração de access_level ou listagem administrativa de terceiros. |
| admin ativo | Operação interna; sem alteração de access_level ou promoção de owner. |
| owner ativo | Lista mínima de contas; administra customer/staff/admin, cargo e ativo; sem criar owner pela UI ou rebaixar/desativar owner existente. |
| ausente/inativo/anon | Sem operação interna; consultas privilegiadas negadas/vazias segundo o contrato. |

Frontend não consulta auth.users. Vínculo continua por e-mail confirmado, normalizado e único, nunca por nome. Nova OS mantém Cliente → Veículo → Dados → Confirmar, sem criação de Auth e sem persistência dos novos cadastros antes da confirmação. A atomicidade depende da RPC SQL já preparada.

Última conta contém nome/e-mail/iniciais; senha e token customizado não são gravados. Persistência/renovação de sessão é do SDK. Retry transitório, bloqueio por perfil ausente/inativo e tradução de weak_password foram preservados. Cloud não carrega fixtures; Admin Local só funciona em DEV/localhost com adapter separado vazio por padrão. Legado e dados reais não foram modificados pelos testes.

## Validações locais desta rodada

- Typecheck, lint dos seis TS/TSX alterados, Prettier e build aprovados. Avisos de vite-tsconfig-paths e inlineDynamicImports pertencem ao scaffold; sem alteração de configuração/dependências.
- Navegador Edge headless com contexto temporário, endpoint Supabase fictício em loopback e bloqueio de requisições externas. Nenhuma credencial, sessão ou dado do navegador real foi utilizado.
- Capturas em 1366×768, 1920×1080, 768×1024 e 390×844 para login, Dashboard, Nova OS, Equipe e detalhe; portal sem vínculo também em desktop/tablet/mobile. Clientes, Veículos e OS vazios conferidos em amostra representativa. Capturas finais de detalhe mobile/tablet confirmaram largura de página de 390/768 px.
- Retry de perfil e portal testados com respostas simuladas; legado-sentinela preservado. Fluxo existente+existente e novo+novo percorreu os quatro passos; nenhum envio antes de confirmar, estado Salvando, erro mantendo dados e criação simulada abrindo detalhe.
- Testes isolados do repositório: duas instâncias carregam a mesma versão; primeira salva, segunda é rejeitada; sequência válida continua; update/exclusão sem linha/permissão são rejeitados. Isso não é teste real de RLS nem de concorrência PostgreSQL.
- Formulário novo+novo manteve cliente/veículo/problema após erro simulado. Rollback real, vínculo real, cadastro/confirmador de e-mail, revogação e gestão real de Equipe aguardam a matriz abaixo.
- Não houve teste visual exaustivo de todos os status/documentos nem homologação em dispositivos físicos. Paleta e CSS global preservados.

Referências técnicas da correção: [retorno de UPDATE no Supabase](https://supabase.com/docs/reference/javascript/update) e [reavaliação de condições em atualizações concorrentes no PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html).

## Checklist pós-migration — executar nesta ordem

Pré-condições: migration aplicada uma única vez no projeto correto; frontend desta revisão disponível em ambiente de homologação; owner real já existente. Usar e-mails/contas de teste controlados e contextos de navegador separados. Nunca excluir a conta do proprietário. Testes de falha/exclusão somente em dados de teste autorizados.

| # | Ação | Resultado esperado | Falha grave |
| --- | --- | --- | --- |
| 1 | Entrar com owner real, recarregar e abrir Dashboard/Equipe. | Perfil owner ativo; base nova vazia, sem fixtures; lista mínima de contas. | Sem acesso, perfil errado ou dados fictícios operacionais automáticos. |
| 2 | Criar conta de teste e usar owner para torná-la staff com cargo; entrar em outro contexto; tentar alterar access_level por RPC/API. | Operação interna permitida, gestão negada. | Staff muda permissões ou lista terceiros. |
| 3 | Repetir com admin; tentar promoção a owner por API. | Operação interna; nenhuma gestão de nível. | Admin altera access_level ou promove owner. |
| 4 | Criar/confirmar customer A e cadastro comercial A correspondente; entrar como A. | Somente cadastro/veículos/resumo permitido de A. | Escrita operacional, custos ou JSON administrativo exposto. |
| 5 | Repetir para customer B, com e-mail e veículo distintos. | Somente registros B. | Exposição de registros A. |
| 6 | Com JWT A/B, chamar tabelas e RPCs diretamente; tentar UUID do outro, escrita de vínculo e helper privado; repetir anon/inativo. | Sem dados de terceiro nem escrita; portal usa projeções mínimas. | Qualquer acesso cruzado, enumeração ou privilégio indevido. |
| 7 | Owner altera cargo/nível/ativo de não-owner; confirmar reload; testar rebaixar/desativar owner e promover outro owner via UI/API. | Mudanças autorizadas persistem; operações sobre owner proibidas. | Owner desativado/rebaixado, novo owner ou sucesso sem gravação. |
| 8 | Criar OS com cliente/veículo existentes; depois existente+veículo novo. Abrir a mesma OS em duas sessões e salvar mudanças diferentes. | Titularidade correta, OS certa aberta; segunda edição desatualizada exige recarga sem sobrescrever a primeira. | Veículo de terceiro, OS incorreta ou perda silenciosa de alteração. |
| 9 | Nova OS com cliente+veículo novos: passar quatro etapas, cancelar e conferir banco; repetir e confirmar uma vez; testar duplo clique e duplicidades. | Cancelar não grava; confirmar cria trio consistente; nenhum usuário Auth criado. | Cadastro parcial, duplicação por clique simultâneo ou nova conta Auth. |
| 10 | Em dados de teste, chamar RPC com novo cliente/veículo válidos e entryMileage inválida para falhar no insert da OS. | Erro e nenhum dos três registros persistido; lacuna na sequência é aceitável. | Cliente/veículo parcial ou OS inconsistente. |
| 11 | Oficina cria cliente com e-mail controlado sem conta; criar/confirmar conta depois e abrir portal. Testar não confirmado, e-mail diferente e nome igual. | Vincula só após confirmação e correspondência sem conflito. | Nome vincula, conta não confirmada vincula ou associação de terceiro. |
| 12 | Criar/confirmar conta antes; depois oficina cadastra cliente pelo mesmo e-mail normalizado; testar conflito/ambiguidade e chamadas concorrentes. | Vínculo único correto; conflitos não escolhem arbitrariamente. | Vínculo duplo/errado ou escolha arbitrária. |
| 13 | Entrar com customer confirmado sem cadastro comercial correspondente. | Estado vazio claro, logout disponível; erro de rede oferece retry. | Tela quebrada, dados de terceiros ou confusão entre erro e vazio. |
| 14 | Testar login/cadastro, confirmação, weak_password real, reload, última conta, falha de perfil/getUser com retry, expiração/revogação e troca de conta. | Sessão válida restaura; transitório não faz logout; inválida pede login; perfil inativo bloqueia; última conta sem segredo. | Acesso com perfil indevido, persistência de senha/token customizado, logout transitório ou dados da conta anterior. |
| 15 | Excluir somente Auth de customer de teste com OS/histórico, usando administração autorizada. | Perfil Auth removido, vínculo comercial nulo; cliente, veículo, OS e histórico retidos. | Cascade remove histórico, veículo ou OS. |

Adicional de segurança: verificar grants reais de INSERT/DELETE/TRUNCATE/sequence em ambiente de teste, sem executar operações destrutivas em produção. Revogação de sessão deve considerar a validade do access token já emitido; bloqueio por perfil inativo precisa valer imediatamente nas políticas.

## Condição objetiva de liberação

Não liberar para a oficina apenas porque build passou. Exigir: migration aplicada sem erro; 15 testes acima aprovados com evidências; nenhuma falha P0/P1 aberta; dados e acesso do owner conferidos; primeiro atendimento real validado em ambiente autorizado; backup/recuperação e limitações demonstrativas explicitamente alinhados com a oficina. Testes de mock não substituem esse aceite.

## Próxima ação exata — não executada

No projeto correto do PitGarage no Lovable Cloud, abrir o editor SQL, confirmar Auth/bootstrap já existentes e ausência de aplicação da migration operacional. Executar uma única vez o arquivo integral `supabase/migrations/20260902230000_create_operational_base.sql`, com BEGIN/COMMIT. Se já houver objetos operacionais inesperados, parar e reconciliar antes. Não reaplicar Auth nem bootstrap. Depois executar este checklist em homologação; não publicar para uso real antes do aceite.

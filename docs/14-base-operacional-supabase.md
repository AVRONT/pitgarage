# Base operacional Supabase

## Estado atual — 03/09/2026

Base operacional de clientes, veículos e OS **já aplicada em cloud**, com frontend funcional, RLS e preservação de histórico, conforme confirmação do responsável. Auth e bootstrap do primeiro owner também já foram executados. Não reaplicar a base operacional com base nas instruções antigas abaixo.

A próxima migration pendente é `20260904010000_improve_chat_experience.sql`, não a criação da base operacional. Consultar [estado canônico e pendências](AI_CONTEXT.md#estado-atual). Não houve verificação remota nesta atualização documental; antes de qualquer tratamento de migrations equivalentes, conferir `supabase_migrations.schema_migrations`, sem remover arquivos ou fazer repair por suposição.

## Registro histórico — preparação e revisão da base operacional

Todo o registro abaixo descreve as fases anteriores à publicação, incluindo seus status e instruções de aplicação. Foi preservado para rastreabilidade; não é o estado de deploy vigente nem a próxima tarefa.

Status: **implementada no repositório e ainda não aplicada remotamente**. A migration de autenticação anterior permanece aplicada; a nova migration operacional deve ser revisada e executada uma única vez no Lovable Cloud antes de publicar este runtime.

## Modelo

- `auth.users` e `user_profiles` representam identidade e acesso. `customers` representa o cadastro comercial da oficina; criar cliente não cria conta, senha ou convite.
- `customers.auth_user_id` é opcional, único e usa `ON DELETE SET NULL`. Uma conta e um cadastro podem existir separadamente.
- `vehicles` pertence a `customers`. `service_orders` usa UUID interno e numeração sequencial gerada pelo banco.
- Partes estáveis da OS são colunas; orçamento, evidências, equipe, pagamento, histórico, atividades e snapshot permanecem em JSONB para preservar o domínio sem antecipar tabelas.
- Exclusão operacional continua lógica por `deleted_at`.

## Vínculo seguro

- `try_link_my_customer()` permite que uma conta `customer` tente vincular somente a si própria. A função usa e-mail Auth confirmado e normalizado, sem expor outros clientes.
- Ao confirmar Nova OS com cliente novo, `create_service_order_atomic()` procura uma única conta `customer` ativa e confirmada com o mesmo e-mail. Conta já vinculada não é reutilizada.
- Nome nunca é usado para vínculo. Conflitos não são resolvidos automaticamente; índices únicos impedem associação ambígua ativa.
- O frontend nunca consulta `auth.users` diretamente.

## RLS e dados expostos

- `staff`, `admin` e `owner` operam clientes, veículos e OS.
- `customer` lê somente o próprio cadastro e seus veículos, sem escrita operacional.
- A tabela completa de OS não é concedida ao cliente. `get_my_service_orders()` retorna apenas UUID, número, veículo, status e datas; custos, orçamento, pagamento e dados administrativos não são expostos.
- `list_team_users()` expõe a um owner somente os campos mínimos de gestão, incluindo o e-mail obtido internamente do Auth.
- O navegador não usa `service_role`.

## Runtime e persistência

- Usuário real da equipe usa o repositório Supabase. A confirmação da Nova OS cria cliente/veículo opcionais e OS numa única transação.
- `Admin Local` usa adapter isolado em `pitgarage-dev-operational-v1`, começa vazio e não acessa cloud nem as fixtures antigas.
- `pitgarage-pilot-v012` não é apagado, mas deixa de ser fonte operacional. Fixtures permanecem apenas como material legado e não carregam automaticamente.
- O backup JSON antigo não representa proteção dos dados cloud e não aparece como backup operacional disponível.

## Aplicação remota pendente

Atualização de 03/09/2026: [revisão de release candidate](piloto/pre-release-cloud-rc.md). A migration não mudou nesta rodada e continua não aplicada. O runtime passou a conferir versão/retorno de UPDATE e serializar escritas; isso atualiza o limite histórico de concorrência descrito na revisão de 02/09 abaixo, sem convertê-lo em garantia de auditoria imutável ou teste remoto. O novo checklist detalha ação, resultado esperado e falha grave para cada perfil/fluxo.

Aplicar somente `supabase/migrations/20260902230000_create_operational_base.sql`, uma vez, no projeto correto. Depois validar RLS com contas isoladas, os dois sentidos do vínculo por e-mail confirmado, a transação da Nova OS, o portal do cliente e a gestão de equipe pelo owner antes de publicar o frontend.

## Fechamento da revisão local — 2026-09-02

Escopo: revisão estática e correções pontuais sobre a base já existente no commit `154df70`. Nenhum SQL, bootstrap ou teste de conta foi executado remotamente. A migration Auth aplicada permanece intacta. A migration operacional continua **pendente de aplicação e de validação real**.

### Integridade e permissões

- PKs UUID nas três tabelas; número de OS único por sequência (lacunas após rollback são normais). FKs sem cascade preservam referências; remover conta Auth apenas anula `customers.auth_user_id`, sem apagar cliente, veículo ou OS. FK composta garante que veículo e cliente da OS correspondam.
- Índices cobrem vínculo Auth único, e-mail normalizado não vazio, CPF, telefone, placa e FKs de consulta. CPF/placa e demais identificadores únicos continuam reservados em cadastros excluídos logicamente, acompanhando as verificações atuais da Nova OS. E-mail vazio não bloqueia outro cadastro sem e-mail.
- Constraints básicas de formato/faixa e tipo externo dos JSONs protegem a persistência. Não constituem validação completa de CPF, conteúdo de orçamento, histórico ou workflow no servidor.
- Revokes explícitos removem privilégios padrão de PUBLIC/anon/authenticated nas tabelas e sequência. São concedidos SELECT e UPDATE apenas nas colunas utilizadas pelo runtime, subordinados à RLS de equipe ativa. Não há INSERT/DELETE/TRUNCATE direto, escrita de vínculo Auth ou acesso direto à sequência para esses papéis. Criação usa somente RPC transacional.
- RLS habilitada em customers/vehicles/service_orders: equipe ativa opera; customer não lê tabelas completas nem escreve. A policy de user_profiles passa a permitir próprio perfil ou owner, fechando listagem por admin presente na migration anterior. As proteções existentes de alteração de permissões/owner permanecem.
- Funções privilegiadas usam `SECURITY DEFINER`, `search_path = ''`, referências qualificadas e identidade derivada de `auth.uid()`, nunca um usuário escolhido pelo cliente. Helpers privados não são endpoints de enumeração. As funções invoker/trigger já aplicadas de gestão de perfil continuam sem alterações.

RLS e grants são camadas complementares: RLS não protege operações como TRUNCATE. Referências da revisão: [PostgreSQL: segurança por linha](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) e [privilégios](https://www.postgresql.org/docs/current/ddl-priv.html).

### Contratos RPC revisados

| Função | Contrato |
| --- | --- |
| `try_link_my_customer()` | Só customer ativo; e-mail Auth confirmado/normalizado, conta única e cadastro livre/não excluído; locks e retorno do vínculo efetivamente gravado. Sem vínculo por nome. |
| `get_my_customer()` | Só cadastro próprio ativo: id, nome, telefone, e-mail, CPF e ano de cadastro. |
| `get_my_vehicles()` | Só veículos próprios não excluídos: identificação e atributos básicos. |
| `get_my_service_orders()` | Só OS próprias não excluídas: id, número, veículo, status e datas. Sem JSON/financeiro interno. |
| `create_service_order_atomic(...)` | Só equipe ativa; exatamente cliente existente ou novo e veículo existente ou novo; valida titularidade/exclusão e grava tudo numa transação. Não cria Auth. |
| `list_team_users()` | Só owner recebe lista mínima de perfis/e-mails, cargo, nível, ativo e vínculo. Outros níveis recebem lista vazia. |

Helpers privados: `is_team_member()` consulta nível ativo; `find_confirmed_auth_user(text)` só retorna uma conta confirmada e customer ativa quando não há ambiguidade, sem EXECUTE concedido aos papéis da API.

### Runtime corrigido e preservado

- Nova OS mantém Cliente → Veículo → Dados da OS → Confirmar. Rascunhos só são persistidos na confirmação. O formulário aguarda o resultado e bloqueia envio simultâneo; erros preservam valores. A OS aberta é a retornada pela RPC, não a mais recente de outro operador.
- Se a RPC confirmar gravação e a recarga falhar, a mensagem informa o número criado e pede recarga antes de nova tentativa. Erro de rede com resultado incerto não é tratado como garantia de rollback.
- Portal consome somente as projeções RPC acima; conta sem vínculo mantém estado vazio. Equipe permanece owner-only na UI e no banco após aplicação da migration pendente.
- Auth mantém sessão em falhas transitórias, oferece retry no login e invalida respostas antigas de perfil. Última conta guarda só metadados, sem senha/token customizado. Sessão real é gerida pelo SDK.
- Cloud começa sem seeds; dados existentes no banco não são apagados. Admin Local é DEV/localhost, adapter separado vazio por padrão. `pitgarage-pilot-v012` e fixtures históricas foram preservados, sem serem fonte operacional cloud.

### Validação e limites

- Typecheck e lint dos cinco arquivos TypeScript alterados aprovados. Testes isolados em memória com mocks aprovaram adapter DEV vazio, preservação do legado, bloqueio de bypass em produção, seleção da OS retornada, erro pós-gravação, portal somente por RPC, metadados permitidos e tradução de weak_password. Esses testes não executam SQL nem substituem testes de integração.
- Testes de Auth com hooks/SDK simulados aprovaram login com storage bloqueado, falhas transitórias sem logout, bloqueio de inativo e descarte de resposta de perfil após logout. Não simulam integralmente o ciclo de eventos real do SDK/navegador.
- Build final aprovado, com avisos do scaffold sobre `vite-tsconfig-paths` e `inlineDynamicImports`; nenhuma configuração fora do escopo foi alterada. Prettier dos arquivos TypeScript e `git diff --check` aprovados.
- A migration foi revisada estaticamente; não foi compilada/executada em PostgreSQL nesta continuação. RLS, funções, locks e aplicação completa ainda precisam de teste real. O estado remoto prévio de Auth/bootstrap é o informado pelo projeto, não foi reinspecionado.
- Controle de concorrência/idempotência de reenvios após queda de rede ainda não existe no servidor. O bloqueio do botão evita envio simultâneo na mesma tela, não duplicação entre abas ou após resultado incerto.
- Edições de OS continuam otimistas e sem versionamento de concorrência. JSONs internos e regras de workflow ainda dependem do domínio atual/frontend; não são trilha imutável de auditoria no banco. Não ampliado neste fechamento.
- Telefone único, CPF de validação básica e demais regras provisórias do piloto não foram transformados em requisitos definitivos. Backup local legado não é backup cloud. Tipos adicionados localmente deverão ser conferidos contra o schema aplicado.

### Testes obrigatórios após aplicação futura

1. Em ambiente autorizado, usar anon, customer A/B, customer sem vínculo, inativo, staff, admin e owner. Testar acesso direto às três tabelas e todas as RPCs; customer A nunca deve ler B, escrever, enumerar perfis ou obter JSON/custos internos. Inativo deve perder acesso mesmo com JWT ainda válido.
2. Testar grants contra INSERT/DELETE/TRUNCATE, sequência, atualização de `auth_user_id`/titularidade e promoção de perfil pela API, não apenas pela UI. Só owner lista/gerencia terceiros; nem owner pode promover outro owner ou rebaixar/desativar owner existente pelos caminhos normais.
3. Testar vínculo nos dois sentidos, e-mail não confirmado, normalização, e-mail vazio, conflito/ambiguidade, cadastro excluído e tentativas concorrentes. Nome igual sozinho não vincula.
4. Nova OS: existente+existente, existente+novo e novo+novo; cancelar em cada etapa; CPF/telefone/e-mail/placa duplicados; veículo de terceiro/excluído; cliente excluído; falha forçada no último insert com rollback de cliente/veículo. Validar duas criações concorrentes e numeração única.
5. Abrir exatamente a OS criada; simular rede indisponível antes/depois da resposta, duplo clique, recarga e preservação de rascunhos. Conferir antes de repetir gravação com resultado incerto.
6. Auth: sessão válida após reload, sessão expirada/revogada, falha transitória de perfil e getUser com retry, perfil ausente/inativo, logout durante consulta, troca de usuário e weak_password real. Conferir que última conta não contém senha/token.
7. Confirmar cloud vazio sem fixtures em base nova, legado intocado e DEV isolado. Testar portal com duas contas e exclusão de Auth em dados de teste, verificando retenção do histórico operacional. Executar testes destrutivos somente em ambiente/dados de teste autorizados.

### Próxima ação exata — manual e ainda não executada

No projeto correto do PitGarage no Lovable Cloud, abrir o editor SQL e conferir que a migration Auth já está aplicada e que a operacional ainda não foi executada. Executar **uma única vez o conteúdo integral do arquivo local revisado `supabase/migrations/20260902230000_create_operational_base.sql`**, incluindo BEGIN/COMMIT. Se houver tabelas/objetos operacionais inesperados, parar e reconciliar o estado antes de executar. Não reaplicar `20260902190000_prepare_auth_user_profiles.sql` nem bootstrap do owner. Depois executar a matriz acima e conferir os tipos antes de publicar o frontend. Esta ação exige uma próxima rodada/autorização e não faz parte desta continuação.

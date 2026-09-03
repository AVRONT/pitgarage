# Base operacional Supabase

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

Aplicar somente `supabase/migrations/20260902230000_create_operational_base.sql`, uma vez, no projeto correto. Depois validar RLS com contas isoladas, os dois sentidos do vínculo por e-mail confirmado, a transação da Nova OS, o portal do cliente e a gestão de equipe pelo owner antes de publicar o frontend.

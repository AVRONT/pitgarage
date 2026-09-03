# Proposta de autenticação, usuários e permissões

Status: **preparada localmente e não aplicada**. Supabase Auth é a proposta técnica desta rodada, não uma arquitetura definitiva aprovada. A migration não foi executada e nenhum dado remoto foi alterado.

## Recorte proposto

- Supabase Auth mantém identidade, sessão e senha. O PitGarage não terá sistema próprio de senhas nem armazenará senhas em tabelas da aplicação.
- `public.user_profiles` liga cada perfil a `auth.users.id` e guarda apenas nome, cargo operacional, nível de acesso, estado ativo/inativo e timestamps.
- Cargo operacional e nível de acesso são independentes. Cargos iniciais conhecidos: Dono, Atendente e Mecânico; outros poderão ser definidos depois.
- Novas contas recebem perfil `staff` inativo. Não existe regra automática de “primeiro usuário vira owner”.
- A migration proposta está em `supabase/migrations/20260902190000_prepare_auth_user_profiles.sql` e o bootstrap manual separado em `supabase/bootstrap/promote-first-owner.sql`.

## Regras provisórias codificadas

- `owner`: consulta e administra perfis; pode promover ou rebaixar `admin` e administrar `staff`.
- `admin`: consulta perfis e administra somente usuários que continuam `staff`.
- `staff`: consulta apenas o próprio perfil e não altera usuários nem permissões.
- Nenhum usuário pode promover alguém a `owner` pela API normal. Owner existente não pode ser desativado ou rebaixado pela API normal.
- Escritas usam grants mínimos, RLS e uma função `security invoker`; campos de identidade e segurança não podem ser substituídos fora das colunas permitidas.

Essas regras ainda dependem da validação da oficina. Em especial, continuam pendentes a matriz de ações, a visibilidade financeira, a equivalência entre donos e a responsabilidade por diagnóstico/serviço.

## Auditoria futura

O UUID estável do perfil permitirá que tabelas futuras registrem campos como `performed_by_user_id`, ligados a `user_profiles.user_id`. Clientes, veículos, OS, workflow, histórico e exclusão lógica continuam no piloto local e não foram alterados nesta rodada. Antes de migrar dados operacionais, deverá ser definida a retenção de autoria; usuários com histórico deverão ser desativados em vez de excluídos fisicamente.

Login será a base futura para auditoria, notificações e chat, mas nenhum desses fluxos foi implementado agora.

## Aplicação futura controlada

1. Validar a proposta e as regras provisórias com os responsáveis da oficina.
2. No projeto Supabase correto, revisar backup e ambiente antes de aplicar a migration versionada.
3. Aplicar a migration uma única vez e testar criação de conta, grants, RLS e bloqueios com usuários isolados `owner`, `admin` e `staff`.
4. Criar a conta real de Salomão pelo Supabase Auth, sem inserir ou copiar senha em SQL.
5. Confirmar o UUID real, nome e cargo; substituir os placeholders e executar uma única vez o bootstrap manual como operador de banco privilegiado.
6. Verificar que existe exatamente um owner ativo e que tentativas de autoelevação, administração por staff e alteração de owner por admin falham.
7. Somente em rodada posterior integrar telas de login/administração e definir a estratégia de convite. A migração de `localStorage` permanece fora deste escopo.

Antes da aplicação remota, a migration deve ser validada em um projeto Supabase local ou descartável. O trigger de criação de perfil participa do cadastro Auth; falhas nele podem bloquear novas contas.

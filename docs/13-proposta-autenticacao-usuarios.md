# Proposta de autenticação, usuários e permissões

Status: **runtime implementado localmente; migration ainda não aplicada**. Supabase Auth continua sendo a proposta técnica, não uma arquitetura definitiva aprovada. Nenhum dado remoto foi alterado.

## Recorte proposto

- Supabase Auth mantém identidade, sessão e senha. O PitGarage não terá sistema próprio de senhas nem armazenará senhas em tabelas da aplicação.
- `public.user_profiles` liga cada perfil a `auth.users.id` e guarda apenas nome, cargo operacional quando aplicável, nível de acesso, estado ativo/inativo e timestamps.
- Cargo operacional e nível de acesso são independentes. Cargos iniciais conhecidos: Dono, Atendente e Mecânico; outros poderão ser definidos depois.
- Novas contas recebem perfil `customer` ativo e não exigem cargo operacional. Não existe regra automática de “primeiro usuário vira owner”.
- A migration proposta está em `supabase/migrations/20260902190000_prepare_auth_user_profiles.sql` e o bootstrap manual separado em `supabase/bootstrap/promote-first-owner.sql`.

## Regras provisórias codificadas

- `owner`: consulta e administra perfis `customer`, `staff` e `admin`; owner existente continua protegido contra alteração pela API normal.
- `admin`: consulta perfis e administra somente usuários que permanecem `customer` ou `staff`; não alcança `admin` nem `owner`.
- `staff` e `customer`: consultam apenas o próprio perfil e não alteram usuários nem permissões.
- Nenhum usuário pode promover alguém a `owner` pela API normal. Owner existente não pode ser desativado ou rebaixado pela API normal.
- Escritas usam grants mínimos, RLS e uma função `security invoker`; campos de identidade e segurança não podem ser substituídos fora das colunas permitidas.

Essas regras ainda dependem da validação da oficina. Em especial, continuam pendentes a matriz de ações, a visibilidade financeira, a equivalência entre donos e a responsabilidade por diagnóstico/serviço.

## Auditoria futura

O UUID estável do perfil permitirá que tabelas futuras registrem campos como `performed_by_user_id`, ligados a `user_profiles.user_id`. Clientes, veículos, OS, workflow, histórico e exclusão lógica continuam no piloto local e não foram alterados nesta rodada. Antes de migrar dados operacionais, deverá ser definida a retenção de autoria; usuários com histórico deverão ser desativados em vez de excluídos fisicamente.

## Runtime local preparado

- `/login` usa Supabase Auth por e-mail e senha e permite criar uma conta de cliente. O PitGarage não armazena senhas; novos usuários recebem o perfil `customer` pelo trigger da migration.
- Quando a confirmação de e-mail estiver habilitada no Supabase, o cadastro orienta o cliente a confirmar o endereço antes do primeiro login; sem essa exigência, a sessão segue diretamente para `/cliente`.
- A rota principal exige sessão, perfil ativo e nível `staff`, `admin` ou `owner`. Sessão válida é restaurada pelo Supabase após reload; perfil ausente ou inativo encerra a sessão e mostra orientação clara.
- Perfil `customer` autenticado é direcionado exclusivamente para `/cliente`, que exibe somente identidade, aviso de conteúdo futuro e logout, sem montar a aplicação interna ou acessar seus dados locais.
- O header identifica nome, cargo/nível, e-mail da conta real e oferece logout.
- Em build de desenvolvimento, somente nos hosts `localhost` e `127.0.0.1`, uma identidade efêmera `Admin Local`/`owner` permite trabalhar sem criar conta ou senha. O mesmo contrato de autenticação expõe `actorId: "local:admin"` e `userId: null`, evitando que auditorias futuras tentem gravar esse ator como UUID real.
- O bypass é compilado como inativo em produção. Não depende de variável configurável, senha ou usuário remoto.
- Recuperação de senha não foi exposta enquanto URL de redirecionamento e fluxo de definição da nova senha não estiverem configurados e testados no Supabase.

Login passa a ser a base futura para auditoria, notificações e chat, mas esses recursos não foram implementados agora.

## Aplicação futura controlada

1. Validar a proposta e as regras provisórias com os responsáveis da oficina.
2. No projeto Supabase correto, revisar backup e ambiente antes de aplicar a migration versionada.
3. Aplicar a migration uma única vez e testar criação de conta, grants, RLS e bloqueios com usuários isolados `customer`, `staff`, `admin` e `owner`.
4. Criar a conta real de Salomão pelo Supabase Auth, sem inserir ou copiar senha em SQL.
5. Confirmar o UUID real, nome e cargo; substituir os placeholders e executar uma única vez o bootstrap manual como operador de banco privilegiado.
6. Verificar que existe exatamente um owner ativo e que tentativas de autoelevação, administração por customer/staff e alteração de owner por admin falham.
7. Publicar o runtime já preparado e validar login, persistência da sessão, perfil inativo e logout no ambiente conectado.
8. Somente em rodada posterior implementar Configurações > Equipe e definir convite/recuperação de senha. A migração de `localStorage` permanece fora deste escopo.

Antes da aplicação remota, a migration deve ser validada em um projeto Supabase local ou descartável. O trigger de criação de perfil participa do cadastro Auth; falhas nele podem bloquear novas contas.

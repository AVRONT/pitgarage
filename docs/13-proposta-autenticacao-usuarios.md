# Autenticação, usuários e permissões

Status: **base de autenticação aplicada no Supabase do Lovable Cloud**. Este documento nasceu como proposta e preserva as decisões preparatórias, mas a migration, o trigger e o primeiro owner já estão efetivamente configurados. Os dados operacionais ainda não foram migrados.

## Base preparada e aplicada

- Supabase Auth mantém identidade, sessão e senha. O PitGarage não terá sistema próprio de senhas nem armazenará senhas em tabelas da aplicação.
- `public.user_profiles` liga cada perfil a `auth.users.id` e guarda apenas nome, cargo operacional quando aplicável, nível de acesso, estado ativo/inativo e timestamps.
- Cargo operacional e nível de acesso são independentes. Cargos iniciais conhecidos: Dono, Atendente e Mecânico; outros poderão ser definidos depois.
- Novas contas recebem perfil `customer` ativo e não exigem cargo operacional. Não existe regra automática de “primeiro usuário vira owner”.
- A migration versionada está em `supabase/migrations/20260902190000_prepare_auth_user_profiles.sql` e foi aplicada no Supabase do Lovable Cloud.
- O bootstrap manual separado em `supabase/bootstrap/promote-first-owner.sql` foi executado uma única vez para o UUID real de Salomão. Ele está ativo como `owner`, com cargo `Proprietário`. **O bootstrap não deve ser executado novamente.**
- O trigger foi testado com sucesso: um novo usuário gerou perfil `customer` ativo. O usuário criado exclusivamente para esse teste foi removido.

## Regras de acesso aplicadas

- `owner`: consulta e administra perfis `customer`, `staff` e `admin`; owner existente continua protegido contra alteração pela API normal.
- `admin`: consulta perfis conforme a policy vigente, mas não altera `access_level` nem promove ou rebaixa usuários.
- `staff` e `customer`: consultam apenas o próprio perfil e não alteram usuários nem permissões.
- Somente `owner` pode alterar `access_level` entre `customer`, `staff` e `admin`. Nenhum usuário pode promover alguém a `owner` pela API normal, e o owner existente não pode ser desativado ou rebaixado por esse fluxo.
- Escritas usam grants mínimos, RLS e uma função `security invoker`; campos de identidade e segurança não podem ser substituídos fora das colunas permitidas.

Essas regras ainda dependem da validação da oficina. Em especial, continuam pendentes a matriz de ações, a visibilidade financeira, a equivalência entre donos e a responsabilidade por diagnóstico/serviço.

## Auditoria futura

O UUID estável do perfil permitirá que tabelas futuras registrem campos como `performed_by_user_id`, ligados a `user_profiles.user_id`. Clientes, veículos, OS, workflow, histórico e exclusão lógica continuam no piloto local e não foram alterados nesta rodada. Antes de migrar dados operacionais, deverá ser definida a retenção de autoria; usuários com histórico deverão ser desativados em vez de excluídos fisicamente.

## Runtime implementado

- `/login` usa Supabase Auth por e-mail e senha e permite criar uma conta de cliente. O PitGarage não armazena senhas; novos usuários recebem o perfil `customer` pelo trigger da migration.
- Quando a confirmação de e-mail estiver habilitada no Supabase, o cadastro orienta o cliente a confirmar o endereço antes do primeiro login; sem essa exigência, a sessão segue diretamente para `/cliente`.
- A rota principal exige sessão, perfil ativo e nível `staff`, `admin` ou `owner`. Sessão válida é restaurada pelo Supabase após reload; perfil ausente ou inativo encerra a sessão e mostra orientação clara.
- Perfil `customer` autenticado é direcionado exclusivamente para `/cliente`, que exibe somente identidade, aviso de conteúdo futuro e logout, sem montar a aplicação interna ou acessar seus dados locais.
- O header identifica nome, cargo/nível, e-mail da conta real e oferece logout.
- Em build de desenvolvimento, somente nos hosts `localhost` e `127.0.0.1`, uma identidade efêmera `Admin Local`/`owner` permite trabalhar sem criar conta ou senha. O mesmo contrato de autenticação expõe `actorId: "local:admin"` e `userId: null`, evitando que auditorias futuras tentem gravar esse ator como UUID real.
- O bypass é compilado como inativo em produção. Não depende de variável configurável, senha ou usuário remoto.
- O dispositivo pode lembrar somente nome, e-mail e iniciais da última conta. Senha, token e segredo continuam exclusivamente sob responsabilidade do Supabase.
- Falha transitória ao consultar `user_profiles` mantém a sessão e oferece nova tentativa; perfil comprovadamente ausente ou inativo continua bloqueado.
- Recuperação de senha não foi exposta enquanto URL de redirecionamento e fluxo de definição da nova senha não estiverem configurados e testados no Supabase.

### Fechamento da revisão local — 2026-09-02

- A descrição acima da Área do Cliente inicial registra a etapa anterior. O runtime operacional pendente agora usa `get_my_customer`, `get_my_vehicles` e `get_my_service_orders`, sem consulta direta às tabelas internas pelo portal. Exige vínculo próprio e perfil customer ativo.
- A migration operacional pendente restringe a leitura de outros perfis a owner; a policy de leitura da migration Auth aplicada ainda admitia admin. O arquivo histórico aplicado não foi modificado. A UI de Equipe já restringia gestão a owner; seus controles e a proteção contra promoção/rebaixamento/desativação de owner foram preservados.
- `Continuar como...` reutiliza e-mail, não autentica por metadados. O registro de última conta aceita somente nome/e-mail/iniciais. Bloqueio de armazenamento não interrompe login. A persistência de sessão/renovação pertence ao SDK Supabase e não a tokens customizados do PitGarage.
- Falha transitória de perfil ou da verificação durante retry não apaga a sessão. Login oferece nova tentativa de carregar perfil. Perfil realmente ausente/inativo bloqueia acesso; sessão inexistente/inválida exige autenticação novamente. Respostas antigas de perfil são invalidadas ao trocar/encerrar sessão.
- `weak_password` continua traduzido como senha muito fraca, mantendo a validação real no Auth. Não houve teste remoto de login/revogação nesta revisão.

Login passa a ser a base futura para auditoria, notificações e chat, mas esses recursos não foram implementados agora.

## Aplicação realizada e próximos passos

Concluído:

1. Migration aplicada no Supabase do Lovable Cloud.
2. Trigger validado com criação automática de perfil `customer` ativo; usuário de teste removido depois da validação.
3. Conta real de Salomão criada no Supabase Auth.
4. Bootstrap executado uma única vez; Salomão confirmado como `owner` ativo e cargo `Proprietário`.

`Configurações > Equipe` foi preparada para owner com consulta mínima via RPC e alteração pelos controles já protegidos no banco. A nova base operacional e seu vínculo com clientes estão documentados separadamente e ainda aguardam aplicação remota. Convite e recuperação de senha continuam posteriores.

# Evolução cloud integrada

Estado: preparada localmente em 03/09/2026; migrations e Edge Functions ainda não publicados.

## Banco e segurança

Aplicar, exatamente nesta ordem:

1. `20260903190000_create_calendar.sql`;
2. `20260903191000_create_security_notifications.sql`;
3. `20260903192000_create_chat.sql`.

As migrations criam `calendar_events`, `developer_access`, `access_events`, `registration_attempts`, `notifications`, `conversations`, `conversation_members` e `messages`. Toda tabela nasce com RLS. Agenda é interna; auditoria é exclusiva de `developer_access`; notificações pertencem ao destinatário; suporte liga somente o customer autenticado à equipe e conversa direta exige participação.

O acesso técnico não altera `access_level`. Nenhum usuário foi incluído automaticamente. Depois da migration, um administrador do banco deve inserir manualmente UUIDs confirmados em `developer_access`; owner, admin, staff e customer não recebem essa permissão por seu nível operacional.

Exemplo manual, substituindo o UUID somente depois de confirmá-lo no Auth:

```sql
insert into public.developer_access (user_id, label)
values ('UUID_CONFIRMADO', 'Desenvolvedor autorizado');
```

## Edge Functions

Publicar `register-account`, `access-event` e `invite-user`. Configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` somente no servidor; opcionalmente `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY` no build e `ALLOWED_ORIGIN`.

Os limites ficam centralizados em `register-account`: 3 cadastros/24h por dispositivo, 5 tentativas/1h e 10/24h por IP. O IP vem de headers da infraestrutura e o identificador aleatório do navegador é armazenado como hash. Senhas não são registradas.

O endpoint padrão de signup do Supabase continua sendo um caminho de bypass caso permaneça utilizável diretamente. Para proteção completa, a configuração remota deve exigir CAPTCHA/Turnstile no Auth e restringir o fluxo público ao endpoint controlado, conforme os recursos oferecidos pelo projeto.

## Funcionalidades e limites

- Agenda: mês, lista, busca, criação, edição e cancelamento lógico; cliente não acessa.
- `/dev`: build/ambiente, acessos, IP, dispositivo e bloqueios; protegida por RPC. Admin Local tem painel vazio somente em DEV.
- Recuperação: e-mail genérico, `/reset-password`, senha fraca e link inválido tratados.
- Convites: Auth Admin apenas no Edge Function e somente owner; não define senha nem cria cadastro operacional.
- Notificações: sino, leitura individual/total e eventos relevantes de OS; lembretes de Agenda não usam cron nesta fase.
- Chat: canal Equipe, estrutura para direto e atendimento privado, texto, unread e Realtime. Anexos não entram. Presence/typing ficaram preparados conceitualmente, mas não foram ativados para evitar complexidade e subscriptions adicionais nesta primeira versão.
- Portal: preserva RPCs sanitizadas e isolamento; mostra veículos, OS e contadores. Aprovação de orçamento e upload permanecem adiados.

Depois de aplicar as migrations, regenerar `src/integrations/supabase/types.ts` a partir do schema remoto e validar RLS com contas separadas de customer, equipe, owner e developer.

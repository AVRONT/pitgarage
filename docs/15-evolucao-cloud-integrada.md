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

Os limites ficam centralizados em `registration_rate_limits`: 3 cadastros concluídos/24h por dispositivo, 5 tentativas relevantes/1h e 10/24h por IP. O IP universal vem exclusivamente de `metadata.ip_address` do Auth Hook. O identificador aleatório do navegador é um sinal auxiliar, pode ser apagado ou trocado e é armazenado somente como hash. Senhas e tokens CAPTCHA não são registrados.

### Proteção do endpoint oficial de Auth

A migration cria `public.before_user_created(event jsonb)`, compatível com o Supabase Auth **Before User Created Hook**. O hook serializa requisições por IP, registra uma única tentativa e bloqueia com resposta genérica `429` quando o IP ultrapassa 5 tentativas em 1h ou 10 em 24h. Assim, o limite de IP também cobre chamadas diretas ao endpoint oficial de signup.

Depois de aplicar a migration, ainda é obrigatório ativar manualmente `Authentication > Hooks > Before User Created` no Supabase e selecionar a função `public.before_user_created` (URI equivalente: `pg-functions://postgres/public/before_user_created`). Sem essa ativação, a função existe, mas não protege o endpoint.

O fluxo `register-account` cria uma tentativa `pending` e envia seu UUID técnico no metadata. O hook aceita a correlação somente quando UUID, hash de e-mail, IP e janela curta coincidem; por isso Edge Function e hook atualizam a mesma linha, sem dupla contagem. O hook registra tentativas e bloqueios; a Edge Function marca `succeeded` somente após o Auth confirmar a criação.

Convites de owner criam uma exceção server-side, por hash de e-mail, válida por 15 minutos e consumida uma única vez pelo hook. O navegador não pode criar essa exceção. Se o Auth Admin rejeitar o convite, a Edge Function remove a exceção remanescente. Isso evita bloquear convites legítimos sem afrouxar o cadastro público.

Também é obrigatório habilitar a proteção CAPTCHA nativa do Supabase Auth com Cloudflare Turnstile em `Authentication > Bot and Abuse Protection`, configurando a secret key no painel. O frontend usa `VITE_TURNSTILE_SITE_KEY`; a Edge Function valida com `TURNSTILE_SECRET_KEY` e encaminha o token ao Auth. Desenvolvimento local sem essas chaves continua funcionando sem CAPTCHA.

Rate limiting reduz abuso, mas não elimina ataques. IP pode ser compartilhado por famílias ou empresas, CGNAT pode agrupar muitos usuários e VPNs podem trocar o endereço observado. Os limites devem ser monitorados após a ativação para equilibrar bloqueio e falsos positivos.

## Funcionalidades e limites

- Agenda: mês, lista, busca, criação, edição e cancelamento lógico; cliente não acessa.
- `/dev`: build/ambiente, acessos, IP, dispositivo e bloqueios; protegida por RPC. Admin Local tem painel vazio somente em DEV.
- Recuperação: e-mail genérico, `/reset-password`, senha fraca e link inválido tratados.
- Convites: Auth Admin apenas no Edge Function e somente owner; não define senha nem cria cadastro operacional.
- Notificações: sino, leitura individual/total e eventos relevantes de OS; lembretes de Agenda não usam cron nesta fase.
- Chat: canal Equipe, estrutura para direto e atendimento privado, texto, unread e Realtime. Anexos não entram. Presence/typing ficaram preparados conceitualmente, mas não foram ativados para evitar complexidade e subscriptions adicionais nesta primeira versão.
- Portal: preserva RPCs sanitizadas e isolamento; mostra veículos, OS e contadores. Aprovação de orçamento e upload permanecem adiados.

Depois de aplicar as migrations, regenerar `src/integrations/supabase/types.ts` a partir do schema remoto e validar RLS com contas separadas de customer, equipe, owner e developer.

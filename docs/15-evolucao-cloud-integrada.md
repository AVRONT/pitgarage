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

Publicar `register-account`, `access-event` e `invite-user`. As funções preferem as chaves hospedadas atuais `SUPABASE_PUBLISHABLE_KEY(S)` e `SUPABASE_SECRET_KEY(S)`, mantendo fallback para `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Nenhuma chave secreta vai para o navegador. Configuração manual adicional fica limitada a `VITE_TURNSTILE_SITE_KEY` no build e, opcionalmente, `ALLOWED_ORIGIN`.

Os limites ficam centralizados em `registration_rate_limits`: 3 cadastros concluídos/24h por dispositivo, 5 tentativas relevantes/1h e 10/24h por IP. A Edge Function faz um pré-check usando o IP observado na requisição original e falha com segurança quando ele não existe. Para o fluxo correlacionado, o hook usa esse IP server-side já persistido; em signup direto, usa exclusivamente `metadata.ip_address` do Auth Hook. O identificador aleatório do navegador é um sinal auxiliar, pode ser apagado ou trocado e é armazenado somente como hash. Senhas e tokens CAPTCHA não são registrados.

### Proteção do endpoint oficial de Auth

A migration cria `public.before_user_created(event jsonb)`, compatível com o Supabase Auth **Before User Created Hook**. O hook serializa requisições por IP, registra uma única tentativa e bloqueia com resposta genérica `429` quando o IP ultrapassa 5 tentativas em 1h ou 10 em 24h. Assim, o limite de IP também cobre chamadas diretas ao endpoint oficial de signup.

Depois de aplicar a migration, ainda é obrigatório ativar manualmente `Authentication > Hooks > Before User Created` no Supabase e selecionar a função `public.before_user_created` (URI equivalente: `pg-functions://postgres/public/before_user_created`). Sem essa ativação, a função existe, mas não protege o endpoint.

O fluxo `register-account` cria uma tentativa `pending` e envia seu UUID técnico no metadata, sem devolvê-lo ao navegador. O hook aceita a correlação somente quando UUID, hash de e-mail, estado `pending` e janela de até cinco minutos coincidem; por isso Edge Function e hook atualizam a mesma linha, sem dupla contagem. A igualdade com o IP observado pelo Auth não é exigida nesse caminho, pois a chamada ao Auth parte da Edge Function. O hook registra tentativas e bloqueios; a Edge Function marca `succeeded` somente quando o retorno contém uma nova identidade. Respostas sanitizadas para e-mail já existente permanecem genéricas e não consomem o limite de cadastros concluídos por dispositivo.

Convites de owner criam uma exceção server-side, por hash de e-mail, válida por 15 minutos e consumida uma única vez pelo hook. O navegador não pode criar essa exceção. Se o Auth Admin rejeitar o convite, a Edge Function remove a exceção remanescente. Isso evita bloquear convites legítimos sem afrouxar o cadastro público.

Também é obrigatório habilitar a proteção CAPTCHA nativa do Supabase Auth com Cloudflare Turnstile em `Authentication > Bot and Abuse Protection`, configurando a secret key somente no painel do Auth. O frontend usa `VITE_TURNSTILE_SITE_KEY` e `register-account` apenas encaminha `captchaToken` ao `auth.signUp`; o token single-use é validado uma única vez pelo mecanismo nativo. `TURNSTILE_SECRET_KEY` não é necessária na Edge Function. Desenvolvimento local sem a site key continua funcionando enquanto o CAPTCHA remoto ainda não estiver habilitado.

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

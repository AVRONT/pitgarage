# Proteção antiabuso — preparação local de 04/09/2026

Nada foi aplicado remotamente. Agenda, workflow, dados e versões antigas não foram alterados.

## Antes e agora

- Cadastro já tinha limites configuráveis em `registration_rate_limits`, tentativas, CAPTCHA encaminhado e Hook preparado contra signup direto. O pré-check da Edge contava e inseria separadamente.
- Agora `reserve_registration_attempt` reserva atomicamente usando os mesmos registros, configuração e lock por IP do Hook. Reserva também por dispositivo, contando sucessos e reservas em processamento (até cinco minutos). Não gera uma linha adicional para cada repetição já bloqueada.
- Convite já verificava JWT e owner ativo e criava exceção curta para o Hook. Agora reserva cota antes da exceção e antes de Auth Admin, e aceita somente POST.
- Chat já verificava acesso à conversa; Nova OS já exigia equipe e transação. Novos triggers impõem cota na inserção real, inclusive via RPC ou eventual chamada direta autorizada. Chat também exige perfil ativo e remetente igual ao usuário autenticado.
- Equipe já tinha RLS de owner, RPC invoker e proteção contra desativação/rebaixamento. Trigger adicional protege promoção/criação de outro owner, alteração de identidade e exclusão do owner, exige owner ativo no UPDATE e impõe cota. O trigger anterior e a RPC não são substituídos.
- Não há exceção automática para escrita operacional sem usuário: rotinas administrativas de importação/recuperação precisam de procedimento revisado. Credenciais privilegiadas/administrador SQL não são uma fronteira contra um operador capaz de alterar o schema.

## Limites preparados para revisão

| Ponto | Limite | Aplicação |
| --- | --- | --- |
| Cadastro | Valores existentes: 5 tentativas/h e 10/24h por IP; 3 sucessos/24h por dispositivo, incluindo reservas em curso | Reserva PostgreSQL na Edge; Hook existente cobre signup direto quando ativado |
| Login/signup nativo | 60 requisições/5 minutos por IP, proposta local | Auth `sign_in_sign_ups`; confirmar equivalente no serviço hospedado |
| Recuperação | Intervalo mínimo de 60 segundos para novo e-mail; orçamento proposto de 100 e-mails/h compartilhado no projeto, não exclusivo da recuperação | Auth `email.max_frequency` e `rate_limit.email_sent`; orçamento maior depende de SMTP próprio |
| Chat | 120 mensagens/min e 2.000/h por usuário, somando conversas | Trigger em `messages` |
| Nova OS | 30/min e 300/h por usuário | Trigger em `service_orders` |
| Convites | 20/h e 50/24h por owner autenticado | Reserva service-only antes de Auth Admin |
| Equipe | 30 alterações/min e 200/h por owner | Trigger em `user_profiles` |

Chat/OS são deliberadamente folgados para barrar automação, não cadência humana. Limites operacionais são janelas fixas iniciadas na primeira ação: pode haver rajada na transição, não equivalem a janela móvel. Contadores são atômicos e têm uma linha por ator/ação/duração; não crescem a cada mensagem. Escritas revertidas não consomem cota. Convites reservados contam mesmo se o envio falhar. Não há bloqueio permanente ou por conta-alvo no login que permita a terceiros travar uma vítima.

Cadastro conserva janelas móveis de contagem. Dispositivo continua sendo sinal auxiliar controlável pelo navegador, nunca substituto de IP confiável e CAPTCHA. O IP da Edge depende de o gateway sobrescrever headers de origem; verificar isso na infraestrutura hospedada antes da ativação. Não confiar em headers arbitrários de um cliente ou proxy não configurado.

## O que falta, exatamente

1. Revisar esta proposta e conferir o histórico remoto de migrations. Aplicar somente a nova `20260904020000_harden_abuse_protection.sql` após confirmar as bases Auth, operacional, segurança e Chat existentes. Não reaplicar migrations duplicadas; não há dependência da substituição das RPCs da evolução do Chat.
2. Republicar **as duas Edge Functions existentes**, `register-account` e `invite-user`, depois da migration. Sem os novos RPCs, elas falham de forma fechada (503); não publicar antes.
3. Ativar o **Before User Created Hook** existente (`public.before_user_created`), se ainda não ativo. Sem ele, cadastro direto não passa pela reserva da Edge.
4. Configurar Turnstile no Auth, secret somente no servidor/painel; disponibilizar `VITE_TURNSTILE_SITE_KEY` no frontend e testar cadastro, login e recuperação antes de habilitar para todos. Os três fluxos já encaminham o token. CAPTCHA é validado pelo Auth, não apenas pelo botão.
5. Conferir/aplicar os limites nativos no painel hospedado. As entradas em `supabase/config.toml` são preparação local, **não alteram produção**. Confirmar SMTP próprio antes de adotar 100 e-mails/h; o provedor padrão do Supabase limita a 2/h. Verificar URL de retorno `/reset-password`. Não reduzir limites vigentes maiores sem avaliar usuários compartilhando IP.
6. Validar em ambiente autorizado: limites e chamadas concorrentes, retorno 429, liberação após janela, rollback de Nova OS, proteção do owner e tentativas diretas via REST/RPC. Não usar produção para spam de teste.

Nenhuma Edge Function nova. Uma migration nova, uma tabela privada de contadores e duas RPCs exclusivas de `service_role`. Nenhum secret novo para as Edge Functions. Não enviar credenciais do servidor ao cliente.

## Validação local e limites da revisão

Testes Node executam os handlers Edge com serviços simulados: negação de acesso, ator validado, bloqueio antes do efeito externo, falha fechada e correlação/CAPTCHA do cadastro. Verificação estática adicional dos triggers/grants. Esses testes não substituem execução PostgreSQL/RLS/concor­rência nem Auth real. PostgreSQL, Deno e Docker não estavam disponíveis neste ambiente; nenhum teste remoto foi executado.

Fontes oficiais consultadas: [configuração Auth](https://supabase.com/docs/guides/local-development/cli/config), [rate limits](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha). Valores publicados e configuração hospedada devem ser conferidos antes do deploy.

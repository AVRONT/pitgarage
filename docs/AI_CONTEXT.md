# Projeto

**PITGARAGE** é um projeto de sistema de gestão para uma oficina real de carros e motos. Seu objetivo é centralizar informações hoje distribuídas entre WhatsApp, papéis, planilhas, cadernos e memória, com simplicidade e rastreabilidade.

# Como uma IA deve trabalhar neste repositório

Qualquer ChatGPT, Codex ou outra IA deve:

1. ler este arquivo antes de trabalhar;
2. consultar os documentos relacionados à tarefa no [índice da documentação](README.md);
3. preservar todo o histórico e nunca apagar ou substituir informações silenciosamente;
4. nunca assumir que o scaffold ou qualquer código existente representa uma decisão técnica aprovada;
5. não inventar requisitos, regras, permissões ou decisões;
6. registrar dúvidas em [questões pendentes](10-questoes-pendentes.md) em vez de inventar respostas;
7. atualizar o contexto documental correspondente ao terminar qualquer tarefa relevante.

Antes de encerrar uma tarefa que altere requisitos, regras de negócio, MVP, roadmap, arquitetura, banco, interface, código, decisões técnicas ou processos da oficina, verificar:

- Este `AI_CONTEXT.md` continua correto?
- Alguma decisão mudou?
- O [`CHANGELOG.md`](../CHANGELOG.md) precisa ser atualizado?
- A alteração exige uma nova versão documental?
- Alguma informação anterior corre risco de ser perdida?

Se alguma resposta for sim, a documentação deve ser atualizada antes do encerramento.

# Estado atual

## Cloud/produção em 03/09/2026

Estado canônico atualizado conforme a confirmação do responsável pelo projeto nesta rodada documental; não houve consulta ao ambiente remoto. O PitGarage já tem frontend cloud funcional, Supabase Auth real, Salomão como `owner`, níveis `customer`, `staff`, `admin` e `owner`, base operacional de clientes/veículos/OS, Agenda, notificações e Chat publicados. Realtime está ativo para `notifications` e `messages`.

Também estão publicados os Edge Functions `register-account`, `access-event` e `invite-user`, recuperação de senha, convites, gestão de Equipe, cargos estruturados, estrutura `developer_access`, rota `/dev`, mecanismos de antiabuso, RLS e preservação de histórico. A existência desses recursos não significa que as configurações manuais pendentes abaixo tenham sido concluídas. Auth e bootstrap do primeiro owner não devem ser reaplicados.

O vínculo técnico `developer_access` existe, mas ainda não recebeu os UUIDs reais dos desenvolvedores. `public.before_user_created` existe no banco, porém o Before User Created Hook ainda não está ativado no Auth; portanto não se deve afirmar que esse hook já protege signup direto. Turnstile está preparado, mas suas chaves não estão configuradas. Redirect URLs, incluindo `/reset-password`, ainda precisam de conferência manual.

Somente a evolução de Chat `supabase/migrations/20260904010000_improve_chat_experience.sql` permanece explicitamente pendente de aplicação remota nesta atualização. Até sua aplicação/validação, podem aparecer “Conversa direta” sem nome e “Nenhuma mensagem ainda”, faltar `display_name`, `last_message` e `last_message_at`, e o novo agrupamento de notificações não está validado remotamente. Não confundir essa pendência com ausência da base de Chat já publicada.

Há migrations semanticamente equivalentes: preservar todas, não remover nem fazer migration repair sem conferir antes `supabase_migrations.schema_migrations`. Publicação dos recursos não comprova quais identificadores de migration constam no histórico remoto.

Referências: `fae6fa3` (Agenda/segurança/notificações/Chat), `5264532` (Auth Hook/Turnstile), `88014cb` (inconsistências pré-cloud), `5ed74c4` (dictionaries de chaves Edge), `56e45c2` (preserva contexto de `supabase.rpc`) e `ee732fd` (cargos/experiência do Chat, informado pelo responsável). Neste checkout, HEAD é `56e45c2`; `ee732fd` e o arquivo `20260904010000_improve_chat_experience.sql` não estavam disponíveis na conferência local. Isso não altera o estado cloud informado, mas exige obter/conferir o arquivo correto antes da futura aplicação, sem recriá-lo por suposição.

# Histórico veicular interno — evolução local de 04/09/2026

- Detalhe do veículo reutiliza as OS do repositório operacional já carregadas, filtradas por veículo; nenhum acesso direto ao Supabase no componente, schema novo ou ampliação do portal `/cliente`.
- Timeline ordenada pela data de entrada, da mais recente à mais antiga; datas ausentes/inválidas ficam ao final, preservando a ordem recebida em empates. Última passagem usa a entrada mais recente disponível.
- Última km conhecida usa a entrada válida da OS datada mais recente com quilometragem registrada; sem essa informação, usa o cadastro do veículo. A origem é mostrada, pois o cadastro não possui data específica da medição. Não usa o maior hodômetro nem inventa atualização.
- Serviços/peças exibidos como executados somente com `executed === true`. Total é explicitamente **aprovado no orçamento**, não pago/executado; sem itens aprovados ou com preços incompletos, aparece indisponível.
- Não há registro específico de garantia no modelo operacional atual. O histórico não calcula vigência a partir da simulação de 30 dias; garantia demonstrativa da OS e dos documentos permanece intacta.
- Campos antigos ausentes recebem mensagens neutras. Status atual distingue atendimento em andamento das três etapas finais, sem inferir execução nem mudar workflow/regressão. Detalhes expansíveis e “Ver ordem completa” usam a navegação existente.
- Validação local: 8 testes de projeção (`node --test tests/vehicle-history.test.mjs`) e navegador com APIs simuladas, sem OS, em andamento, múltiplas concluídas, campos ausentes, ordenação, navegação e resoluções 1366×768, 768×1024 e 390×844. Nenhuma validação remota, migration, deploy, commit ou push nesta rodada.

# Registros históricos de preparação — não representam o estado atual de deploy

Os textos abaixo preservam o que era verdadeiro em cada rodada local. Instruções antigas de publicar Auth/base operacional/Agenda/Chat/Edge Functions não são a próxima ação atual. O estado vigente está acima e as pendências/etapas vigentes estão ao final deste documento.

## Evolução cloud preparada em 03/09/2026

A base operacional Supabase já foi aplicada no Lovable Cloud. A rodada atual prepara, apenas localmente, três migrations posteriores para Agenda, segurança/notificações e chat. Elas ainda não foram aplicadas. Também foram preparados os Edge Functions `register-account`, `access-event` e `invite-user`, ainda sem deploy.

O runtime passa a prever Agenda interna, permissão técnica independente em `developer_access`, rota protegida `/dev`, registro server-side de IP/dispositivo, rate limit de cadastro, Turnstile opcional, recuperação de senha, convites exclusivos do owner, portal do cliente ampliado, notificações e chat Realtime. Sem as novas migrations e Edge Functions publicados, os recursos cloud novos não estarão operacionais; o bypass `Admin Local` permanece isolado e não simula gravações cloud.

A migration de segurança pendente inclui `public.before_user_created`, que deve ser ativada manualmente como Auth Hook depois da aplicação. O limite universal por IP cobre o endpoint oficial de signup; o fluxo da Edge é correlacionado ao IP original persistido e o limite por dispositivo permanece auxiliar. Cloudflare Turnstile deve ser habilitado na proteção CAPTCHA nativa do Auth, único ponto de validação do token encaminhado pela Edge Function. Convites do owner usam exceção server-side curta e não contam como cadastro público.

O projeto está na fase **Piloto v0.1.15 — segurança e consistência histórica local**, ainda vinculada à **v2 — Entrada na fase piloto**. Documentos de uma OS passam a congelar os dados da oficina na conclusão guiada do serviço, com fallback para configurações atuais em registros antigos. Configurações oferecem exportação e importação validada de backup JSON completo do piloto, e os registros persistidos passam a declarar versão de schema sem exigir reset. A identidade clara da v0.1.14, Nova OS, workflow, stepper, regressões, exclusão lógica e demais regras permanecem intactos. As regras de fechamento e documentos continuam demonstrativas e sujeitas à validação. O piloto não é o MVP aprovado e não define arquitetura, banco ou infraestrutura de produção.

A base de Supabase Auth está aplicada no Lovable Cloud com perfis e níveis `customer`, `staff`, `admin` e `owner`. A migration `20260902190000_prepare_auth_user_profiles.sql` e o bootstrap único do primeiro owner já foram executados; Salomão está ativo como `owner`, com cargo `Proprietário`, e o bootstrap não deve ser repetido. Novas contas podem ser criadas em `/login`, nascem como `customer` ativas e usam somente `/cliente`; o sistema interno exige `staff`, `admin` ou `owner`, e somente `owner` pode alterar `access_level`. O runtime mantém sessão, logout, proteção por área, indicador da equipe e bypass `Admin Local` restrito a desenvolvimento em localhost.

A primeira base operacional Supabase e suas estruturas de clientes, veículos, OS, vínculo, RLS e RPCs já foram aplicadas no Lovable Cloud. Usuários reais usam o repositório cloud; `Admin Local` usa adapter separado, vazio e sem `service_role`. As fixtures e `pitgarage-pilot-v012` não são apagadas, porém não carregam como fonte real; o backup JSON legado não protege cloud.

Revisão final local de 2026-09-02: a migration operacional pendente recebeu fechamento de grants, acesso ao portal por projeções mínimas e perfil ativo, listagem de perfis exclusiva do owner (além do próprio perfil), vínculo sem ambiguidade e proteções da transação de Nova OS. O formulário aguarda a gravação sem descartar rascunhos em erro; Auth preserva sessão em falhas transitórias e ignora respostas de perfil desatualizadas. A migration Auth aplicada e o bootstrap não foram alterados nem repetidos. Isso é revisão estática/local, não validação remota de RLS: os testes obrigatórios e a próxima ação manual estão em [base operacional](14-base-operacional-supabase.md#fechamento-da-revisão-local--2026-09-02). Não publicar o runtime cloud antes dessa validação.

# Documentação atual

Registro histórico do RC de 03/09/2026: **pré-release cloud / release candidate local**, ainda não liberado naquela rodada. Revisão sobre `943265c`, com detecção de conflito na escrita de OS, confirmação de linhas gravadas, fila local de escritas e correções pontuais de UX/mobile. As duas migrations e o bootstrap ficaram intocados naquela rodada; a operacional era somente local. Ver [relatório histórico de RC e checklist](piloto/pre-release-cloud-rc.md). Essa descrição registra a etapa anterior à publicação; não substitui o estado canônico cloud acima nem determina reaplicação de migrations.

- [Visão e processo atual](README.md#documentos)
- [Requisitos funcionais](04-requisitos-funcionais.md)
- [Requisitos não funcionais](05-requisitos-nao-funcionais.md)
- [Regras de negócio](06-regras-de-negocio.md)
- [Perfis e permissões](07-perfis-e-permissoes.md)
- [Proposta de MVP](08-mvp.md)
- [Base operacional Supabase](14-base-operacional-supabase.md)
- [Roadmap proposto](09-roadmap.md)
- [Priorização das questões pendentes](12-priorizacao-questoes-pendentes.md)
- [Escopo e limitações do Piloto v0.1](piloto/piloto-v0.1.md)
- [Auditoria e preparação do Piloto v0.1.1](piloto/piloto-v0.1.1.md)
- [Validações e integridade do Piloto v0.1.2](piloto/piloto-v0.1.2.md)
- [Fluxo operacional e rastreabilidade do Piloto v0.1.3](piloto/piloto-v0.1.3.md)
- [Progresso visual e visão do cliente do Piloto v0.1.4](piloto/piloto-v0.1.4.md)
- [Workflow funcional da ordem de serviço do Piloto v0.1.5](piloto/piloto-v0.1.5.md)
- [Identidade visual profissional e redesign global do Piloto v0.1.6](piloto/piloto-v0.1.6.md)
- [Confirmação e reversão segura do workflow do Piloto v0.1.7](piloto/piloto-v0.1.7.md)
- [Entrada operacional concentrada na Nova OS do Piloto v0.1.8](piloto/piloto-v0.1.8.md)
- [Refinamento do atendimento do Piloto v0.1.9](piloto/piloto-v0.1.9.md)
- [Apresentação e fechamento do Piloto v0.1.10](piloto/piloto-v0.1.10.md)
- [Configurações e prévia de documentos do Piloto v0.1.11](piloto/piloto-v0.1.11.md)
- [Refinamento visual profissional do Piloto v0.1.12](piloto/piloto-v0.1.12.md)
- [Acabamento de produto do Piloto v0.1.13](piloto/piloto-v0.1.13.md)
- [Patch visual grafite, azul e vermelho da v0.1.13](piloto/piloto-v0.1.13-patch-visual.md)
- [Identidade visual da oficina piloto — v0.1.14](piloto/piloto-v0.1.14.md)
- [Segurança e consistência histórica local — v0.1.15](piloto/piloto-v0.1.15.md)

# Decisões atuais importantes

As referências versionadas abaixo preservam decisões e limitações do piloto; não são um inventário de deploy. Em particular, backup JSON/localStorage legado não é backup dos dados cloud, e menções antigas a recursos locais não anulam a publicação registrada no estado atual.

- A v0.1.15 cria o snapshot imutável dos dados da oficina somente na primeira conclusão guiada da OS. Esta escolha reutiliza o fechamento funcional já existente e é provisória até validação da oficina. OS anteriores ou ajustadas manualmente sem snapshot continuam usando as configurações atuais. Regressão e nova conclusão não substituem snapshot existente.
- O backup v1 contém clientes, veículos, ordens e configurações, além de identificador do formato, versão e data de exportação. A importação aceita somente formato compatível, valida estrutura e vínculos antes da confirmação e preserva os valores anteriores se a gravação falhar. Os registros locais conhecidos declaram `schemaVersion: 1`; formatos legados continuam legíveis.
- A v0.1.14 substitui o tema grafite da v0.1.13 por base clara, sidebar azul e vermelho pontual. Paleta vigente documentada na v0.1.14; os registros da v0.1.13, inclusive seu patch, são históricos e permanecem intactos. Mudanças limitadas a CSS e identificação visual da versão, sem migração de dados nem personalização cadastral da oficina.
- O patch visual da v0.1.13 substitui a predominância azul nas superfícies por grafite. Vermelho ganha presença decorativa e destaque no painel de atenção, sem criar urgências, mudar status ou suas regras. O registro original da v0.1.13 é preservado como histórico; a paleta vigente está no documento do patch.
- A v0.1.13 usa vermelho apenas como assinatura decorativa da marca, separado de erros/destruição. Melhora apresentação e textos sem alterar ações. E-mails fictícios padrão usam `example.com`; registros já salvos não são migrados ou sobrescritos.
- A v0.1.12 altera somente apresentação, centralizada em `styles.css`. Documentos isolados por `document-paper`. Azul = ação/ativo, verde = sucesso/concluído, âmbar = espera, vermelho = erro/recusado e cinza = neutro. Nenhum nome de status ou cálculo foi alterado.
- A v0.1.11 usa rascunho local para prévias fictícias; apenas salvar grava configurações. Cabeçalho compartilhado com razão social e CEP, defaults compatíveis com dados anteriores e formatação leve sem validação fiscal. Integração fiscal e snapshots históricos são possibilidades documentadas, não implementadas.
- A v0.1.10 mantém configurações da oficina em `pitgarage-workshop-settings-v1`, separadas de `pitgarage-pilot-v012`. Não migra nem apaga dados operacionais. Documentos usam as configurações atuais, sem congelar versões por OS.
- O resumo final é somente leitura nas três etapas finais. Valor final continua sendo a soma dos itens aprovados; execução é apresentada pelo registro `executed`, sem inferência pelo status. A garantia mantém os 30 dias e a referência demonstrativa fixa de 01/09/2026. Não há documento fiscal, link público nem aprovação real.

- O histórico rastreável do veículo e da ordem de serviço é o núcleo proposto do MVP.
- Aprovações podem ser parciais e serviços adicionais exigem nova autorização.
- Fotos e vídeos de diagnóstico têm prioridade operacional.
- O controle quantitativo completo de estoque está proposto para a V1 pós-MVP, sujeito a validação.
- O scaffold existente não confirma arquitetura ou stack para o produto.
- O Piloto v0.1 usa dados mockados, estado React e `localStorage` apenas como decisões temporárias de demonstração.
- O Piloto v0.1.1 preserva essa base temporária e adiciona restauração confirmada do cenário fictício para repetir demonstrações.
- O Piloto v0.1.2 normaliza identificadores e impede duplicidades e valores inválidos apenas na camada local. Telefone e e-mail únicos são regras provisórias do piloto.
- O Piloto v0.1.3 registra histórico de status e atividades no armazenamento local, sem transformar os oito estados em fluxo definitivo.
- O Piloto v0.1.4 mantém `order.status` como fonte única do progresso e adiciona uma visão do cliente somente para demonstração local, sem aprovação ou compartilhamento real.
- O Piloto v0.1.5 centraliza a avaliação do workflow e torna a próxima ação o caminho normal; transições, pagamento como bloqueio e estados continuam provisórios.
- O Piloto v0.1.6 altera somente a linguagem visual e preserva integralmente o comportamento funcional da v0.1.5; imagens de veículos continuam adiadas para estudo separado.
- O Piloto v0.1.7 preserva o redesign da v0.1.6, exige confirmação contextual nas ações do workflow e centraliza a reversão coerente de etapa com rastreabilidade e reset explícito dos dados dependentes.
- O Piloto v0.1.8 torna a Nova OS o fluxo principal de cadastro, só persiste cliente e veículo novos na confirmação final e aplica exclusão lógica sem apagar ordens ou romper referências históricas.
- Os estados da ordem de serviço e a garantia padrão de 30 dias são representados no piloto, mas permanecem sujeitos a validação.

# Pendências

Pendências operacionais atuais em 03/09/2026:

1. Aplicar `20260904010000_improve_chat_experience.sql` e validar nomes das conversas/Atendimento, última mensagem, horário, unread, agrupamento de notificações e `mark_chat_read`.
2. Ativar manualmente Before User Created Hook usando a função `public.before_user_created` já existente.
3. Configurar as chaves de Turnstile; integração preparada não significa CAPTCHA ativo.
4. Conferir Auth Redirect URLs, incluindo `/reset-password`.
5. Cadastrar os UUIDs reais e confirmados dos desenvolvedores em `developer_access`.
6. Conferir `supabase_migrations.schema_migrations` antes de qualquer tratamento de migrations semanticamente equivalentes. Não remover arquivos nem executar migration repair nesta rodada.

Consultar as perguntas originais em [`10-questoes-pendentes.md`](10-questoes-pendentes.md) e sua classificação em [`12-priorizacao-questoes-pendentes.md`](12-priorizacao-questoes-pendentes.md). Nenhuma pendência deve ser resolvida por suposição.

# Próxima etapa

1. Obter/conferir o arquivo correto da evolução de Chat, ausente neste checkout, e aplicar remotamente **somente** `supabase/migrations/20260904010000_improve_chat_experience.sql` em uma próxima tarefa autorizada.
2. Validar nome real da conversa, nome do cliente em Atendimento, última mensagem, horário, unread, agrupamento de notificações e `mark_chat_read`.
3. Depois, conferir o histórico remoto de migrations; ativar Before User Created Hook; configurar Turnstile; revisar Redirect URLs; cadastrar `developer_access`. Nenhuma remoção/repair de migrations antes de conferir o histórico remoto.

Esta atualização é somente documental: nenhuma dessas ações foi executada.

## Próxima etapa histórica do piloto local

O roteiro abaixo é preservado como registro anterior, não como próxima ação cloud:

Demonstrar o Piloto v0.1.15 aos responsáveis pela oficina. Validar o momento provisório do snapshot, a recuperação por backup e o comportamento esperado para correções/reemissões, além do conforto visual nos dispositivos reais. Integração fiscal permanece sem implementação.

# Histórico

Consultar [`historico/README.md`](historico/README.md), [`versoes/README.md`](versoes/README.md) e o [`CHANGELOG.md`](../CHANGELOG.md).

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

O projeto está na fase **Piloto v0.1.15 — segurança e consistência histórica local**, ainda vinculada à **v2 — Entrada na fase piloto**. Documentos de uma OS passam a congelar os dados da oficina na conclusão guiada do serviço, com fallback para configurações atuais em registros antigos. Configurações oferecem exportação e importação validada de backup JSON completo do piloto, e os registros persistidos passam a declarar versão de schema sem exigir reset. A identidade clara da v0.1.14, Nova OS, workflow, stepper, regressões, exclusão lógica e demais regras permanecem intactos. As regras de fechamento e documentos continuam demonstrativas e sujeitas à validação. O piloto não é o MVP aprovado e não define arquitetura, banco ou infraestrutura de produção.

A base de Supabase Auth está aplicada no Lovable Cloud com perfis e níveis `customer`, `staff`, `admin` e `owner`. A migration `20260902190000_prepare_auth_user_profiles.sql` e o bootstrap único do primeiro owner já foram executados; Salomão está ativo como `owner`, com cargo `Proprietário`, e o bootstrap não deve ser repetido. Novas contas podem ser criadas em `/login`, nascem como `customer` ativas e usam somente `/cliente`; o sistema interno exige `staff`, `admin` ou `owner`, e somente `owner` pode alterar `access_level`. O trigger de criação automática de perfil foi testado e o usuário usado no teste foi removido. O runtime mantém sessão, logout, proteção por área, indicador da equipe e bypass `Admin Local` restrito a desenvolvimento em localhost. Os dados operacionais continuam exclusivamente no `localStorage`, não foram migrados para o Supabase e não são expostos ao cliente. As regras de negócio mais amplas continuam sujeitas à validação; consultar [o histórico e estado da autenticação](13-proposta-autenticacao-usuarios.md).

# Documentação atual

- [Visão e processo atual](README.md#documentos)
- [Requisitos funcionais](04-requisitos-funcionais.md)
- [Requisitos não funcionais](05-requisitos-nao-funcionais.md)
- [Regras de negócio](06-regras-de-negocio.md)
- [Perfis e permissões](07-perfis-e-permissoes.md)
- [Proposta de MVP](08-mvp.md)
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

Consultar as perguntas originais em [`10-questoes-pendentes.md`](10-questoes-pendentes.md) e sua classificação em [`12-priorizacao-questoes-pendentes.md`](12-priorizacao-questoes-pendentes.md). Nenhuma pendência deve ser resolvida por suposição.

# Próxima etapa

Demonstrar o Piloto v0.1.15 aos responsáveis pela oficina. Validar o momento provisório do snapshot, a recuperação por backup e o comportamento esperado para correções/reemissões, além do conforto visual nos dispositivos reais. Integração fiscal permanece sem implementação.

# Histórico

Consultar [`historico/README.md`](historico/README.md), [`versoes/README.md`](versoes/README.md) e o [`CHANGELOG.md`](../CHANGELOG.md).

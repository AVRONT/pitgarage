# Changelog

Este arquivo registra mudanças relevantes na evolução do PITGARAGE. Alterações futuras devem preservar decisões anteriores e explicar qualquer substituição, descarte ou adiamento.

## [Fechamento da revisão operacional/Auth — somente local] - 2026-09-02

- Revisada a migration operacional ainda não aplicada: transação de aplicação, grants restritos, proteção do vínculo Auth, índices/constraints e portal por RPCs de campos permitidos, exigindo perfil customer ativo.
- Listagem de outros perfis reservada ao owner na migration pendente; arquivo histórico da migration Auth e bootstrap permanecem intocados.
- Corrigidos retry transitório de sessão, respostas de perfil desatualizadas e tolerância a bloqueio do armazenamento de última conta, limitado a nome/e-mail/iniciais.
- Nova OS aguarda confirmação de gravação, mantém rascunhos em erro, bloqueia duplo envio simultâneo e abre a OS efetivamente retornada pela RPC. Falha de atualização da lista após sucesso informa que a OS já foi criada.
- Validado localmente sem banco remoto; matriz de testes pós-aplicação e limitações registradas na documentação operacional. Histórico, fixtures legadas e localStorage real não foram apagados. Sem commit/push ou aplicação de SQL remoto.

## [Primeira base operacional Supabase — não aplicada] - 2026-09-02

- Criada migration separada para clientes, veículos e OS, com UUIDs, numeração segura, exclusão lógica, JSONB para estruturas internas, RLS e RPC transacional da Nova OS.
- Conta Auth e cadastro comercial permanecem independentes; vínculo opcional usa e-mail confirmado e normalizado nos dois sentidos, sem acesso frontend a `auth.users`.
- Área do Cliente consulta somente cadastro, veículos e resumo sanitizado das próprias OS; Configurações recebe gestão de equipe exclusiva do owner.
- Runtime interno passa a usar repositório Supabase para usuários reais e adapter local vazio para `Admin Local`; fixtures e storage legado deixam de carregar automaticamente sem serem apagados.
- Última conta guarda apenas nome/e-mail/iniciais, e falhas transitórias de perfil preservam a sessão. Mensagem `weak_password` permanece tratada em PT-BR.
- Backup JSON é identificado como legado/local e não aparenta proteger dados cloud. Nenhuma migration foi aplicada remotamente nesta rodada.

## [Aplicação da base de autenticação no Lovable Cloud] - 2026-09-02

- Migration `20260902190000_prepare_auth_user_profiles.sql` aplicada no Supabase do Lovable Cloud; o trigger foi validado criando perfil `customer` ativo e o usuário de teste foi removido.
- Conta real de Salomão criada e promovida uma única vez pelo bootstrap para `owner` ativo, com cargo `Proprietário`; o bootstrap não deve ser repetido.
- Somente `owner` pode alterar `access_level`. Cadastro público em `/login` mantém novos usuários como `customer`, restritos a `/cliente`.
- Dados operacionais permanecem no `localStorage` e não foram migrados. As entradas anteriores abaixo preservam o histórico das fases em que migration, runtime e bootstrap ainda eram apenas preparação local.

## [Cadastro de clientes na autenticação — não publicado] - 2026-09-02

- Adicionado cadastro por nome, e-mail e senha na tela de login, usando diretamente o Supabase Auth.
- Novas contas seguem o perfil automático `customer` da migration e são direcionadas para `/cliente`; quando exigida, a confirmação do e-mail é informada antes do primeiro acesso.
- Mantidos o login existente, o bypass local e o isolamento entre a Área do Cliente e o sistema interno.

## [Separação de clientes e equipe na autenticação — não publicado] - 2026-09-02

- Adicionado nível `customer`; na etapa anterior à aplicação remota, a migration foi preparada para criar novos perfis ativos nesse nível e sem obrigação de cargo operacional.
- Sistema interno limitado a `staff`, `admin` e `owner`; clientes autenticados são direcionados para `/cliente`, sem renderização dos dados internos ou do piloto local.
- Área do Cliente inicial exibe somente nome/e-mail, mensagem de evolução futura e logout.
- RLS mantém customer/staff sem administração de permissões, limita admin a customer/staff e permite ao owner administrar customer/staff/admin sem criar novo owner pela API normal.
- Login, bypass local como owner, workflow, dados operacionais, backup e `localStorage` foram preservados. Naquela rodada, nenhuma migration ou ação remota foi executada.

## [Runtime local de autenticação — não publicado] - 2026-09-02

- Implementados login por e-mail/senha com Supabase Auth, restauração de sessão, exigência de perfil ativo e logout, sem cadastro público ou armazenamento próprio de senha.
- Contexto central de autenticação fornece usuário, perfil, nível de acesso e identidade de auditoria para evoluções futuras.
- Header passa a identificar o usuário logado e adaptar o indicador ao mobile.
- Desenvolvimento em `localhost` ou `127.0.0.1` recebe bypass efêmero `Admin Local`, sem conta, senha ou funcionamento no build de produção.
- Naquela etapa, a migration existente foi revisada sem aplicação remota. Clientes, veículos, OS, backup, workflow e demais dados locais permaneceram intactos.

## [Proposta não aplicada — autenticação e permissões] - 2026-09-02

- Na fase inicial, foi preparada uma migration local, ainda sem execução, para perfis ligados ao Supabase Auth, com cargo separado de `owner`, `admin` e `staff`.
- Incluídos constraints, índice, grants mínimos, RLS, bloqueio de autoelevação, administração provisória de perfis e bootstrap manual do primeiro owner.
- Naquela fase de preparação, nenhuma senha, conta, e-mail, dado remoto, login, convite, notificação, chat ou migração do `localStorage` foi criada.
- Naquele momento, Supabase permanecia uma proposta técnica e a matriz de permissões continuava pendente de validação.

## [Piloto v0.1.15] - 2026-09-02

### Segurança e consistência histórica local

- Snapshot dos dados da oficina criado na primeira conclusão guiada da OS; documentos fechados preferem o snapshot e registros antigos mantêm fallback compatível para as configurações atuais.
- Snapshots existentes não são regravados por alterações de configurações, regressão ou nova conclusão.
- Configurações recebem exportação e importação de backup JSON com clientes, veículos, ordens e dados da oficina, data de exportação e versão explícita do formato.
- Importação valida formato, estrutura, identificadores e vínculos antes da confirmação; arquivo inválido não altera dados, e falha de persistência restaura os valores locais anteriores.
- Persistência operacional e configurações passam a declarar `schemaVersion: 1`, preservando leitura dos registros legados e sem exigir reset ou migração destrutiva.
- Workflow, status, stepper, regressões, Nova OS, orçamento, diagnóstico, pagamento, garantia, timeline, exclusão lógica e identidade visual da v0.1.14 preservados.
- Escopo, compatibilidade e validação em `docs/piloto/piloto-v0.1.15.md`.

## [Piloto v0.1.14] - 2026-09-02

### Identidade visual da oficina piloto

- Base clara/neutra, cards brancos, sidebar azul e acentos vermelhos inspirados na paleta informada da oficina Abraão & Salomão.
- Estilos compartilhados adaptam tabelas, campos, botões, dialogs, tabs, badges, feedbacks e painéis operacionais, mantendo densidade e comportamento.
- Contraste de textos semânticos e controles de evidência adaptado ao fundo claro. Stepper permanece verde/azul/cinza, com animações e redução de movimento preservadas.
- Orçamento, resumo e prévias seguem claros, com identidade discreta nos cabeçalhos/divisores.
- Dados, configurações, localStorage, regras e histórico inalterados. Documentos da v0.1.13 preservados integralmente.
- Escopo e validação em `docs/piloto/piloto-v0.1.14.md`.

## [Piloto v0.1.13 — patch visual] - 2026-09-02

- Superfícies, tabelas, campos, dialogs, tabs e navegação ativa passam a bases grafite; azul concentrado em ações, foco e informação ativa.
- Marca bicolor mais perceptível, detalhe vermelho nos cabeçalhos e destaque do painel Atenção agora, mantendo espera em âmbar e stepper verde/azul/cinza.
- Documentos e impressão continuam claros, com pequenos detalhes de identidade.
- Alterações centralizadas em estilos e uma classe visual do Dashboard. Nenhuma mudança funcional, de dados, armazenamento ou histórico; versões anteriores preservadas.
- Detalhes e validação em `docs/piloto/piloto-v0.1.13-patch-visual.md`.

## [Piloto v0.1.13] - 2026-09-02

### Acabamento de produto e identidade azul/vermelho

- Detalhe vermelho discreto na marca, mantendo azul predominante e sem mudar a semântica de erros.
- Títulos mais contidos, espaçamento de colunas consistente, valores de OS alinhados à direita, badges compactos e metadados secundários da OS menos destacados.
- Estados vazios contextualizados, ações de criação/configurações com textos explícitos e feedback existente anunciado por tecnologias assistivas.
- E-mails dos clientes fictícios padrão em `example.com`, sem migração de dados salvos.
- Workflow, validações, cálculos, histórico, documentos e versões anteriores preservados. Sem dependências novas.

## [Piloto v0.1.12] - 2026-09-02

### Refinamento visual profissional

- Paleta operacional escura, ações azuis, bordas discretas e baixa elevação centralizadas nos estilos compartilhados.
- Sidebar, header, botões, cards, campos, diálogos, tabs e estados adaptados sem mudança de navegação.
- Estados e stepper com semântica consistente; foco e contraste revisados.
- Documentos/prévias com superfície clara isolada do tema, preservada na impressão.
- Nenhuma alteração em funcionalidades, workflow, cálculos, armazenamento ou histórico. Versões anteriores preservadas.

## [Piloto v0.1.11] - 2026-09-01

### Melhorado

- Configurações em duas colunas no desktop e prévia abaixo no tablet; modos Orçamento e Resumo da OS com exemplos fictícios independentes.
- Prévia ao vivo, indicador de alterações não salvas e cancelamento sem modal. Persistência somente ao salvar.
- Cabeçalho compartilhado entre prévia, visão do cliente, resumo final e impressão; campos vazios omitidos e razão social/CEP opcionais.
- Formatação leve de CNPJ numérico, telefone brasileiro e CEP, sem consulta externa ou validação fiscal bloqueante.

### Documentado e preservado

- Integração fiscal e snapshots de documentos somente como possibilidades futuras, sem emissão ou arquitetura definida.
- Configurações antigas compatíveis, dados operacionais e histórico preservados; nenhuma nova dependência.

## [Piloto v0.1.10] - 2026-09-01

### Adicionado

- Configurações locais de nome, CNPJ, telefone, endereço e atendimento da oficina, com armazenamento separado e ícone atual.
- Resumo final somente leitura para serviço concluído, aguardando retirada e entregue; execução, pagamento e garantia refletem registros existentes.

### Melhorado

- Visão do cliente existente integrada à identificação da oficina, com título acessível.
- Impressão de orçamento e resumo sem navegação, botões ou controles internos, com posicionamento corrigido e margens A4.

### Preservado

- Dados operacionais, histórico, `deletedAt`, workflow, reversões, stepper, Nova OS, cálculos e versões documentais anteriores. Sem novas dependências ou integração externa.

## [Piloto v0.1.9] - 2026-09-01

### Corrigido

- Busca por nome na Nova OS, antes afetada por correspondências numéricas vazias.
- Duplicidades agora identificam cliente, veículo e campo com orientação para o cadastro existente.

### Melhorado

- Autocomplete acessível, aproveitamento da busca no cadastro novo e identificação do cliente selecionado.
- Resumo financeiro no topo da OS, menor repetição visual, inputs, cards e rodapés de diálogos consistentes.
- Nome visível PitGarage e título da aplicação padronizados.

### Preservado

- Workflow, stepper, reversões, exclusão lógica, dados e cadastros somente na confirmação final.

## [Piloto v0.1.8] - 2026-09-01

### Alterado

- A Nova OS concentra seleção ou cadastro de cliente, seleção ou cadastro de veículo, dados da entrada e revisão final.
- Clientes e Veículos permanecem como áreas de consulta e gestão, com resumos baseados somente nos dados existentes e CTA para Nova OS.

### Integridade

- Cliente e veículo novos permanecem como rascunhos até a criação final da OS; cancelar não gera registros parciais.
- Veículos selecionáveis são limitados ao cliente definido e duplicidades continuam bloqueadas pelas validações locais.
- Exclusão de cliente ou veículo é lógica por `deletedAt`, sem cascata sobre ordens nem referências órfãs.

### Preservação

- Workflow, confirmações, reversões, histórico, persistência anterior, redesign e ajuste visual do stepper permanecem preservados.

## [Piloto v0.1.7] - 2026-09-01

### Alterado

- Removida somente a linha horizontal do indicador do fluxo; marcadores, estados, labels, interação e responsividade foram preservados.
- Transições e alterações operacionais do workflow passam por confirmações contextuais antes da execução.

### Adicionado

- Ação discreta para retornar à etapa anterior coerente, com aviso dos dados afetados.
- Regra central de reversão com resets por estágio, atualização temporal e registros em histórico e atividades.
- Bloqueio de regressões manuais arbitrárias que poderiam deixar a OS inconsistente.

### Preservação

- O redesign v0.1.6, cálculos, busca, persistência local e histórico existente permanecem preservados.

## [Piloto v0.1.6] - 2026-09-01

### Alterado

- **Funcionamento anterior:** interface funcional, porém com excesso de cards arredondados, sombras, baixa densidade e aparência de dashboard genérico.
- **Novo estado:** identidade grafite e laranja, raios reduzidos, superfícies apoiadas em bordas, tabs lineares e listagens operacionais estruturadas.
- **Motivo:** aproximar o piloto de um software profissional de gestão de oficina sem alterar seu comportamento.
- **Estado anterior:** preservado integralmente na documentação da v0.1.5; nenhuma regra ou funcionalidade foi substituída.

### Redesign

- Sidebar, header, busca, dashboard, clientes, veículos, ordens, detalhes, formulários, dialogs, alertas, timeline e estados vazios harmonizados.
- Clientes, veículos, ordens e serviços em andamento convertidos para linhas/tabelas responsivas.
- Sistema central de raios, foco, superfícies, botões, tabs e dialogs refinado sem dependências novas.

### Observação

- O workflow v0.1.5 permanece intacto. Imagens e APIs de veículos não fazem parte desta versão.

## [Piloto v0.1.5] - 2026-09-01

### Alterado

- **Funcionamento anterior:** status era alterado livremente pelo seletor e a próxima ação era texto fixo por status.
- **Novo funcionamento:** uma camada central deriva próxima ação, pré-requisitos, bloqueios, avisos e inconsistências dos dados reais da OS.
- **Motivo:** impedir avanços incompatíveis e conduzir o funcionário pelas ações operacionais da própria ordem.
- **Status anterior:** preservado no histórico como comportamento da v0.1.4; o ajuste manual permanece apenas como exceção registrada.

### Adicionado

- Ações guiadas para diagnóstico, aprovação, peças, execução, conclusão, retirada e entrega.
- Atualização mínima da disponibilidade de peças dentro do orçamento.
- Confirmação para transições semanticamente importantes e aviso de pagamento pendente na entrega.
- Detecção e correção explícita de registros antigos inconsistentes, sem alteração silenciosa.
- Barra com trilho neutro, conclusão verde, etapa atual laranja e explicação ao selecionar etapas futuras.

### Observação

- Estados, transições, garantia, pagamento como bloqueio e encerramento sem itens aprovados continuam provisórios e sujeitos à validação da oficina.

## [Piloto v0.1.4] - 2026-09-01

### Corrigido

- Progresso visual da ordem de serviço com barra contínua e marcadores de etapas concluída, atual e futura, sempre derivados de `order.status`.

### Adicionado

- Visualização somente leitura do orçamento como cliente, com veículo, diagnóstico, evidências, itens, decisões e totais.
- Alerta de itens aguardando aprovação e diferenciação visual das decisões na tela interna.
- Versão de impressão com recurso nativo do navegador e controles ocultos no papel ou PDF.

### Observação

- O preview é uma demonstração local. Link seguro, autenticação, compartilhamento e aprovação real permanecem possibilidades futuras sujeitas à validação.

## [Piloto v0.1.3] - 2026-09-01

### Corrigido

- Sincronização entre o status persistido da OS, dropdown, contador e barra do fluxo por meio de atualizações funcionais sobre uma única fonte de verdade.

### Adicionado

- Histórico local de mudanças de status e timeline de atividades relevantes.
- Última atualização, pendências calculadas e próxima ação sugerida na OS.
- Ações rápidas contextuais e resumo operacional e financeiro.
- Busca global por número da ordem de serviço.
- Adaptação não destrutiva de registros do Piloto v0.1.2 sem os novos campos.
- Cenários fictícios para OS recebida e históricos com vários estados.

### Observação

- Os oito estados, sugestões de próxima ação e cálculo financeiro resumido continuam demonstrativos. A visualização do orçamento como cliente permanece uma possibilidade futura para evitar ampliar esta entrega.

## [Piloto v0.1.2] - 2026-09-01

### Adicionado

- Normalização de CPF, telefone, e-mail, nome e placa na camada local do piloto.
- Cadastro de veículo com bloqueio de placa duplicada.
- Mensagens próximas aos campos, acesso ao cadastro existente e preservação dos dados digitados após erro.
- Validações de quilometragem, orçamento, execução, pagamento e datas simples.

### Integridade

- CPF informado, telefone, e-mail informado, placa e número de OS não podem se repetir no cenário local.
- Itens aguardando aprovação ou recusados permanecem registrados e não podem ser executados.
- Valores negativos e entradas numéricas evidentemente inválidas são rejeitados.
- Quilometragem menor que a última conhecida gera aviso, sem bloqueio definitivo.

### Observação

- Telefone e e-mail únicos, obrigatoriedade exata dos campos, algumas validações de data e garantia padrão de 30 dias continuam provisórios. Esta evolução não cria uma nova versão documental formal nem altera a arquitetura.

## [Piloto v0.1.1] - 2026-09-01

### Adicionado

- Busca global por cliente, telefone, veículo e placa.
- Linha visual provisória dos estados da ordem de serviço.
- Inclusão de itens comuns no orçamento, além do fluxo separado de problema adicional.
- Estados vazios orientativos, informações ampliadas no histórico do veículo e restauração confirmada dos dados fictícios.

### Alterado

- Indicadores do dashboard passaram a refletir estritamente os dados do cenário e ganharam acesso direto às listas filtradas.
- Identificadores de novas ordens passaram a seguir sequência estável no cenário local.
- Rótulos, responsáveis ausentes e comportamento responsivo foram refinados para demonstração.

### Observação

- Esta é uma evolução do piloto, não uma nova versão documental formal. Não valida estados, garantia, permissões, arquitetura ou escopo do MVP.

## [v2] - 2026-09-01

### Adicionado

- Piloto v0.1 navegável para demonstração e validação com a oficina.
- Dashboard operacional, clientes, veículos, ordens de serviço e histórico do veículo.
- Diagnóstico editável e evidências locais simuladas de foto e vídeo.
- Orçamento com peças, serviços, cálculo demonstrativo de 30% e decisão individual por item.
- Registro de problema adicional aguardando aprovação, execução de itens autorizados, pagamento e garantia.
- Dados fictícios realistas para carros, motos e diferentes estados de atendimento.
- Documentação do escopo, limitações e decisões temporárias do piloto.

### Mudança de estratégia

- **Decisão anterior:** responder as questões P0 antes de avançar significativamente para prototipação e implementação.
- **Nova decisão:** construir um piloto visual e funcional antes de responder todas as pendências, usando-o como instrumento de validação com usuários reais.
- **Motivo:** permitir feedback prático sobre fluxo, informações e facilidade de uso a partir de uma experiência interativa.
- **Status da decisão anterior:** substituída como sequência obrigatória; as questões P0 foram mantidas e continuam pendentes.

### Decisões temporárias

- Dados mockados, estado local e `localStorage` foram usados somente para demonstração.
- Não foram criados banco, integrações, autenticação definitiva ou infraestrutura de produção.
- Estados de OS e garantia padrão de 30 dias continuam sujeitos a validação.

## [Não lançado]

### Adicionado

- Priorização das 27 questões pendentes em P0, P1, P2 e P3.
- Roteiro reduzido com as questões que bloqueiam a validação do MVP.

### Observação

- Esta organização não adiciona respostas, requisitos ou decisões de negócio e não cria uma nova versão documental.

## [v1] - 2026-09-01

### Adicionado

- Documentação inicial organizada após o primeiro levantamento real da oficina.
- Visão do projeto, processo atual e problemas identificados.
- Requisitos funcionais e não funcionais, regras de negócio e perfis conhecidos.
- Proposta de MVP, roadmap, questões pendentes e decisões técnicas futuras.
- Contexto de entrada para IA e política permanente de preservação e versionamento.

### Decisões

- A documentação inicial foi reconhecida como **v1 — Descoberta e documentação inicial**.
- O núcleo proposto do MVP é o histórico rastreável do veículo e da ordem de serviço.
- O controle quantitativo completo de estoque foi proposto para a V1 pós-MVP, sujeito a validação.
- Nenhuma arquitetura, stack, banco, interface ou implementação foi aprovada.
- Código e scaffold existentes não representam automaticamente decisões técnicas do produto.

### Pendências

- Validar o processo e os estados da ordem de serviço.
- Definir permissões, especialmente o acesso financeiro do atendente e do mecânico.
- Validar regras de orçamento, pagamento, garantia e estoque.
- Aprovar o escopo do MVP antes de modelagem ou implementação.

## Formato para mudanças de decisão

Quando uma decisão mudar, registrar na entrada correspondente:

- **Decisão anterior:** descrição do estado anterior.
- **Nova decisão:** descrição do novo estado.
- **Motivo:** razão validada para a mudança.
- **Status da decisão anterior:** substituída, descartada, adiada ou mantida como futura.

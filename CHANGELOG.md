# Changelog

Este arquivo registra mudanças relevantes na evolução do PITGARAGE. Alterações futuras devem preservar decisões anteriores e explicar qualquer substituição, descarte ou adiamento.

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

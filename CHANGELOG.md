# Changelog

Este arquivo registra mudanças relevantes na evolução do PITGARAGE. Alterações futuras devem preservar decisões anteriores e explicar qualquer substituição, descarte ou adiamento.

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

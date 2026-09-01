# Changelog

Este arquivo registra mudanças relevantes na evolução do PITGARAGE. Alterações futuras devem preservar decisões anteriores e explicar qualquer substituição, descarte ou adiamento.

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

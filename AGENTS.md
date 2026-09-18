# Instruções permanentes

## 1. Eficiência e escopo

Trabalhe com o mínimo de contexto, tokens, créditos, comandos, leituras e tempo, sem comprometer correção, segurança, estabilidade ou qualidade.

- Para tarefas simples, execute diretamente e sem planejamento longo.
- Leia somente arquivos relevantes; busque o símbolo, localize referências e abra apenas os trechos necessários.
- Se o prompt indicar um arquivo, comece por ele. Quando a causa estiver clara, pare de investigar.
- Não liste ou audite o repositório inteiro, releia arquivos, abra arquivos grandes sem necessidade nem pesquise `node_modules`, gerados, builds, `dist` ou artefatos.
- Não investigue backend em tarefa visual nem todo o frontend em tarefa isolada de backend.
- Em tarefas pequenas, tente limitar-se a 1–3 arquivos e poucas buscas direcionadas.
- Ao resolver o pedido, pare. Não continue com cleanup, auditorias, refactors, documentação ou melhorias opcionais.

## 2. Alterações e regras de negócio

Faça a menor alteração segura que resolva integralmente a tarefa e preserve todo comportamento fora do pedido.

- Não altere áreas relacionadas apenas indiretamente, APIs internas desnecessárias ou código saudável.
- Não faça redesign, refactor oportunista, renomeação ou reorganização fora do escopo.
- Não invente, normalize ou corrija silenciosamente regras, nomes, categorias, status, dados legados, valores incomuns ou duplicidades.
- Reutilize a lógica existente; não crie implementação paralela para a mesma regra.
- Centralize apenas quando realmente compartilhado e sem refatoração ampla.
- Em ambiguidade funcional, prefira a opção mais conservadora; se o risco continuar relevante, não implemente essa parte e explique brevemente.

## 3. Arquitetura

- Respeite repositories, services, hooks, contextos e separação de responsabilidades existentes.
- Não improvise acesso a dados no componente quando houver camada responsável.
- Não introduza biblioteca, dependência, arquitetura ou padrão novo se a stack atual resolver o problema.
- Não altere lockfile sem mudança real de dependência.

## 4. Banco e produção

Não alterar sem pedido explícito:
- schemas, tabelas, views e migrations;
- dados ou registros reais;
- ambiente de produção.

Não execute por iniciativa própria `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `DROP`, `ALTER`, `TRUNCATE`, DDL ou operações destrutivas.

- Se leitura for suficiente, permaneça em leitura.
- Não crie dados artificiais em produção só para testar UI.
- Não limpe ou normalize dados existentes sem pedido.
- Preserve registros e valores legados fora do escopo.

## 5. Lovable Cloud e infraestrutura

Quando a tarefa depender de Jobs, Secrets, funções administradas ou infraestrutura específica do Lovable Cloud:
- respeite a plataforma existente;
- não simule localmente algo como equivalente;
- altere código local somente se fizer parte real da solução;
- se algo depender da plataforma, informe objetivamente.

## 6. Segurança

Nunca:
- exponha secrets, tokens, senhas, PINs ou service role keys;
- registre credenciais em logs;
- coloque secrets no frontend ou em variáveis `VITE_*`;
- commite `.env`;
- copie credenciais para documentação.

Evite abrir `.env` completo; quando possível trabalhe apenas com nomes de variáveis.

Logs, diagnósticos e notificações devem conter somente metadados seguros.

## 7. Frontend

- Preserve responsividade, scroll, tabelas, drawers, filtros, loading e interações que não façam parte da tarefa.
- Quando uma decisão visual for explicitamente aprovada como padrão global ou compartilhado, implemente-a de forma reutilizável e aplique-a aos elementos semanticamente equivalentes. Não extrapole para componentes ou ações diferentes sem solicitação explícita.
- Não altere regra de negócio durante ajuste puramente visual.
- Preserve memoização, debounce, cache e otimizações existentes.
- Evite `transition-all`, animações pesadas, efeitos desnecessários, rerenders evitáveis e cálculos repetidos.
- Não coloque preferências visuais específicas permanentes nestas instruções; detalhes de aparência devem vir no prompt de cada tarefa.

## 8. Arquivos gerados e formatação

Nunca editar manualmente arquivos claramente gerados.

Não altere `dist`, `build`, compilados ou artefatos temporários sem motivo explícito.

- Não converta arquivos inteiros entre CRLF/LF apenas para satisfazer formatter/linter.
- Não rode formatter global nem comandos equivalentes a `prettier --write .`, `eslint --fix .` ou formatação em todo o projeto.
- Não gere diff grande só por formatação.
- Não corrija warnings preexistentes fora do escopo.

## 9. Validação proporcional

Valide de acordo com o risco real da mudança. Não execute comandos apenas “por garantia”.

### Documentação / AGENTS / texto
- nenhum teste;
- nenhum lint;
- nenhum TypeScript;
- nenhum build.

### Ajuste visual/local pequeno
Por padrão:
- sem build;
- sem suíte global;
- sem TypeScript completo;
- sem browser automático.

Se necessário, use no máximo validação direcionada, como lint do arquivo ou `git diff --check`.

### Lógica local TypeScript
Prefira:
- teste diretamente relacionado, se existir;
- lint direcionado quando útil.

Use TypeScript completo somente se houver alteração de tipos compartilhados ou risco real.

### Hooks, repositories, services ou contextos compartilhados
Pode justificar:
- testes direcionados;
- TypeScript uma vez.

Não rode build automaticamente.

### Rotas, entrypoints, config de build ou dependências
Pode justificar:
- TypeScript;
- build uma vez.

### Alterações amplas ou de alto risco
Autenticação, persistência, integração e infraestrutura podem justificar validação mais completa, começando sempre pelos testes direcionados.

Evite repetir suíte, TypeScript ou build várias vezes.

Não execute rotineiramente:
- `npm install` / `npm ci`;
- `npm audit` / `npm audit fix`;
- `npm outdated` / `npm update` / `npm dedupe`;
- `npm run dev`;
- `npm run build`;
- testes globais;
- lint global;
- Prettier global;
- TypeScript completo;
- browser/automação visual;
- comandos Git repetitivos.

Não reinstale dependências se `node_modules` já estiver funcional.

O usuário normalmente fará a conferência visual final de pequenos ajustes.

## 10. Git

Nunca faça sem pedido explícito:
- commit;
- push;
- reset;
- clean;
- stash;
- rebase;
- checkout destrutivo.

Preserve alterações existentes do usuário e não misture mudanças paralelas ou arquivos não relacionados.

Se o usuário pedir commit:
- faça stage somente dos arquivos da tarefa;
- use mensagem curta e coerente com o padrão do projeto.

### Sugestão de commit obrigatória

Sempre que QUALQUER arquivo do repositório for alterado, a resposta final deve incluir UMA sugestão de commit baseada em tudo que foi realmente feito na tarefa.

- Prefira Conventional Commits quando fizer sentido.
- A mensagem deve ser curta e fiel às alterações.
- Se houver várias mudanças relacionadas ou diferentes na mesma tarefa, gere uma única mensagem que represente o conjunto.
- Não invente escopo.
- Apenas sugira; nunca execute commit ou push sem pedido.
- Se nenhum arquivo foi alterado, não é necessário sugerir commit.

## 11. Fluxo padrão

Para cada tarefa:
1. entender o pedido;
2. identificar o escopo mínimo;
3. localizar diretamente os arquivos envolvidos;
4. entender apenas o comportamento necessário;
5. reutilizar lógica existente;
6. implementar a menor alteração segura;
7. validar proporcionalmente ao risco;
8. revisar apenas o diff relevante;
9. parar;
10. responder objetivamente.

## 12. Resposta final

Seja curto.

Informe somente:
- arquivos alterados;
- o que foi feito;
- validações realmente executadas;
- limitação ou observação relevante, se houver;
- sugestão de commit sempre que arquivos forem alterados.

Não crie automaticamente `walkthrough.md`, `report.md`, `summary.md`, `debug.txt`, screenshots, dumps, logs ou scripts auxiliares apenas para explicar a tarefa.

Não proponha novas tarefas automaticamente depois que o pedido estiver resolvido.

## 13. Princípio final

Estas instruções existem para permitir prompts curtos.

Um pedido curto e específico NÃO é autorização para explorar, auditar ou refatorar o projeto inteiro.

A quantidade de investigação, alterações e validações deve acompanhar o tamanho e o risco real da tarefa.

## Universal Skills Pack

Este projeto mantém skills universais em `.agent-skills/`. Os arquivos `*-universal.md`
listados abaixo são definições completas de skills, mesmo sem o nome `SKILL.md`.
O arquivo `.agent-skills/README.md` é somente documentação do pacote e não é uma skill.

Antes de iniciar uma tarefa, determine se alguma skill é relevante. Quando for, leia o
arquivo completo correspondente antes de executar a parte relacionada; não dependa
somente deste resumo. Carregue apenas as skills necessárias para economizar contexto e
evitar conflitos. Skills complementares podem ser combinadas. Se o usuário pedir uma
skill pelo nome, ela deve ser usada.

### Instalação compatível e seleção

As mesmas cinco skills universais também possuem cópias convencionais em
`skills/<nome>/SKILL.md`. As versões preexistentes em `.agent-skills/` permanecem
preservadas; o README do pacote é somente documentação e nunca deve ser tratado como
skill.

- Não carregue todas as skills automaticamente nem use uma skill apenas porque ela está
  instalada. Leia somente as realmente necessárias para a tarefa atual.
- Em caso de conflito, siga: instruções explícitas da tarefa, instruções específicas do
  projeto neste arquivo, skills locais/específicas do projeto e, por último, skills
  universais.
- `grill-me`: não use em tarefa simples, requisitos claros, plano aprovado ou execução
  direta quando novas perguntas não mudariam materialmente a solução. Use apenas para
  ambiguidades, riscos ou decisões importantes ainda abertas.
- `frontend-design`: use em trabalho relevante de interface, layout, componentes,
  hierarquia visual ou experiência frontend, sempre subordinada aos padrões locais.
- `design-engineering`: use em UX, interação, estados, comportamento de componentes,
  responsividade percebida e detalhes de implementação visual, também subordinada às
  regras locais.
- `revenue-centric-design`: use somente quando houver relação real com receita,
  monetização, conversão, negócio, funil ou resultado comercial.
- `viral-product-principles`: use somente quando houver relação real com crescimento,
  aquisição, compartilhamento, loops de produto, retenção ou viralidade.

### grill-me

Arquivo: `.agent-skills/grill-me/grill-me-universal.md`

Use quando houver requisitos vagos, decisões importantes abertas, muitas suposições,
ou quando arquitetura ou plano precisarem ser questionados; também quando o usuário
pedir para fazer "grill", questionar ou validar uma ideia. Leia a skill antes de agir e
siga seu processo de descoberta e questionamento.

### frontend-design

Arquivo: `.agent-skills/frontend-design/frontend-design-universal.md`

Use ao criar frontend, páginas, dashboards ou componentes; alterar layouts; analisar
screenshots; melhorar UI/UX ou identidade visual; e evitar aparência genérica de site
produzido por IA. Leia a skill antes de tomar decisões visuais relevantes.

### design-engineering

Arquivo: `.agent-skills/design-engineering/design-engineering-universal.md`

Use ao trabalhar com animações, motion, microinterações, feedback de hover/focus/press,
drawers, modais, dropdowns, overlays, responsividade percebida ou refinamento de
interações. Leia a skill antes de implementar ou revisar esses comportamentos.

### revenue-centric-design

Arquivo: `.agent-skills/revenue-centric-design/revenue-centric-design-universal.md`

Use em SaaS ou produto digital, landing pages, conversão, onboarding, ativação, pricing,
monetização, retenção, churn, posicionamento, métricas e estratégia de produto. Leia a
skill antes de decisões importantes relacionadas a produto e negócio.

### viral-product-principles

Arquivo: `.agent-skills/viral-product-principles/viral-product-principles-universal.md`

Use ao criar, revisar ou simplificar um produto; trabalhar copy, proposta de valor,
compartilhamento, viralidade, pricing, diferenciação ou landing page; e avaliar se uma
feature é fácil de entender e vender. Leia a skill antes de aplicar esses princípios.

### Combinações comuns

- Planejamento incerto: `grill-me`.
- Novo frontend: `frontend-design`.
- Frontend muito refinado: `frontend-design` + `design-engineering`.
- Landing page de SaaS: `viral-product-principles` + `revenue-centric-design` +
  `frontend-design` + `design-engineering`.
- Ideia de produto ainda mal definida: `grill-me` → `viral-product-principles` →
  `revenue-centric-design`.

### Precedência

As skills complementam as instruções do projeto e não podem sobrescrevê-las. A ordem é:

1. instruções explícitas do usuário para a tarefa atual;
2. `AGENTS.md` específico do projeto ou diretório;
3. regras e restrições do projeto;
4. skills relevantes do Universal Skills Pack;
5. defaults gerais do agente.

Se duas skills entrarem em conflito, aplique a orientação mais adequada ao objetivo atual
e às restrições do projeto.

### Atualização upstream

Cada skill possui uma regra de `Mandatory upstream freshness check`. Quando uma skill for
ativada e houver acesso à internet ou ao repositório indicado, verifique somente a fonte
upstream dessa skill e confira atualizações relevantes. Aproveite melhorias quando
apropriado sem substituir automaticamente adaptações locais. Se o upstream estiver
indisponível, continue o trabalho. Não pesquise o upstream das skills não ativadas.

# Universal Skills Pack

Biblioteca de **skills universais em Markdown** para uso com diferentes agentes, modelos e ambientes de IA.

> **IMPORTANTE:** os arquivos desta biblioteca **não precisam se chamar `SKILL.md` para serem skills**.  
> Nesta coleção, cada skill recebeu um nome de arquivo descritivo para facilitar a organização humana e evitar vários arquivos diferentes chamados apenas `SKILL.md`.

---

# REGRA PRINCIPAL — TODOS OS ARQUIVOS `.md` LISTADOS ABAIXO SÃO SKILLS

Ao carregar, interpretar, instalar, adaptar ou fornecer estes arquivos para um agente de IA, trate **cada arquivo abaixo como uma Skill completa**, mesmo que o nome do arquivo não contenha a palavra `SKILL`.

Os nomes foram escolhidos apenas para tornar a biblioteca mais fácil de navegar.

## Mapeamento oficial

### 1. Grill Me

**Arquivo:**

`grill-me/grill-me-universal.md`

**Tipo:**

Skill

**Nome da skill:**

`grill-me`

**Função:**

Entrevistar e desafiar um plano, ideia, arquitetura, requisito ou decisão antes da implementação, resolvendo ambiguidades e dependências uma de cada vez.

> Apesar de o arquivo se chamar `grill-me-universal.md`, ele deve ser tratado exatamente como uma **Skill**.

---

### 2. Frontend Design

**Arquivo:**

`frontend-design/frontend-design-universal.md`

**Tipo:**

Skill

**Nome da skill:**

`frontend-design`

**Função:**

Criar e revisar interfaces frontend com direção visual intencional, identidade própria, boa hierarquia e menor aparência de template genérico produzido por IA.

> Apesar de o arquivo se chamar `frontend-design-universal.md`, ele deve ser tratado exatamente como uma **Skill**.

---

### 3. Design Engineering

**Arquivo:**

`design-engineering/design-engineering-universal.md`

**Tipo:**

Skill

**Nome da skill:**

`design-engineering`

**Função:**

Refinar motion, animações, microinterações, feedback visual, comportamento de componentes, percepção de performance e detalhes de interação.

> Apesar de o arquivo se chamar `design-engineering-universal.md`, ele deve ser tratado exatamente como uma **Skill**.

---

### 4. Revenue-Centric Design

**Arquivo:**

`revenue-centric-design/revenue-centric-design-universal.md`

**Tipo:**

Skill

**Nome da skill:**

`revenue-centric-design`

**Função:**

Analisar decisões de produto combinando valor para o usuário com conversão, ativação, monetização, retenção, churn, posicionamento e resultados de negócio.

> Apesar de o arquivo se chamar `revenue-centric-design-universal.md`, ele deve ser tratado exatamente como uma **Skill**.

---

### 5. Viral Product Principles

**Arquivo:**

`viral-product-principles/viral-product-principles-universal.md`

**Tipo:**

Skill

**Nome da skill:**

`viral-product-principles`

**Função:**

Aplicar e adaptar princípios de simplicidade, clareza, produto, copy, pricing, diferenciação, distribuição e compartilhamento inspirados nos "32 Principles of a Viral Product".

> Apesar de o arquivo se chamar `viral-product-principles-universal.md`, ele deve ser tratado exatamente como uma **Skill**.

---

# PROMPT DE CARREGAMENTO / INTERPRETAÇÃO DAS SKILLS

O texto abaixo pode ser fornecido a qualquer agente, harness ou modelo que receba esta pasta e precise entender a estrutura:

```text
IMPORTANT — SKILL FILE INTERPRETATION

All Markdown files listed below are complete Agent Skills, even though their filenames do not use the conventional name SKILL.md.

Treat each of them exactly as a skill definition and follow its instructions whenever the skill is applicable:

- grill-me/grill-me-universal.md
  Skill name: grill-me

- frontend-design/frontend-design-universal.md
  Skill name: frontend-design

- design-engineering/design-engineering-universal.md
  Skill name: design-engineering

- revenue-centric-design/revenue-centric-design-universal.md
  Skill name: revenue-centric-design

- viral-product-principles/viral-product-principles-universal.md
  Skill name: viral-product-principles

The descriptive filenames exist only to make this universal skill library easier for humans to organize and distinguish.

Do not treat these files as ordinary notes, documentation, references, or passive Markdown content. They are executable behavioral/instructional skill definitions.

When a task matches one or more of these skills:
1. Load the relevant skill file.
2. Follow its instructions as active operating guidance.
3. Perform its mandatory upstream freshness check when tools/network access are available.
4. Preserve local adaptations unless a newer upstream change is clearly relevant.
5. Combine multiple skills only when their responsibilities genuinely overlap.

If the target agent platform strictly requires the conventional filename SKILL.md, create an installation copy of the relevant file named SKILL.md inside its own skill directory. Do not alter the original descriptive file in this library.
```

---

# Estrutura da biblioteca

```text
universal-skills/
├── README.md
├── grill-me/
│   └── grill-me-universal.md
├── frontend-design/
│   └── frontend-design-universal.md
├── design-engineering/
│   └── design-engineering-universal.md
├── revenue-centric-design/
│   └── revenue-centric-design-universal.md
└── viral-product-principles/
    └── viral-product-principles-universal.md
```

---

# Política de atualização

Todas as skills desta biblioteca possuem uma seção própria de **Mandatory upstream freshness check**.

Sempre que o ambiente tiver acesso à internet, GitHub, repositórios ou ferramentas de pesquisa, o agente deve tentar:

1. verificar a fonte/repositório upstream correspondente;
2. verificar se a skill ou os princípios foram atualizados;
3. identificar mudanças relevantes;
4. aplicar melhorias relevantes à execução atual;
5. preservar adaptações locais úteis;
6. não sobrescrever automaticamente regras locais apenas porque o upstream mudou;
7. continuar usando a versão local quando o upstream estiver indisponível.

Isso reduz o risco de a biblioteca ficar desatualizada com o tempo.

---

# Objetivo de universalidade

Estas skills foram adaptadas para não dependerem de um agente ou fornecedor específico.

Elas podem servir como base para ambientes como:

- Codex;
- Claude / Claude Code;
- Cursor;
- Kimi;
- modelos locais;
- agentes personalizados;
- IDE agents;
- harnesses futuros;
- sistemas multiagentes.

Cada ambiente pode possuir uma convenção própria de instalação.

## Caso o ambiente exija `SKILL.md`

Alguns sistemas reconhecem uma skill apenas quando existe um arquivo chamado exatamente:

`SKILL.md`

Nesse caso:

1. mantenha o arquivo original desta biblioteca com seu nome descritivo;
2. copie somente a skill necessária para a pasta esperada pelo ambiente;
3. renomeie **a cópia** para `SKILL.md`;
4. preserve o conteúdo, metadados e atribuição.

Exemplo:

```text
Biblioteca:
grill-me/grill-me-universal.md

Instalação em um sistema que exige SKILL.md:
grill-me/SKILL.md
```

Assim a biblioteca continua fácil de organizar sem perder compatibilidade com sistemas mais rígidos.

---

# Skills incluídas

## `grill-me`
Planejamento, descoberta de requisitos, questionamento e resolução de ambiguidades antes da implementação.

## `frontend-design`
Direção visual, frontend premium, identidade, hierarquia, composição e redução de padrões genéricos de IA.

## `design-engineering`
Motion, microinterações, animações, feedback, sensação de resposta e refinamento de comportamento.

## `revenue-centric-design`
Produto, CRO, onboarding, ativação, monetização, retenção, churn, pricing, posicionamento e métricas.

## `viral-product-principles`
Produto, simplicidade, copy, prova, pricing, memorabilidade, distribuição e shareability.

---

# Fontes e referências upstream

## Grill Me
https://github.com/mattpocock/skills

## Frontend Design
https://github.com/anthropics/skills

## Design Engineering
https://github.com/emilkowalski/skills

## Revenue-Centric Design
https://github.com/heliocosta-dev/revenue-centric-design

## Viral Product Principles

Fonte conceitual principal:

Marc Lou — **32 Principles of a Viral Product**

Versão preservada para leitura:

https://www.techtwitter.com/articles/32-principles-of-a-viral-product

Implementação independente usada como referência adicional:

https://github.com/meunomeebero/marc-principles

---

# Observações

- As skills desta biblioteca são adaptações universais e não cópias literais integrais das fontes.
- Ao reutilizar conteúdo upstream diretamente, respeite licenças, atribuições e restrições aplicáveis.
- A skill Revenue-Centric Design preserva a restrição de uso presente em sua fonte upstream para produtos de gambling, betting, casino e jogos de azar com dinheiro real.
- O README é documentação da biblioteca. **Ele não é uma skill.**
- Os outros cinco arquivos `.md` listados neste README **são skills**, independentemente do nome físico do arquivo.

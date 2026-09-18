---
name: grill-me
description: Relentlessly stress-test a plan, design, specification, or decision by resolving ambiguity one dependency at a time before implementation. Use when an idea feels underspecified, risky, assumption-heavy, or ready for a final pre-build challenge.
---

# Grill Me — Universal

## Purpose

Turn a loose idea into a decision-complete plan.

Do not rush into implementation. Expose hidden assumptions, resolve dependencies in the right order, and reach a shared understanding that another capable agent could execute without needing to guess.

This is a universal adaptation inspired by Matt Pocock's `grill-me` workflow.

## Mandatory upstream freshness check

**Before every use of this skill, always attempt to verify the current upstream source. Do this yourself when repository/web tools are available; do not ask the user to perform the check.**

Primary upstream:
- Repository: https://github.com/mattpocock/skills
- Current entry point: `skills/productivity/grill-me/SKILL.md`
- Upstream may delegate to other skills/primitives. Follow those references when they define the actual interview behavior.
- Also inspect repository history, README/router documentation, or related skills when the entry point has changed.

Freshness procedure:
1. Check the upstream repository and the current `grill-me` entry point.
2. Determine whether the upstream behavior, dependencies, invocation flow, or recommended process has changed.
3. If upstream has materially improved the workflow, incorporate the relevant improvement into this run.
4. Preserve this universal skill's portability, safety rules, user preferences, and local extensions unless the user explicitly wants an exact upstream mirror.
5. Never silently delete useful local behavior just because upstream is shorter or structured differently.
6. If the upstream source is unreachable, continue with this local skill and mark the check internally as unavailable rather than blocking the task.

Local baseline last reviewed: **2026-09-07**.

## When to use

Use this skill when:
- a user says "grill me", "stress-test this", "poke holes in this", or equivalent;
- a product, feature, architecture, workflow, PRD, design, ticket, or plan is still ambiguous;
- implementation would otherwise require assumptions;
- several decisions depend on each other;
- the user wants confidence before committing time or code;
- an agent is about to hand work to another agent and the handoff must be self-contained.

Do not use it to create friction around trivial, reversible decisions.

## Core operating rules

### 1. One decision at a time

Ask **one primary question at a time**.

Do not dump a questionnaire. A long batch encourages shallow answers and hides dependencies.

### 2. Resolve dependencies in order

Find the decision tree.

Before asking a question, determine what depends on what. Resolve upstream choices before downstream details.

Typical order:
1. desired outcome;
2. user/audience;
3. constraints;
4. behavior and scope;
5. data/state;
6. permissions/security;
7. failure cases;
8. integration boundaries;
9. non-functional requirements;
10. implementation and rollout.

Change the order when the domain demands it.

### 3. Facts are the agent's job; decisions are the user's job

If a question can be answered by inspecting:
- the repository;
- existing code;
- schemas;
- configuration;
- documentation;
- screenshots;
- logs;
- tests;
- APIs;
- existing product behavior;

inspect those sources instead of asking the user.

Do not make the user answer questions whose answers already exist in the available evidence.

### 4. Every important question should include a recommendation

Do not present the user with an empty decision whenever you can reason about a strong default.

Use this pattern conceptually:

- unresolved decision;
- why it matters;
- recommended answer;
- main trade-off;
- one question asking the user to accept, reject, or modify the recommendation.

Keep it conversational, not bureaucratic.

### 5. Challenge assumptions, not the user

Be rigorous without being adversarial.

Ask:
- What must be true for this to work?
- Which assumptions are unsupported?
- What happens when the happy path fails?
- Which requirement is actually a preference?
- What is irreversible or expensive to change later?
- Which edge case would invalidate the architecture?
- What can be removed without weakening the outcome?

### 6. Do not over-grill

Stop when:
- major ambiguities are resolved;
- remaining decisions are cheap and reversible;
- acceptance criteria are clear;
- important failure modes have owners/behavior;
- implementation no longer requires hidden guesses.

The goal is decision clarity, not maximal questioning.

## Repository-aware mode

When a codebase exists:

1. Inspect the project before asking architecture questions.
2. Reuse established conventions unless there is a reason to change them.
3. Search for related features and prior decisions.
4. Identify constraints from the actual stack and data model.
5. Ask only questions that remain genuinely unresolved.
6. When relevant, propose documentation updates such as ADRs, a PRD, issue text, or implementation notes.

Never invent repository facts.

## No-repository mode

When the work is conceptual:
- build a lightweight decision model in conversation;
- distinguish known facts, assumptions, preferences, and open decisions;
- ask for only the information that materially changes the plan.

## Coverage checklist

Before concluding, consider whether the plan has unresolved issues in:

- Goal and success condition
- Users / actors
- Scope and explicit non-goals
- Core flow
- Data and state
- Permissions and privacy
- Integrations
- Error / empty / loading states
- Edge cases
- Performance / scale where relevant
- Accessibility where relevant
- Observability / support where relevant
- Migration / backward compatibility
- Testing / acceptance criteria
- Rollout / rollback
- Cost / operational burden
- Ownership / maintenance

Only probe dimensions that matter for the task.

## Final convergence

When the grill is complete, produce a compact **Resolved Plan** containing:

1. **Goal**
2. **Confirmed decisions**
3. **Assumptions accepted**
4. **Non-goals**
5. **Key constraints**
6. **Important edge cases**
7. **Acceptance criteria**
8. **Remaining low-risk open items**, if any
9. **Recommended next action**

Explicitly distinguish user-confirmed decisions from agent recommendations that were merely tolerated or left unresolved.

## Anti-patterns

Do not:
- ask five unrelated questions at once;
- re-ask things already answered;
- ask the user to inspect information the agent can inspect;
- turn minor preferences into architecture debates;
- pretend there is certainty where evidence is missing;
- force the user to choose between options without giving a recommendation;
- start implementation while critical dependencies remain unresolved unless the user explicitly asks to proceed with stated assumptions;
- use "grilling" as an excuse for endless conversation.

## Portability

This skill must work across coding agents, chat models, local models, IDE agents, and future harnesses.

Never assume a specific tool name, slash command, filesystem path, or vendor capability. Use the tools that exist in the current environment and degrade gracefully when they do not.

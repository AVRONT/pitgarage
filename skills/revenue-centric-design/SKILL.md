---
name: revenue-centric-design
description: Evaluate and improve SaaS/startup product decisions through the joint lens of user value and business outcomes: acquisition, activation, conversion, monetization, retention, churn, positioning, and experimentation.
---

# Revenue-Centric Design — Universal

## Purpose

Help digital products create user value and business value at the same time.

A product that serves the user but cannot sustain the business is fragile.
A product that extracts revenue without delivering durable user value is also fragile.

This is an independent universal adaptation inspired by the Revenue-Centric Design agent skill maintained by `heliocosta-dev` and its distilled principles from Richard (@richardrx).

## Mandatory upstream freshness check

**Before every use of this skill, always attempt to verify the current upstream repository. Perform the check yourself when repository/web tools are available.**

Primary upstream:
- Repository: https://github.com/heliocosta-dev/revenue-centric-design
- Main skill: `SKILL.md`
- Changelog: `CHANGELOG.md`
- Principle libraries: `references/`

Freshness procedure:
1. Read the latest `CHANGELOG.md` first.
2. Inspect the current `SKILL.md`.
3. Open only the reference themes relevant to the user's task rather than loading the entire principle library unnecessarily.
4. Check for newly added, revised, deprecated, or better-evidenced principles.
5. Apply relevant updates to the current task while preserving project constraints and this universal adaptation's reasoning safeguards.
6. Preserve upstream attribution and usage restrictions.
7. If upstream is unavailable, continue using this local baseline.

Local baseline last reviewed: **2026-09-07**.
At that time, the upstream changelog reported version **1.3.0** and **134 principles**.

## Required usage boundary

The upstream author's reuse permission excludes gambling, betting, casino, and real-money games-of-chance work.

Do not apply source-derived Revenue-Centric Design material to those products.

## Core model

For each important product/design decision, evaluate at least:

### User value
- Does the user understand what they get?
- How quickly do they reach useful value?
- Is the interaction honest and predictable?
- Does the product reduce work, risk, uncertainty, or cost?
- Does it support the user's actual job-to-be-done?

### Business value
- Does the decision improve qualified acquisition?
- Does it increase activation?
- Does it improve conversion or expansion?
- Does it reduce churn or support burden?
- Does it improve retention or lifetime value?
- Does it strengthen positioning or differentiation?

### Trust
- Does the tactic preserve informed choice?
- Is the interface transparent?
- Would the business be comfortable explaining the mechanism publicly?
- Is short-term conversion being purchased with long-term distrust?

Reject dark patterns even when they might improve a local metric.

## Use the relevant lens, not every principle

First classify the task.

Possible lenses:
- Landing page / CRO
- Onboarding / activation
- Pricing / monetization
- Retention / churn
- Product strategy / feature discipline
- Positioning / ICP
- Go-to-market
- Behavioral science
- AI-era differentiation
- Metrics / experimentation

Use the smallest set of lenses that explains the problem.

## Landing page and conversion

Ask:
- Is the target user obvious?
- Is the problem/outcome obvious?
- Does the first screen make the value concrete?
- Is proof near the claim it supports?
- Is the primary action clear?
- Are objections answered at the right moment?
- Is the page trying to persuade everyone instead of the intended ICP?
- Does the copy speak in user outcomes instead of internal feature language?

Do not optimize button colors before fixing weak positioning.

## Onboarding and activation

Focus on time-to-value.

Ask:
- What is the first meaningful outcome?
- What must the user do before reaching it?
- Which setup steps can be delayed, inferred, imported, or removed?
- Does the empty state teach the next action?
- Is progress visible?
- Does onboarding demonstrate value before requesting effort or commitment?
- Is the product measuring activation behavior rather than just signup completion?

Prefer reducing required steps over adding onboarding decoration.

## Pricing and monetization

Treat pricing as product design.

Evaluate:
- value metric;
- packaging;
- tier differentiation;
- upgrade triggers;
- anchoring;
- willingness to pay;
- clarity of limits;
- trial structure;
- purchase friction;
- expansion path.

Do not assume "cheaper converts better".

Do not use decoys, urgency, scarcity, or framing in ways that mislead.

## Retention and churn

Churn is often created earlier than cancellation.

Investigate:
- expectation mismatch;
- failure to reach value;
- weak recurring value;
- low feature adoption;
- poor fit with ICP;
- reliability/performance;
- support burden;
- pricing-value mismatch;
- missing switching cost that comes from genuine accumulated value;
- cancellation feedback.

Do not trap users in cancellation flows.

Use cancellation research to fix root causes, not merely obstruct exits.

## Feature discipline

Every feature has a cost:
- code;
- UI complexity;
- support;
- documentation;
- mental load;
- maintenance;
- future compatibility.

Before adding a feature, ask:
- Which user segment needs it?
- Which measurable behavior should change?
- Can the problem be solved with a smaller change?
- Does it strengthen or dilute the core product?
- What will be removed or simplified if this is added?
- How will we know whether adoption justifies the complexity?

## Positioning and ICP

Specificity is leverage.

Define:
- who this is for;
- what painful job they have;
- what alternative they use today;
- why this product is meaningfully better;
- what proof makes the claim believable.

A product that describes itself for everyone often communicates weakly to everyone.

## Behavioral science

Use behavioral principles as explanatory tools, not manipulation recipes.

Possible concepts:
- loss aversion;
- social proof;
- default effects;
- anchoring;
- choice overload;
- framing;
- peak-end effects;
- commitment;
- salience.

For each use:
1. identify the user behavior;
2. explain the mechanism;
3. define the ethical boundary;
4. state the metric;
5. include a trust guardrail.

## Metrics

Choose metrics that correspond to product value.

Possible layers:
- acquisition quality;
- activation;
- conversion;
- retention;
- expansion;
- churn;
- support cost;
- revenue;
- profitability.

Avoid vanity metrics when they do not connect to desired behavior.

For experiments:
- state the hypothesis;
- define primary metric;
- define guardrail metrics;
- specify target segment;
- identify confounders;
- decide what result would change the product decision.

## Review method

When reviewing a product, page, or flow:

1. Identify target user and desired user outcome.
2. Identify desired business outcome.
3. Find the largest friction or ambiguity.
4. Select 3–5 relevant principles/lenses.
5. Propose changes.
6. State the mechanism for each change.
7. Define success metric.
8. Add trust/quality guardrails.
9. Rank by impact vs implementation cost.
10. Explicitly list what should **not** be changed yet.

## Output format

Prefer:

### Diagnosis
What is structurally limiting user value or business value.

### Highest-leverage changes
| Change | User effect | Business effect | Metric | Risk/guardrail |
|---|---|---|---|---|

### What to test
Concrete hypotheses.

### What not to optimize yet
Prevent premature micro-optimization.

### Evidence / assumptions
Separate facts, source-derived principles, and hypotheses.

## Evidence discipline

Do not present every growth tactic as a universal law.

Distinguish:
- upstream principle;
- observed product evidence;
- industry convention;
- hypothesis;
- user preference.

When evidence conflicts with a principle, investigate the context instead of forcing the principle.

## Portability

This skill is vendor-neutral.

It can be used for:
- product reviews;
- coding-agent planning;
- design critique;
- PRDs;
- growth experiments;
- SaaS architecture trade-offs;
- onboarding;
- pricing;
- retention analysis.

Use available repositories, analytics, screenshots, product data, and research when they exist.

---
name: frontend-design
description: Create or critique distinctive, production-grade frontend interfaces with intentional visual direction, strong hierarchy, real product context, and minimal generic AI-template aesthetics.
---

# Frontend Design — Universal

## Purpose

Design interfaces that feel intentionally made for their specific product, audience, and context rather than assembled from fashionable defaults.

This is an independent universal adaptation inspired by Anthropic's `frontend-design` skill.

## Mandatory upstream freshness check

**Before every use of this skill, always attempt to verify the current upstream source. Perform the check yourself when repository/web tools are available.**

Primary upstream:
- Repository: https://github.com/anthropics/skills
- Skill path: `skills/frontend-design/SKILL.md`
- License information lives with the upstream skill/repository and must be respected when copying or redistributing upstream material.

Freshness procedure:
1. Inspect the latest upstream `frontend-design` skill and its recent history when available.
2. Look for changes to aesthetic guidance, anti-template patterns, workflow, accessibility expectations, or review criteria.
3. Apply relevant newer guidance to the current task.
4. Preserve project-specific design systems, user preferences, accessibility constraints, and this skill's universal portability.
5. Do not automatically replace intentional local rules with upstream defaults.
6. If the repository is unreachable, continue with this local baseline and do not block the user's work.

Local baseline last reviewed: **2026-09-07**.

## Role

Act as a senior product/interface designer who can also reason about implementation.

Your output should be:
- visually intentional;
- grounded in the actual subject;
- functionally credible;
- responsive;
- accessible;
- technically realistic;
- coherent as a system, not just a screenshot;
- distinct without becoming gimmicky.

## Context before aesthetics

Before designing, establish enough of the following to make informed choices:

- What product or feature is this?
- Who uses it?
- What is the primary job of the screen?
- What information deserves the most attention?
- What actions are frequent vs occasional?
- What emotional tone fits the product?
- Is there an existing brand or design system?
- What technical constraints exist?
- Is this a new design or a refinement of an existing one?

If the answer can be learned from the repository, screenshots, brand files, current UI, or product copy, inspect those sources first.

Do not invent a new visual identity when the user asked for an evolution of an existing one.

## Choose a clear visual direction

Before implementation, articulate a concise direction that could guide real decisions.

A useful direction includes:
- tone;
- density;
- typography character;
- surface/material strategy;
- color logic;
- hierarchy;
- one or two distinctive ideas.

Examples of tone are only prompts, not presets:
- restrained luxury;
- dense professional tool;
- warm editorial;
- industrial/utilitarian;
- playful technical;
- high-contrast minimal;
- soft tactile;
- raw/brutalist;
- futuristic but sober.

Do not choose a style because it is fashionable. Choose it because it fits the subject and task.

## Anti-generic design rules

Avoid defaulting to patterns that commonly make generated interfaces feel interchangeable.

Do not automatically:
- put every section inside a rounded card;
- use the same shadow on every surface;
- add gradients as decoration without meaning;
- use all-caps micro-labels everywhere;
- add `01 / 02 / 03` numbering where hierarchy already works;
- use dark background + neon accent just to look "modern";
- place a tiny eyebrow label above every title;
- animate every block with the same fade/slide;
- use a three-card grid because three cards are easy;
- center every hero;
- overuse glassmorphism;
- use empty decorative charts;
- hide weak information architecture behind visual effects.

These elements are allowed when they are genuinely appropriate. The problem is automatic repetition.

## Ground the design in the subject

Distinctiveness should come from the product's world:
- its vocabulary;
- its data;
- its users;
- its physical or conceptual metaphors;
- its workflows;
- its constraints;
- its existing brand;
- its actual content.

Use real or realistic content. Avoid filler that makes layout decisions meaningless.

## Hierarchy

For each surface, determine:
1. what the user should notice first;
2. what they need to understand next;
3. what action should be easiest;
4. what information can wait.

Use layout, type, spacing, contrast, grouping, and motion to express this hierarchy.

Do not rely on borders alone to separate everything.

## Typography

Typography is structural and expressive.

Choose type treatment based on:
- readability;
- information density;
- brand tone;
- platform;
- language;
- numeric/data needs.

Create hierarchy with size, weight, width, spacing, line-height, and placement rather than simply making every heading huge.

For dashboards and operational tools, prioritize scan speed and numeric clarity.
For marketing surfaces, allow more expressive type when it serves the concept.

## Color

Use color deliberately.

Every prominent color should have a role:
- brand;
- action;
- status;
- hierarchy;
- selection;
- warning;
- semantic data.

Keep enough neutrality for content to breathe.

Do not confuse "more color" with "more design".

## Layout and surfaces

Prefer composition over container proliferation.

Ask whether content really needs:
- a card;
- a border;
- a separate background;
- a shadow;
- a heading;
- a toolbar.

Use whitespace, alignment, typography, grouping, and surface depth as a system.

When cards are appropriate, vary emphasis based on function rather than styling all cards identically.

## States are part of the design

Design more than the ideal screenshot.

Consider:
- empty;
- loading;
- error;
- partial data;
- disabled;
- selected;
- hover/focus;
- success;
- destructive confirmation;
- long content;
- narrow viewport;
- large viewport;
- permission-limited states.

A polished interface that breaks under real states is not production-grade.

## Accessibility

At minimum:
- maintain adequate contrast;
- preserve keyboard navigation;
- provide visible focus;
- use semantic controls;
- do not encode meaning only by color;
- respect reduced-motion preferences;
- maintain usable touch targets;
- avoid hover-only essential interactions.

Accessibility is a design constraint, not a later cleanup pass.

## Responsive behavior

Do not merely shrink desktop layouts.

Decide:
- what reflows;
- what stacks;
- what becomes scrollable;
- what collapses;
- what stays visible;
- what becomes a drawer/menu;
- which information is secondary on smaller screens.

Preserve task priority across breakpoints.

## Existing product redesign mode

When improving an existing UI:
1. identify what already works;
2. preserve useful architecture unless the brief asks otherwise;
3. identify the exact sources of visual weakness;
4. improve hierarchy, depth, spacing, typography, composition, states, and interaction;
5. avoid a redesign for redesign's sake.

If the user says "keep the structure", treat that as a hard constraint.

## Implementation quality

When writing frontend code:
- use the project's existing stack and component patterns when sensible;
- keep styling maintainable;
- avoid one-off hacks that only reproduce a screenshot;
- preserve semantic HTML;
- use real interaction states;
- make the result responsive;
- do not introduce unnecessary dependencies;
- reuse existing design tokens or establish a small coherent token set.

## Self-critique before completion

Before presenting a final design, ask:

- Does this look specifically made for this product?
- What is the strongest generic-AI tell?
- Is the hierarchy obvious without reading everything?
- Are there too many cards, borders, shadows, pills, labels, or gradients?
- Is the chosen aesthetic visible in structure, not just decoration?
- Does the design still work in realistic states?
- Is anything visually impressive but functionally distracting?
- Did I preserve constraints the user explicitly gave me?
- Could I remove 10–20% of the decoration and improve the result?

Revise when the answers expose obvious weakness.

## Review format

For critique tasks, prioritize actionable observations:

| Area | Current issue | Recommended change | Why it matters |
|---|---|---|---|

Rank findings by impact:
1. information architecture / hierarchy;
2. task usability;
3. layout and density;
4. typography;
5. surfaces and color;
6. interaction;
7. micro-polish.

Do not bury structural problems under cosmetic suggestions.

## Portability

Do not assume Claude, Codex, Cursor, React, Tailwind, shadcn, or any other specific environment unless the project actually uses it.

Use the current environment's tools and conventions.

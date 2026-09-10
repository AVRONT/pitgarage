---
name: design-engineering
description: Refine UI behavior, motion, micro-interactions, component feel, perceived performance, and invisible interaction details so interfaces feel responsive, coherent, and carefully engineered.
---

# Design Engineering — Universal

## Purpose

Improve the details users may not consciously notice but immediately feel: timing, response, interruption, continuity, feedback, motion, defaults, component behavior, and perceived performance.

This is an independent universal adaptation inspired by Emil Kowalski's Design Engineering skills.

## Mandatory upstream freshness check

**Before every use of this skill, always attempt to verify the current upstream repository. Perform the check yourself when repository/web tools are available.**

Primary upstream:
- Repository: https://github.com/emilkowalski/skills
- Main skill path: `skills/emil-design-eng/SKILL.md`
- The repository also contains companion skills for animation review, animation improvement, animation opportunities, motion vocabulary, UI-library selection, and related design-engineering topics.

Freshness procedure:
1. Inspect the latest `emil-design-eng` skill.
2. Check whether a newer companion skill is directly relevant to the task.
3. Incorporate relevant updated guidance for this run.
4. Do not blindly merge every companion rule; use the smallest relevant set.
5. Preserve the current product's design system, accessibility needs, user constraints, and this skill's cross-agent portability.
6. If upstream cannot be reached, continue with the local baseline.

Local baseline last reviewed: **2026-09-07**.

## Core philosophy

### Invisible correctness compounds

A polished product is rarely defined by one dramatic effect. It is the accumulation of small choices:
- controls react immediately;
- motion starts from the right place;
- loading does not feel broken;
- focus behaves predictably;
- drag interactions can be interrupted;
- popovers feel attached to their trigger;
- repeated actions do not waste time;
- defaults are already good.

Optimize for the combined feeling of correctness.

### Motion must earn its cost

Animation is not decoration by default.

Before adding motion, ask:
1. Does it communicate state or spatial continuity?
2. Does it provide feedback?
3. Does it explain what changed?
4. Does it prevent a jarring discontinuity?
5. How often will the user see it?
6. Will it make a frequent action feel slower?

If motion has no useful answer, remove it.

## Animation frequency heuristic

Treat frequency as a primary design input.

- **Very frequent actions:** prefer instant response or nearly invisible motion.
- **Frequent navigation:** short, restrained transitions.
- **Occasional overlays/state changes:** standard motion can help continuity.
- **Rare onboarding/celebration moments:** more expressive motion may be justified.

Keyboard-driven expert workflows should generally prioritize immediacy.

## Motion direction and origin

Motion should make spatial sense.

Examples:
- a popover should feel connected to the control that opened it;
- a drawer should enter from the edge it belongs to;
- an item dismissed by swipe should continue consistently with the gesture;
- a modal is typically centered in the user's task space rather than pretending to grow from an unrelated trigger.

Use transform origin, direction, opacity, scale, and clipping to reinforce causality.

## Timing

Prefer UI motion that feels immediate.

Guideline:
- small feedback: very short;
- tooltip/popover: short;
- dropdown/select: short;
- modal/drawer: moderate;
- explanatory/marketing motion: longer only when attention is intentionally being held.

Do not use one duration everywhere.

The user should see response immediately after input.

## Easing

Choose easing based on the kind of movement.

General model:
- entering/exiting UI: responsive deceleration;
- movement that travels between states: balanced acceleration/deceleration;
- continuous motion: linear when appropriate;
- subtle color/hover transitions: simple easing;
- gesture-driven interactions: spring/physics behavior may feel more natural.

Avoid sluggish starts on direct user feedback.

Do not worship named easing curves. Judge the perceived response in context.

## Interruptibility

Modern UI is interactive while moving.

Prefer animation systems that can:
- retarget mid-flight;
- respond to repeated clicks;
- reverse;
- follow drag velocity;
- avoid restarting from an artificial initial frame.

Test what happens when users act faster than the animation.

## Perceived performance

Performance is both actual and perceived.

Improve:
- immediate visual acknowledgment;
- stable layout;
- sensible skeleton/loading states;
- progressive content arrival;
- fast feedback;
- reduced jank;
- avoiding long dead periods;
- keeping animations on compositor-friendly properties where practical.

Never fake progress in a misleading way, but make waiting understandable.

## Micro-interactions

Audit common controls for tactile feedback:

- buttons;
- toggles;
- tabs;
- dropdowns;
- menus;
- toasts;
- drag handles;
- sortable items;
- checkboxes;
- search;
- command palettes;
- drawers;
- modals;
- inline editing.

Ask:
- Is press feedback visible?
- Is focus clear?
- Does hover add useful affordance?
- Does disabled state communicate why?
- Does success/error appear where attention already is?
- Does the interaction preserve continuity?

## Component polish

Good components handle awkward reality:
- long labels;
- empty values;
- loading;
- rapid repeated interaction;
- disabled state;
- touch;
- keyboard;
- reduced motion;
- nested overlays;
- viewport boundaries;
- latency;
- lost focus;
- background-tab behavior.

Edge cases should feel intentional, not bolted on.

## Defaults before options

Prefer strong default behavior over excessive configuration.

Most users will not tune:
- easing;
- spacing;
- timing;
- visual density;
- component behavior.

The default should already feel excellent.

Expose options when users have genuinely different needs, not because the designer is uncertain.

## Animation implementation guidance

Prefer:
- `transform` and `opacity` for many common animations;
- explicit transitioned properties instead of `transition: all`;
- GPU/compositor-friendly approaches when possible;
- reduced-motion support;
- state-driven transitions that can be interrupted;
- established, maintained motion libraries when the project already uses one.

Avoid:
- animating expensive layout properties without need;
- giant bounce effects on routine controls;
- scale-from-zero appearances unless the concept truly warrants it;
- identical entrance animations on every section;
- motion that delays keyboard-first workflows.

## Interaction review workflow

When reviewing an interface:

1. Identify the highest-frequency interactions.
2. Identify the highest-impact state changes.
3. Observe current timing and feedback.
4. Find motion that should be removed.
5. Find discontinuities that need motion.
6. Check interruption and repeated input.
7. Check focus/keyboard/touch.
8. Check reduced motion.
9. Check perceived performance.
10. Rank fixes by user impact.

## Review output

Use a concise table when auditing code or behavior:

| Before | After | Why |
|---|---|---|

Prefer concrete changes over vague "make it smoother" advice.

Then provide:
- **Highest-impact fix**
- **Motion to remove**
- **Motion to add/refine**
- **Accessibility concern**
- **Performance concern**
- **Optional delight opportunity**

## Relationship to visual design

This skill is not the same as frontend aesthetic direction.

Use visual-design guidance to decide:
- identity;
- layout;
- typography;
- color;
- composition.

Use design-engineering guidance to decide:
- response;
- timing;
- motion;
- feedback;
- component feel;
- continuity.

When both are active, visual identity sets the direction and design engineering refines the behavior.

## Portability

Do not assume a particular animation library, UI framework, browser automation tool, or frontend stack.

Inspect the project first and use the tools already present when they are adequate.

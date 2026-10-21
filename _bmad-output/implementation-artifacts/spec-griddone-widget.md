---
title: 'Add the Griddone CSS Grid widget'
type: 'feature'
created: '2026-10-19'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'cc024c72ed78c140c8449a1280dbd6d21d888900'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** JSON structure pages need a more capable Griddone container that lays out child widgets with native CSS Grid. The existing `Grid` widget is limited to one through four equal columns and tokenized gaps.

**Approach:** Add a distinct renderer-registered `Griddone` widget whose JSON specification controls columns, rows, gap, auto-flow, item alignment, item justification, inline display, and children. Preserve the existing `Grid` widget unchanged.

## Boundaries & Constraints

**Always:** Keep the public tag and props compatible with JSON structure-page resolution; preserve `/** @jsx h */`, the local `h` factory, `CustomWidget`, arbitrary standard widget attributes, caller-supplied classes, child order, and nested widget rendering. Use a scoped SCSS module and test observable layout through the demo's `engine:spawnWidget` path.

**Never:** Pass unsanitized arbitrary style-property names through a custom parser, change renderer APIs, modify the sibling renderer repository, remove or silently alter the existing `Grid` contract, or generate/edit build artifacts.

**Public JSON contract:** `columns` accepts a positive integer (expanded to equal `1fr` tracks) or a CSS grid-template string; `rows` accepts a CSS grid-template string; `gap` accepts `none`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, or `3xl`; `flow` accepts `row`, `column`, `row dense`, or `column dense`; `align` and `justify` accept `start`, `center`, `end`, or `stretch`; `inline` is boolean; and `children` contains widget specs. Defaults are one column, no gap, row flow, stretch alignment/justification, and block grid display. Invalid enum values and non-positive numeric columns fall back to their defaults.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Configured grid | Griddone JSON with supported layout props and child widget specs | One grid container renders all resolved children in source order using the requested layout | N/A |
| Minimal grid | Tag plus children, with optional layout props omitted | Widget uses documented defaults and remains usable | No invalid CSS class or `undefined` style value is emitted |
| Existing attributes | JSON includes `id`, `class`, ARIA, or supported common widget attributes | Attributes survive and the internal root class is retained | N/A |
| Empty children | Missing or empty children list | Empty grid container renders without throwing | Graceful empty state |

</frozen-after-approval>

## Code Map

- `packages/uci/src/Grid/grid.tsx` -- existing CSS Grid container and JSON-facing `Props`; reuse its child rendering and merged-class pattern without changing its contract accidentally.
- `packages/uci/src/Grid/grid.module.scss` -- current fixed one-to-four-column implementation and legacy placement rules; establishes available layout spacing conventions.
- `packages/uci/src/Flex/flex.tsx` -- stronger example of runtime defaults for JSON-originated values and preservation of caller attributes/classes.
- `packages/uci/src/index.ts` -- public component and props barrel; export a distinct widget here if selected.
- `packages/uci/index.ts` -- renderer-facing `widgets` registry; register the exact selected JSON tag here.
- `packages/uci/public/api/navigation/e2e/test.json` -- shared test page containing the spawn target.
- `e2e/*.spec.ts` -- Playwright conventions for spawning widgets from JSON and asserting browser-visible behavior; add a focused Griddone/Grid spec.

## Tasks & Acceptance

**Execution:**
- [x] `packages/uci/src/Griddone/griddone.tsx` and `packages/uci/src/Griddone/griddone.module.scss` -- implement the approved JSON props, safe defaults, class merging, native CSS Grid layout, and child rendering.
- [x] `packages/uci/src/index.ts` and `packages/uci/index.ts` -- expose the component, props type, and `Griddone` renderer registry tag.
- [x] `e2e/griddone.spec.ts` -- spawn representative JSON specs and verify registration, children, configured computed layout, invalid-value defaults, and retained attributes/classes.

**Acceptance Criteria:**
- Given an approved JSON specification, when the renderer resolves and spawns the widget, then the expected public tag creates a CSS Grid container containing every child in source order.
- Given caller attributes and a caller class, when the widget renders, then those values and the widget's internal root styling coexist.
- Given omitted optional props or no children, when the widget renders, then documented defaults apply and no exception or malformed layout token occurs.
- Given the pre-existing `Grid` API, when the feature is introduced as a separate widget, then existing `Grid` JSON continues to behave unchanged.

## Implementation Notes

- Added the distinct `Griddone` registry tag and public `GriddoneProps` export without changing `Grid`.
- Layout props are normalized into explicit CSS properties; dedicated Griddone props take precedence over matching entries in the generic `style` object.
- Browser coverage uses one parent spawn to avoid concurrent renderer spawn races and waits for the fixture target before dispatching.
- Verification passed: focused Chromium E2E (2 tests), production build, and whitespace checks. Existing Sass, font-resolution, and Rollup circular-export warnings remain unchanged.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npx playwright test e2e/griddone.spec.ts --project=chromium` -- expected: focused JSON rendering and layout checks pass.
- `npm run build` -- expected: TypeScript/SCSS bundle succeeds and public exports resolve.
- `git diff --check` -- expected: no whitespace errors.

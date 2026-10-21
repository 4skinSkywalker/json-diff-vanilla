---
title: 'Make the standalone JSON differ structurally accurate'
type: 'bugfix'
created: '2026-10-21'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The visual differ aligns formatted JSON as unrelated text lines. When adjacent property values change, its LCS backtracking and simplistic remove-plus-add merge can pair the wrong properties, producing misleading removed, changed, and added rows.

**Approach:** Replace ambiguous line-only matching with a deterministic, JSON-aware side-by-side diff that preserves structural correspondence, while retaining the existing dependency-free browser API and visual presentation. Add an automated vanilla-JavaScript test suite covering objects, arrays, nesting, primitive roots, errors, and regressions.

## Boundaries & Constraints

**Always:** Keep `new JsonCompareUI(id, options)` and `diff(left, right)` browser usage compatible; compare object members by key rather than by nearby line position; preserve source-side line numbers and valid formatted JSON content; produce deterministic output; render untrusted values with `textContent`; and keep the implementation usable without third-party runtime dependencies.

**Never:** Treat property order alone as a value change, mutate parsed input values, use heuristic pairing that can report one key as another key's replacement, or require a framework/build step for browser use.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Adjacent changed fields | `name` and `age` values both differ | Two changed rows pair each property with the same property; unchanged `city` remains aligned | N/A |
| Object membership | A key exists on only one side | Its complete formatted member is shown as removed or added without mispairing neighboring keys | N/A |
| Nested values | Objects and arrays contain changed, added, or removed descendants | Containers stay aligned and descendant changes receive the correct row types | N/A |
| Arrays | Elements are changed, inserted, or removed | Stable elements are aligned and edits do not cascade into unrelated replacements | N/A |
| Equivalent objects | Values are equal but object key order differs | No semantic differences are reported | N/A |
| Primitive roots | Root values are strings, numbers, booleans, or null | Values compare and render without assuming an object root | N/A |
| Invalid or empty input | Either side is absent or invalid JSON | Existing status area shows a side-specific error and stale diff output is cleared | No exception escapes `diff` |

</frozen-after-approval>

## Code Map

- `json-compare.js` -- `JsonCompareUI.diff`, `createSideBySideDiff`, and `createLineDiff` currently parse, format, align, and render. Replace the text-LCS core with testable structural diff logic while preserving DOM-facing methods and the global class.
- `json-diff.css` -- Existing `unchanged`, `removed`, `added`, and `changed` row classes define the visual contract; change only if structural rendering needs a small presentation correction.
- `index.html` -- Browser integration example and regression fixture; retain direct script loading and constructor usage.
- `test/json-compare.test.js` -- New dependency-free Node test suite for the diff engine and public behavior that can be tested without a browser DOM.
- `package.json` -- New minimal test command using Node's built-in test runner; no external packages.

## Tasks & Acceptance

**Execution:**
- [x] `json-compare.js` -- separate deterministic JSON comparison from DOM rendering, structurally align object properties and array elements, correct difference counts and no-difference handling, clear stale output on errors, and export testable logic without breaking browser globals.
- [x] `test/json-compare.test.js` -- cover every matrix row plus the reported `John`/`Ema` and `30`/`50` regression, multi-line additions/removals, type changes, special values representable in JSON, and deterministic repeated runs.
- [x] `package.json` -- provide a zero-dependency `npm test` entry point for the built-in test runner.
- [x] `index.html` -- keep the demonstration compatible and correct any fixture or markup defect uncovered by verification.

**Acceptance Criteria:**
- Given the reported two-object example, when it is diffed, then `name` aligns only with `name`, `age` aligns only with `age`, `city` remains unchanged, and the status reports exactly two differences.
- Given semantically equal JSON objects whose keys appear in different orders, when they are diffed, then the status reports no differences.
- Given the complete automated suite, when `npm test` runs on a supported Node installation, then all tests pass without downloading dependencies.
- Given existing direct browser usage, when `json-compare.js` is loaded as a script, then `window.JsonCompareUI` remains constructible and the controls continue to render diff rows.

## Implementation Notes

- Replaced line LCS with a pure structural engine: key identity aligns objects, semantic LCS aligns arrays, and explicit rows decouple comparison from DOM rendering.
- Object key order is ignored semantically; display order follows left-side keys followed by right-only keys, keeping both rendered columns valid JSON.
- Exported `JsonDiffEngine` and `JsonCompareUI` through CommonJS for tests while preserving browser globals. Hardened labels and rows to use `textContent`, repaired repeatable swapping, and clear stale rows before validation.
- Added nineteen zero-dependency Node tests. `npm test` and `node --check json-compare.js` pass.
- Review hardening added shared-order rendering for reordered objects, bounded large-array alignment, safe-number and JSON-value validation, explicit nesting/cycle failures, non-heuristic container replacement rows, safe container lookup, required-markup validation, and behavioral UI control assertions.

## Spec Change Log

## Review Triage Log

| # | Source | Verdict | Evidence and route |
|---|--------|---------|--------------------|
| 1 | Blind: reordered equal objects | medium | Confirmed independently ordered rows were zipped. Patched by recursively rendering equal containers with shared object-key order; test now asserts every paired row matches. |
| 2 | Blind: mojibake success symbol | false | The source contains `✅`; only the PowerShell-generated review diff transcoded it to `Ô£à`. No source patch needed. |
| 3 | Blind: quadratic array matrix | high | Confirmed unbounded O(m×n) allocation. Patched with a one-million-cell cap and bounded-lookahead linear fallback, covered by a 1,100-element test. |
| 4 | Blind: warning cannot paint | low | Confirmed synchronous replacement made the warning ineffective. Patched by removing it; bounded alignment now prevents the warned-about allocation. |
| 5 | Blind: demo has no JSON editor | low | Rejected as a pre-existing sample-page limitation outside the requested differ behavior; adding an editor is a separate user-facing feature. |
| 6 | Blind: selector interpolation | medium | Confirmed malformed IDs could throw in `querySelector`. Patched with static container selection plus exact `data-id` matching and a metacharacter regression test. |
| 7 | Blind: missing child markup | medium | Confirmed null dereferences were opaque. Patched with named required-element validation and an error-message test. |
| 8 | Blind: recursive stack overflow | medium | Confirmed deeply nested parsed JSON could exhaust recursion. Patched with iterative pre-validation and a 500-level explicit limit, covered by a test. |
| 9 | Blind: non-JSON public values | medium | Confirmed exported engine accepted unsupported and cyclic values. Patched with iterative JSON-value, finite-number, cycle, and depth validation. |
| 10 | Blind: difference-count granularity | low | Rejected: the count intentionally represents edited members/elements; an entirely added subtree is one member edit while independently changed descendants are separate edits. |
| 11 | Blind: swapped validation labels | false | `left` and `right` identify visible columns; swapping changes labels and stored data together, so a subsequent left error still identifies the visible left side. |
| 12 | Blind: mixed page language/title | low | Rejected as pre-existing cosmetic demo text unrelated to comparison correctness. |
| 13 | Blind: implicit submit buttons | low | Confirmed when the demo is embedded in a form. Directly patched both controls with `type="button"`. |
| 14 | Blind: reordered-row test gap | medium | Confirmed. Patched the semantic-order test to require identical left/right content on every unchanged row. |
| 15 | Edge: negative zero | low | Confirmed `Object.is(-0, 0)` disagreed with identical rendered JSON. Patched primitive equality and added a text-parsing regression test. |
| 16 | Edge: incompatible container pairing | medium | Confirmed positional zipping could imply unrelated nested replacements. Patched to emit separate removed/added subtrees and tested object-to-array replacement. |
| 17 | Edge: large array allocation | high | Duplicate of #3; the bounded fallback patch and large-array test cover it. |
| 18 | Edge: unsafe integers | high | Confirmed standard parsing could collapse distinct integer literals. Patched lexical number validation (excluding strings) to reject unsafe/non-finite numbers before parsing. |
| 19 | Edge: duplicate object names | false | Under the existing `JSON.parse` contract, duplicate names resolve to the final member before a JSON value exists; the structural engine compares those parsed values as designed. |
| 20 | Edge: selector metacharacters | medium | Duplicate of #6; exact attribute matching and its regression test cover it. |
| 21 | Edge: one empty input message | low | Rejected: the shared “provide JSON in both inputs” instruction is accurate and no incorrect side is identified. |
| 22 | Edge claim: reordered object alignment | medium | Duplicate of #1; shared key-order rendering and exact row-alignment assertions cover it. |
| 23 | Verification: rendered rows weakly tested | medium | Confirmed broken-verification gap. Patched UI test to assert row class, both line numbers, and both rendered contents. |
| 24 | Verification: controls untested | medium | Confirmed regression gap. Patched tests to invoke show/swap handlers, assert classes, text, labels, data orientation, and second-swap restoration. |
| 25 | Verification other: mojibake | false | Duplicate of #2; direct source inspection proves the Unicode symbol is intact. |

## Design Notes

Represent the comparison as explicit side-by-side rows before touching the DOM. Object keys provide identity; arrays need sequence alignment based on structural equality, with unmatched adjacent elements paired as changes only when doing so cannot shift a clearly matching suffix or prefix. This keeps rendering simple and makes alignment behavior independently testable.

## Verification

**Commands:**
- `npm test` -- expected: all structural diff regression and edge-case tests pass.
- `node --check json-compare.js` -- expected: the standalone browser script is syntactically valid.

**Manual checks:**
- Open `index.html`; expect `name` and `age` to appear as two same-key changed rows and `city` as unchanged, with show-only-differences and swap controls still working.

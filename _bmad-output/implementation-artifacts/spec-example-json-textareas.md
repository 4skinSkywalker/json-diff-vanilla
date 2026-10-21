---
title: 'Add editable JSON inputs to the example page'
type: 'feature'
created: '2026-10-21'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'f3a72b8400bc196f09a38c85e4595f3ca53b39f0'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The example page renders a hard-coded JSON comparison, so testing other JSON values requires editing source code.

**Approach:** Add side-by-side text areas below the differ, prefilled with the existing left and right examples, and connect them to the existing `JsonCompareUI.diff(left, right)` API so pasted JSON can be compared visually.

## Boundaries & Constraints

**Always:** Keep the input order aligned with the left and right diff columns, preserve the current initial example, and use the existing UI's validation/status feedback for invalid JSON.

**Never:** Change the reusable comparison engine or require a framework or build step.

**Decision:** Re-run the comparison automatically whenever either text area emits an `input` event, accepting transient validation messages while JSON is being edited.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid JSON | JSON text exists in both inputs | The differ displays the comparison of the current input values | N/A |
| Invalid JSON | Either input contains malformed JSON | The differ clears stale output and identifies the invalid side | Existing `JsonCompareUI` status message is shown |
| Empty input | Either input is empty or whitespace | No comparison is rendered | Existing “Please provide JSON in both inputs” status is shown |

</frozen-after-approval>

## Code Map

- `index.html` -- Example markup and inline initialization; add the two inputs, their trigger wiring, and move the existing sample JSON into the inputs.
- `json-diff.css` -- Existing component stylesheet; add layout and text-area styling scoped to the example input area without changing differ behavior.
- `json-compare.js:428-476` -- Existing public `diff(left, right)` entry point and validation/error rendering to reuse unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `index.html` -- Add labeled left/right JSON text areas below the differ, prefill them with the current samples, and wire the selected comparison trigger to `JsonCompareUI.diff()`.
- [x] `json-diff.css` -- Style the input area as a readable two-column layout that stacks on narrow screens.

**Acceptance Criteria:**
- Given the example page is opened, when it finishes loading, then the existing sample comparison is shown and both text areas contain the corresponding source JSON.
- Given replacement left and right JSON has been pasted, when comparison is triggered, then the visual differ reflects those exact values.
- Given a narrow viewport, when the input area is displayed, then the text areas remain usable without horizontal page overflow.

## Implementation Notes

- Added accessible, spellcheck-disabled text areas below the example differ and initialized them with the existing sample strings.
- Both `input` events call the existing `JsonCompareUI.diff()` method, retaining its valid, invalid, and empty-input handling.
- Added a two-column grid that collapses to one column at 768px; `minmax(0, 1fr)`, `min-width: 0`, and border-box sizing prevent horizontal overflow.
- Verification: `npm test` passed all 19 tests, including valid rendering and invalid/empty UI input coverage.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm test` -- expected: all existing engine tests pass.

**Manual checks (if no CLI):**
- Open `index.html`, replace both values with valid JSON, trigger comparison, and confirm the diff updates.
- Test malformed and empty JSON and confirm the existing side-specific status errors appear.

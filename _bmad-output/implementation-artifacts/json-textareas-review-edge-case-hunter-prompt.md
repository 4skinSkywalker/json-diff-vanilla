Read the following reviewer instructions completely and follow them as your review instructions.

<reviewer-instructions>
# Edge Case Hunter Review

**Goal:** You are a pure path tracer. Never comment on whether code is good or bad; only list missing handling.
When a diff is provided, scan only the diff hunks and list boundaries that are directly reachable from the changed lines and lack an explicit guard in the diff.
When no diff is provided (full file or function), treat the entire provided content as the scope.
Ignore the rest of the codebase unless the provided content explicitly references external functions.
A brief secondary deletion check runs as Step 4 when the diff removes code.
A claims check runs as Step 5.

**Inputs:**
- **content** â€” Content to review, or a path to read it from: diff, full file, or function
- **also_consider** (optional) â€” Areas to keep in mind during review alongside normal edge-case analysis
- **claims_file** â€” Path to the spec this change was built from. Do NOT read it before Step 5: the path tracing in Steps 2â€“3 must finish before the claims are seen.

**MANDATORY: Execute steps in the Execution section IN EXACT ORDER. DO NOT skip steps or change the sequence. When a halt condition triggers, follow its specific instruction exactly. Each action within a step is a REQUIRED action to complete that step.**

**Your method is exhaustive path enumeration â€” mechanically walk every branch, not hunt by intuition. Report ONLY paths and conditions that lack handling â€” discard handled ones silently. Do NOT editorialize or add filler. Do not assign severity labels, rankings, or priority levels.**


## EXECUTION

### Step 1: Receive Content

- Take the content to review from the parent message that launched you â€” inline, or by reading the file it points to (never from this instruction file)
- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped â€” no analysis performed"}]` and stop
- Identify content type (diff, full file, or function) to determine scope rules

### Step 2: Exhaustive Path Analysis

**Walk every branching path and boundary condition within scope â€” report only unhandled ones.**

- If `also_consider` input was provided, incorporate those areas into the analysis
- Walk all branching paths: control flow (conditionals, loops, error handlers, early returns) and domain boundaries (where values, states, or conditions transition). Derive the relevant edge classes from the content itself â€” don't rely on a fixed checklist. Examples: missing else/default, unguarded inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Consider implicit branches: the diff special-cases or changes the handling of one or more members of a fixed set of values â€” enums, status codes, sentinels, type tags, flags, value ranges. The rest of the set is implicit branches (e.g. the diff changes the `RED` and `YELLOW` cases of a `RED`/`YELLOW`/`GREEN` enum; `GREEN` is the implicit branch)
- Consider handle lifetime: when the changed code re-checks, re-fetches, or re-validates something it already held â€” a handle, index, id, pointer â€” the re-check exists because an intervening call can invalidate it. Identify that call, what it does to the thing held, and what the changed code silently skips when the re-check fails
- For each call site the diff adds or changes â€” in test files as well as production code â€” read the callee's declaration and check the call against it: argument count, order, types, and defaults. Report any mismatch
- For each path: determine whether the content handles it
- Collect only the unhandled paths as findings â€” discard handled ones silently

### Step 3: Validate Completeness

- Revisit every edge class from Step 2 â€” e.g., missing else/default, null/empty inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Add any newly found unhandled paths to findings; discard confirmed-handled ones

### Step 4: Deletion Check

If the diff removed or replaced meaningful code (ignore pure renames and whitespace): load `references/deletion-check.md` and follow it.

### Step 5: Claims Check

Load `references/claims-check.md` and follow it.

### Step 6: Present Findings

Output all findings as a single JSON array following the Output Format specification exactly.


## OUTPUT FORMAT

Return ONLY a valid JSON array of objects. Each edge-case finding contains exactly these four fields:

```json
[{
  "location": "file:start-end (or file:line when single line, or file:hunk when exact line unavailable)",
  "trigger_condition": "one-line description (max 15 words)",
  "guard_snippet": "minimal code sketch that closes the gap (single-line escaped string, no raw newlines or unescaped quotes)",
  "potential_consequence": "what could actually go wrong (max 15 words)"
}]
```

No extra text, no explanations, no markdown wrapping. An empty array `[]` is valid when nothing is found. Deletion findings from Step 4 and claim findings from Step 5, if any, go in the same array with the extra fields defined in `references/deletion-check.md` and `references/claims-check.md`.


## HALT CONDITIONS

- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped â€” no analysis performed"}]` and stop
<reference path="references/deletion-check.md">
# Deletion Check

Secondary pass for the Edge Case Hunter â€” runs only when the diff removed meaningful code. Subordinate to the edge-case pass; findings are usually few or none.

For each chunk of removed or replaced code (ignore pure renames and whitespace), ask: did it carry behavior or a contract that the change neither re-established nor intentionally retired? Add a finding for any resulting regression, orphaned reference, or newly-dead code. Skip anything already covered by your edge-case findings.

Append each finding to the same JSON array as the edge-case findings, with the four standard fields plus:

- `kind`: `"deletion"`
- `confidence`: `"high"`, `"medium"`, or `"low"` â€” these are inferences; rate them

For a deletion finding the standard fields read as: `location` = the removed item; `trigger_condition` = the behavior or contract it enforced; `guard_snippet` = where or how to re-establish it; `potential_consequence` = the regression or orphan.

Add nothing if nothing qualifies.
</reference>
<reference path="references/claims-check.md">
# Claims Check

Final pass for the Edge Case Hunter. Read the claims file named in the message that launched you now, for the first time; the path tracing is finished and the claims cannot steer it retroactively.

It is the spec the change was built from. Read only its `## Intent` and `## Tasks & Acceptance` sections â€” the claims live there; ignore the rest of the file. The spec is the change's own account of itself: testimony, not evidence â€” a claim repeated in a code comment is still the same claim, not confirmation. Extract each checkable claim â€” what the change does, what it preserves, ordering, arithmetic, and parity with existing code ("exactly as X does") â€” then try to falsify each one against the code you have already traced. Where your trace is not enough to decide, read the code that decides it: the compared-to function, the actual callee, the state the claim assumes.

Append one finding per falsified claim to the same JSON array, with the four standard fields plus:

- `kind`: `"claim"`
- `confidence`: `"high"`, `"medium"`, or `"low"`

For a claim finding the standard fields read as: `location` = where the code contradicts the claim; `trigger_condition` = the claim, quoted or tightly paraphrased; `guard_snippet` = what the code actually does; `potential_consequence` = what goes wrong for someone who believed the claim.

Verified claims produce nothing. Add nothing if nothing is falsified.
</reference>

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is.

</reviewer-instructions>

claims_file (leave unread until your instructions call for it):
<claims-file>
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

<frozen-after-approval reason="human-owned intent â€” do not modify unless human renegotiates">

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
| Empty input | Either input is empty or whitespace | No comparison is rendered | Existing â€œPlease provide JSON in both inputsâ€ status is shown |

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

</claims-file>

Review content: the unified diff follows. It is the content under review.
<diff>
diff --git a/index.html b/index.html
index 4055593..ddb615f 100644
--- a/index.html
+++ b/index.html
@@ -22,11 +22,24 @@
         </div>
     </div>
 
+    <div class="json-input-panel">
+        <label class="json-input-field">
+            <span>Left JSON</span>
+            <textarea id="left-json" spellcheck="false" aria-label="Left JSON"></textarea>
+        </label>
+        <label class="json-input-field">
+            <span>Right JSON</span>
+            <textarea id="right-json" spellcheck="false" aria-label="Right JSON"></textarea>
+        </label>
+    </div>
+
     <script src="./json-compare.js"></script>
     <script>
         window.onload = function() {
             const jsonCompareUI = new JsonCompareUI('test', { left: 'Left JSON', right: 'Right JSON' });
-            jsonCompareUI.diff(`{
+            const leftInput = document.getElementById('left-json');
+            const rightInput = document.getElementById('right-json');
+            const leftJson = `{
   "name": "John",
   "age": 30,
   "city": "New York",
@@ -46,7 +59,8 @@
   "provaprova": "ciao",
   "total2": 2,
   "zeta": "New York"
-}`, `{
+}`;
+            const rightJson = `{
   "name": "Ema",
   "age": 50,
   "zeta": "New York",
@@ -65,7 +79,15 @@
   "yada": 1,
   "provaprova": "ciao",
   "total": 1
-}`);
+}`;
+
+            leftInput.value = leftJson;
+            rightInput.value = rightJson;
+
+            const updateDiff = () => jsonCompareUI.diff(leftInput.value, rightInput.value);
+            leftInput.addEventListener('input', updateDiff);
+            rightInput.addEventListener('input', updateDiff);
+            updateDiff();
         };
     </script>
 </body>
diff --git a/json-diff.css b/json-diff.css
index 8b872a3..b8fcfd4 100644
--- a/json-diff.css
+++ b/json-diff.css
@@ -248,3 +248,35 @@
         }
     }
 }
+
+.json-input-panel {
+    display: grid;
+    grid-template-columns: repeat(2, minmax(0, 1fr));
+    gap: 12px;
+    margin-top: 12px;
+}
+
+.json-input-field {
+    display: grid;
+    gap: 6px;
+    min-width: 0;
+    font-weight: 600;
+}
+
+.json-input-field textarea {
+    box-sizing: border-box;
+    width: 100%;
+    min-height: 240px;
+    padding: 10px;
+    resize: vertical;
+    border: 1px solid #c5c5c5;
+    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
+    font-size: 12px;
+    line-height: 1.4;
+}
+
+@media (max-width: 768px) {
+    .json-input-panel {
+        grid-template-columns: 1fr;
+    }
+}
diff --git a/AGENTS.md b/AGENTS.md
new file mode 100644
index 0000000..662b215
--- /dev/null
+++ b/AGENTS.md
@@ -0,0 +1,11 @@
+## Windows environment
+
+- This project is run on Windows using PowerShell.
+- `uv` is installed, but the agent's execution environment may not resolve it through PATH.
+- When running `uv` commands, use this absolute executable path:
+  `C:\Users\federico.trotta_grup\.local\bin\uv.exe`
+- In PowerShell, invoke the quoted executable path with the `&` operator.
+- For example:
+  & "C:\Users\federico.trotta_grup\.local\bin\uv.exe" run --no-cache ...
+- Apply this to BMAD workflow commands too. Do not conclude that uv is
+  missing merely because the bare `uv` command is not recognized.
\ No newline at end of file
diff --git a/_bmad-output/implementation-artifacts/spec-example-json-textareas.md b/_bmad-output/implementation-artifacts/spec-example-json-textareas.md
new file mode 100644
index 0000000..ed2cc86
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-example-json-textareas.md
@@ -0,0 +1,73 @@
+---
+title: 'Add editable JSON inputs to the example page'
+type: 'feature'
+created: '2026-10-21'
+status: 'in-review'
+route: 'dispatch'
+review_loop_iteration: 0
+baseline_commit: 'f3a72b8400bc196f09a38c85e4595f3ca53b39f0'
+context: []
+---
+
+<frozen-after-approval reason="human-owned intent ÔÇö do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** The example page renders a hard-coded JSON comparison, so testing other JSON values requires editing source code.
+
+**Approach:** Add side-by-side text areas below the differ, prefilled with the existing left and right examples, and connect them to the existing `JsonCompareUI.diff(left, right)` API so pasted JSON can be compared visually.
+
+## Boundaries & Constraints
+
+**Always:** Keep the input order aligned with the left and right diff columns, preserve the current initial example, and use the existing UI's validation/status feedback for invalid JSON.
+
+**Never:** Change the reusable comparison engine or require a framework or build step.
+
+**Decision:** Re-run the comparison automatically whenever either text area emits an `input` event, accepting transient validation messages while JSON is being edited.
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|----------|--------------|---------------------------|----------------|
+| Valid JSON | JSON text exists in both inputs | The differ displays the comparison of the current input values | N/A |
+| Invalid JSON | Either input contains malformed JSON | The differ clears stale output and identifies the invalid side | Existing `JsonCompareUI` status message is shown |
+| Empty input | Either input is empty or whitespace | No comparison is rendered | Existing ÔÇ£Please provide JSON in both inputsÔÇØ status is shown |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `index.html` -- Example markup and inline initialization; add the two inputs, their trigger wiring, and move the existing sample JSON into the inputs.
+- `json-diff.css` -- Existing component stylesheet; add layout and text-area styling scoped to the example input area without changing differ behavior.
+- `json-compare.js:428-476` -- Existing public `diff(left, right)` entry point and validation/error rendering to reuse unchanged.
+
+## Tasks & Acceptance
+
+**Execution:**
+- [x] `index.html` -- Add labeled left/right JSON text areas below the differ, prefill them with the current samples, and wire the selected comparison trigger to `JsonCompareUI.diff()`.
+- [x] `json-diff.css` -- Style the input area as a readable two-column layout that stacks on narrow screens.
+
+**Acceptance Criteria:**
+- Given the example page is opened, when it finishes loading, then the existing sample comparison is shown and both text areas contain the corresponding source JSON.
+- Given replacement left and right JSON has been pasted, when comparison is triggered, then the visual differ reflects those exact values.
+- Given a narrow viewport, when the input area is displayed, then the text areas remain usable without horizontal page overflow.
+
+## Implementation Notes
+
+- Added accessible, spellcheck-disabled text areas below the example differ and initialized them with the existing sample strings.
+- Both `input` events call the existing `JsonCompareUI.diff()` method, retaining its valid, invalid, and empty-input handling.
+- Added a two-column grid that collapses to one column at 768px; `minmax(0, 1fr)`, `min-width: 0`, and border-box sizing prevent horizontal overflow.
+- Verification: `npm test` passed all 19 tests, including valid rendering and invalid/empty UI input coverage.
+
+## Spec Change Log
+
+## Review Triage Log
+
+## Verification
+
+**Commands:**
+- `npm test` -- expected: all existing engine tests pass.
+
+**Manual checks (if no CLI):**
+- Open `index.html`, replace both values with valid JSON, trigger comparison, and confirm the diff updates.
+- Test malformed and empty JSON and confirm the existing side-specific status errors appear.

</diff>

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. If the instruction file is unreadable, report that exact failure and stop. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

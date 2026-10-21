Read the following reviewer instructions completely and follow them as your review instructions.

<reviewer-instructions>
# Verification Gap Review

**Goal:** Find changed behavior that could break without reliable verification catching it. Ask one question â€” "if the behavior this change is supposed to produce broke where it's actually used, would verification fail?" Do not hunt for correctness bugs, but report genuine problems you notice while tracing verification.

The main verification gap shapes are:

1. **Regression gap:** the changed code regresses where it's used, and no test covering that use would fail.
2. **Missing-adoption gap:** a place that should now use the new behavior doesn't; it handles the same case its own way, or not at all, and no test would flag the omission.
3. **Broken-verification gap:** a test appears to cover the changed behavior, but would not actually protect it because it is skipped, flaky, not run in the normal verification path, or too weak to observe the regression.

## Evidence Rules

- Read a test before claiming what it covers, runs, asserts, or misses.
- Before claiming no test exists, search the whole repo by the symbol under test and by import references; expected file locations are not enough.
- Never assert what you did not verify. If a finding cannot be grounded, drop it.
- In a finding, say what you actually checked â€” "none of the tests I read cover this" â€” and show how far you looked. Say a test doesn't exist anywhere only when the symbol/import-reference search actually shows that.
- Do not assign severity, confidence, priority, or ranking.

## Review Sequence

### Step 1: Screen for behavioral change

Screen each part of the change separately. If a part is non-behavioral, skip it. Call a part non-behavioral only when the changed code does not alter return values, thrown errors, caller-visible side effects, or observable state (including iteration order and emitted messages). Once a part meets that test, move on; do not inspect callers or tests for extra confirmation.

Common non-behavioral examples: formatting, comments, whitespace; pure renames; trivial getters/setters and pass-throughs; type-only or compiler-enforced changes with no runtime effect; etc.

Only outcomes produced by deterministic code are worth automatically testing; tests are useless on static source text and brittle on LLM output. Skip those parts.

If every part is skipped, output the clean result (see Output Format).

### Step 2: Find the behavior that changed

Identify what behavior changed compared to the previous version: output, side effect, branch, error path, schema/event shape, config default, validation/authorization rule, external contract, etc. If the change affects more than one behavior, handle each separately.

Treat broad-impact changes as behavioral even when no single changed line looks important: dependency, toolchain, build/config, data-file, etc.

### Step 3: Trace where that behavior is used

Trace the changed behavior to the places that observe it. Start with direct callers and registered entry points (routes, commands, DI), contract consumers (schemas, events, APIs, database readers), and reverse-dependency info if already available.

Follow a path only while the changed behavior is reachable and unverified. Stop when a test at that boundary would fail, the consumer does not observe the changed behavior, or the next hop is guesswork (dynamic dispatch, reflection, outside-repo consumers, etc.). Prefer the nearest observable boundary, often one to three hops away, especially across contract, integration, or service edges. If there are more than five similar consumers, group obvious repeats and check representative paths; expand only when a consumer observes the behavior differently.

### Step 4: Qualify the consumer, then check its test

For each consumer, name the smallest realistic regression this consumer would observe: invert the branch, drop the default, omit the field, return the old error code, skip the integration call, etc. This is the Demonstration. If no such regression exists, drop the path; untested downstream code is not a finding.

A `Missing-adoption gap` qualifies not by the adoption failure alone but by a supersession signal: the change gives clear evidence the new behavior is meant to replace the local one â€” PR intent, naming or docs, a replaced sibling site, deleted duplicate logic, or a test defining the new rule â€” and the local site shares the same observable contract. Without a supersession signal and a shared observable contract, it is a refactor suggestion, not a verification-gap finding. Once both hold, check whether any test for that site would flag the non-adoption; missing coverage of the non-adoption is the gap itself, not a disqualifier.

Find and read the relevant test. Ask whether the Demonstration would make an assertion fail.

- If yes, the behavior is verified. No finding.
- For a regression-style Demonstration: if no test runs the path, the test is skipped/flaky/not run normally, or the test runs the code without checking the changed result, report a `Regression gap` or `Broken-verification gap`.
- For a qualifying Missing-adoption case: if none of the site tests you found assert it adopts the new behavior, report a `Missing-adoption gap`.

A test counts only if it runs normally and an assertion observes the changed output, branch, or contract. These do not count: no execution; source-text assertions that match a file's wording instead of running it; success/no-throw/snapshot-only checks; mock/log-call checks; human-only checks; tests that mock away the integration; e2e tests that pass through without checking the changed output; stale assertions or fixtures.

For example, `expect(x ?? DEFAULT).toBe(DEFAULT)` passes when `x` is missing.

Common patterns:

- **Caller-path gap** â€” helper test covers the branch, but caller values skip it.
- **Contract drift** â€” payload/schema/event changes must be verified at the consumer.
- **Migration compatibility** â€” tests only create new-format rows or fresh schemas.
- **Phantom exception** â€” handled partial-failure path has no test.
- **Missing-adoption gap** â€” sibling site should use the new rule/helper and does not.
- **Removed verification** â€” deleted test or weakened assertion leaves behavior unpinned; removing a source-text assertion is not this, since it never counted.

### Step 5: Confirm each finding is real

Before writing a finding, re-open the specific tests or search results the finding relies on. Verify the Demonstration would not make any test you checked fail, or that the absence claim is backed by the symbol/import-reference search. Do not claim more than you verified; drop any finding you cannot ground.

Explain why the test misses the bug using what the test sets up and checks.

Do not report: compiler/type-checker-enforced cases; behavior already verified by an integration, contract, or e2e test; implementation-detail or mock-only tests; low coverage or a missing test file by itself; legacy untested code the change did not affect.

Report genuine problems you noticed while tracing verification, even if they are not verification gaps. Put them under `Other findings` in the output. This permits reporting what you already reached, not extra hunting. A claim that code misbehaves is a defect, not a gap â€” it goes under `Other findings` for standard triage, however you found it.

## OUTPUT FORMAT

Emit each verification-gap finding as one block. No general advice, no severity or confidence. Triage trusts a gap finding as filed and does not re-verify it, so each block must stand on its own evidence.

```markdown
### <one-line title naming the gap>

- **Changed surface:** the exact behavior or contract that changed â€” `file:line`.
- **Impacted consumer or site:** named concretely with `file:line` (e.g. "the `createInvoice` mutation used by the billing dashboard at `billing/dashboard.ts:88`," not "callers of this function").
- **Existing test evidence:**
  - `Regression gap`: what the relevant test actually asserts, with `file:line`; or, if none, the symbol/import-reference searches run and their result.
  - `Missing-adoption gap`: tests for the impacted site, and whether any assert it adopts the new behavior.
  - `Broken-verification gap`: the apparent test or verification path, and why it does not count.
- **Missing verification:** the precise assertion or check that's absent.
- **Demonstration:**
  - `Regression gap` / `Broken-verification gap`: the concrete regression that would ship undetected, and why the tests you checked would not fail.
  - `Missing-adoption gap`: the case the site mishandles by not adopting the new behavior, and that none of the tests you read assert adoption.
- **Consequence:** the concrete thing that ships wrong â€” a regression the checked evidence would not catch, or a site that should use the new behavior and doesn't.
- **Disposition:** `patch` â€” name the test to add, fit to the repo's own way of verifying (don't impose a generic test pyramid) â€” or `defer` when the gap is real but not worth closing as part of this change, with one sentence of why.
```

If you noticed genuine non-gap problems while tracing verification, append:

```markdown
## Other findings

- <description only; no severity, confidence, priority, or ranking>
```

When you find no verification gaps and no other findings, output exactly this single line, not an empty response:

`No verification gaps found.`

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is. If no content is supplied, or the file it points to is missing, empty, or unreadable, say exactly that and stop â€” never report a clean review for content you could not read.

</reviewer-instructions>

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

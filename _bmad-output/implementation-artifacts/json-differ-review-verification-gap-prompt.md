Read the following reviewer instructions completely and follow them:

--- REVIEWER INSTRUCTIONS ---
# Verification Gap Review

**Goal:** Find changed behavior that could break without reliable verification catching it. Ask one question — "if the behavior this change is supposed to produce broke where it's actually used, would verification fail?" Do not hunt for correctness bugs, but report genuine problems you notice while tracing verification.

The main verification gap shapes are:

1. **Regression gap:** the changed code regresses where it's used, and no test covering that use would fail.
2. **Missing-adoption gap:** a place that should now use the new behavior doesn't; it handles the same case its own way, or not at all, and no test would flag the omission.
3. **Broken-verification gap:** a test appears to cover the changed behavior, but would not actually protect it because it is skipped, flaky, not run in the normal verification path, or too weak to observe the regression.

## Evidence Rules

- Read a test before claiming what it covers, runs, asserts, or misses.
- Before claiming no test exists, search the whole repo by the symbol under test and by import references; expected file locations are not enough.
- Never assert what you did not verify. If a finding cannot be grounded, drop it.
- In a finding, say what you actually checked — "none of the tests I read cover this" — and show how far you looked. Say a test doesn't exist anywhere only when the symbol/import-reference search actually shows that.
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

A `Missing-adoption gap` qualifies not by the adoption failure alone but by a supersession signal: the change gives clear evidence the new behavior is meant to replace the local one — PR intent, naming or docs, a replaced sibling site, deleted duplicate logic, or a test defining the new rule — and the local site shares the same observable contract. Without a supersession signal and a shared observable contract, it is a refactor suggestion, not a verification-gap finding. Once both hold, check whether any test for that site would flag the non-adoption; missing coverage of the non-adoption is the gap itself, not a disqualifier.

Find and read the relevant test. Ask whether the Demonstration would make an assertion fail.

- If yes, the behavior is verified. No finding.
- For a regression-style Demonstration: if no test runs the path, the test is skipped/flaky/not run normally, or the test runs the code without checking the changed result, report a `Regression gap` or `Broken-verification gap`.
- For a qualifying Missing-adoption case: if none of the site tests you found assert it adopts the new behavior, report a `Missing-adoption gap`.

A test counts only if it runs normally and an assertion observes the changed output, branch, or contract. These do not count: no execution; source-text assertions that match a file's wording instead of running it; success/no-throw/snapshot-only checks; mock/log-call checks; human-only checks; tests that mock away the integration; e2e tests that pass through without checking the changed output; stale assertions or fixtures.

For example, `expect(x ?? DEFAULT).toBe(DEFAULT)` passes when `x` is missing.

Common patterns:

- **Caller-path gap** — helper test covers the branch, but caller values skip it.
- **Contract drift** — payload/schema/event changes must be verified at the consumer.
- **Migration compatibility** — tests only create new-format rows or fresh schemas.
- **Phantom exception** — handled partial-failure path has no test.
- **Missing-adoption gap** — sibling site should use the new rule/helper and does not.
- **Removed verification** — deleted test or weakened assertion leaves behavior unpinned; removing a source-text assertion is not this, since it never counted.

### Step 5: Confirm each finding is real

Before writing a finding, re-open the specific tests or search results the finding relies on. Verify the Demonstration would not make any test you checked fail, or that the absence claim is backed by the symbol/import-reference search. Do not claim more than you verified; drop any finding you cannot ground.

Explain why the test misses the bug using what the test sets up and checks.

Do not report: compiler/type-checker-enforced cases; behavior already verified by an integration, contract, or e2e test; implementation-detail or mock-only tests; low coverage or a missing test file by itself; legacy untested code the change did not affect.

Report genuine problems you noticed while tracing verification, even if they are not verification gaps. Put them under `Other findings` in the output. This permits reporting what you already reached, not extra hunting. A claim that code misbehaves is a defect, not a gap — it goes under `Other findings` for standard triage, however you found it.

## OUTPUT FORMAT

Emit each verification-gap finding as one block. No general advice, no severity or confidence. Triage trusts a gap finding as filed and does not re-verify it, so each block must stand on its own evidence.

```markdown
### <one-line title naming the gap>

- **Changed surface:** the exact behavior or contract that changed — `file:line`.
- **Impacted consumer or site:** named concretely with `file:line` (e.g. "the `createInvoice` mutation used by the billing dashboard at `billing/dashboard.ts:88`," not "callers of this function").
- **Existing test evidence:**
  - `Regression gap`: what the relevant test actually asserts, with `file:line`; or, if none, the symbol/import-reference searches run and their result.
  - `Missing-adoption gap`: tests for the impacted site, and whether any assert it adopts the new behavior.
  - `Broken-verification gap`: the apparent test or verification path, and why it does not count.
- **Missing verification:** the precise assertion or check that's absent.
- **Demonstration:**
  - `Regression gap` / `Broken-verification gap`: the concrete regression that would ship undetected, and why the tests you checked would not fail.
  - `Missing-adoption gap`: the case the site mishandles by not adopting the new behavior, and that none of the tests you read assert adoption.
- **Consequence:** the concrete thing that ships wrong — a regression the checked evidence would not catch, or a site that should use the new behavior and doesn't.
- **Disposition:** `patch` — name the test to add, fit to the repo's own way of verifying (don't impose a generic test pyramid) — or `defer` when the gap is real but not worth closing as part of this change, with one sentence of why.
```

If you noticed genuine non-gap problems while tracing verification, append:

```markdown
## Other findings

- <description only; no severity, confidence, priority, or ranking>
```

When you find no verification gaps and no other findings, output exactly this single line, not an empty response:

`No verification gaps found.`

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is. If no content is supplied, or the file it points to is missing, empty, or unreadable, say exactly that and stop — never report a clean review for content you could not read.

--- END REVIEWER INSTRUCTIONS ---

Review content: the unified diff is inlined below:

--- REVIEW CONTENT ---
﻿diff --git "a/C:\\Users\\federico.trotta_grup\\AppData\\Local\\Temp\\opencode\\json-differ-empty.txt" b/json-compare.js
index e69de29..4a0663a 100644
--- "a/C:\\Users\\federico.trotta_grup\\AppData\\Local\\Temp\\opencode\\json-differ-empty.txt"
+++ b/json-compare.js
@@ -0,0 +1,409 @@
+(function (root) {
+    'use strict';
+
+    const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
+    const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
+    const isContainer = value => Array.isArray(value) || isObject(value);
+
+    function structurallyEqual(left, right) {
+        if (Object.is(left, right)) return true;
+
+        if (Array.isArray(left) && Array.isArray(right)) {
+            return left.length === right.length
+                && left.every((value, index) => structurallyEqual(value, right[index]));
+        }
+
+        if (isObject(left) && isObject(right)) {
+            const leftKeys = Object.keys(left);
+            const rightKeys = Object.keys(right);
+            return leftKeys.length === rightKeys.length
+                && leftKeys.every(key => hasOwn(right, key) && structurallyEqual(left[key], right[key]));
+        }
+
+        return false;
+    }
+
+    function primitiveText(value) {
+        return JSON.stringify(value);
+    }
+
+    function propertyPrefix(key) {
+        return key === null ? '' : `${JSON.stringify(key)}: `;
+    }
+
+    function addComma(rows, side) {
+        for (let index = rows.length - 1; index >= 0; index--) {
+            const field = `${side}Content`;
+            if (rows[index][field] !== null) {
+                rows[index][field] += ',';
+                return;
+            }
+        }
+    }
+
+    function oneSidedRows(value, side, indent, key) {
+        const type = side === 'left' ? 'removed' : 'added';
+        const left = side === 'left';
+        const rows = [];
+        const push = content => rows.push({
+            type,
+            leftContent: left ? content : null,
+            rightContent: left ? null : content
+        });
+        const padding = '  '.repeat(indent);
+        const prefix = propertyPrefix(key);
+
+        if (!isContainer(value)) {
+            push(`${padding}${prefix}${primitiveText(value)}`);
+            return rows;
+        }
+
+        const opening = Array.isArray(value) ? '[' : '{';
+        const closing = Array.isArray(value) ? ']' : '}';
+        push(`${padding}${prefix}${opening}`);
+
+        const entries = Array.isArray(value)
+            ? value.map((child, index) => [null, child, index])
+            : Object.keys(value).map(childKey => [childKey, value[childKey], childKey]);
+
+        entries.forEach(([childKey, child], index) => {
+            const childRows = oneSidedRows(child, side, indent + 1, childKey);
+            if (index < entries.length - 1) addComma(childRows, side);
+            rows.push(...childRows);
+        });
+
+        push(`${padding}${closing}`);
+        return rows;
+    }
+
+    function replacementRows(left, right, indent, key) {
+        if (!isContainer(left) && !isContainer(right)) {
+            const padding = '  '.repeat(indent);
+            const prefix = propertyPrefix(key);
+            return [{
+                type: 'changed',
+                leftContent: `${padding}${prefix}${primitiveText(left)}`,
+                rightContent: `${padding}${prefix}${primitiveText(right)}`
+            }];
+        }
+
+        const leftRows = oneSidedRows(left, 'left', indent, key);
+        const rightRows = oneSidedRows(right, 'right', indent, key);
+        const length = Math.max(leftRows.length, rightRows.length);
+        const rows = [];
+
+        for (let index = 0; index < length; index++) {
+            rows.push({
+                type: 'changed',
+                leftContent: leftRows[index]?.leftContent ?? null,
+                rightContent: rightRows[index]?.rightContent ?? null
+            });
+        }
+        return rows;
+    }
+
+    function alignArray(left, right) {
+        const rows = left.length + 1;
+        const columns = right.length + 1;
+        const lcs = Array.from({ length: rows }, () => Array(columns).fill(0));
+
+        for (let i = left.length - 1; i >= 0; i--) {
+            for (let j = right.length - 1; j >= 0; j--) {
+                lcs[i][j] = structurallyEqual(left[i], right[j])
+                    ? lcs[i + 1][j + 1] + 1
+                    : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
+            }
+        }
+
+        const aligned = [];
+        let i = 0;
+        let j = 0;
+        let removed = [];
+        let added = [];
+
+        const flush = () => {
+            const paired = Math.min(removed.length, added.length);
+            for (let index = 0; index < paired; index++) {
+                aligned.push({ left: removed[index], right: added[index] });
+            }
+            for (let index = paired; index < removed.length; index++) {
+                aligned.push({ left: removed[index] });
+            }
+            for (let index = paired; index < added.length; index++) {
+                aligned.push({ right: added[index] });
+            }
+            removed = [];
+            added = [];
+        };
+
+        while (i < left.length || j < right.length) {
+            if (i < left.length && j < right.length && structurallyEqual(left[i], right[j])) {
+                flush();
+                aligned.push({ left: left[i], right: right[j] });
+                i++;
+                j++;
+            } else if (j < right.length && (i === left.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
+                added.push(right[j++]);
+            } else {
+                removed.push(left[i++]);
+            }
+        }
+        flush();
+        return aligned;
+    }
+
+    function compareNode(left, right, leftPresent, rightPresent, indent, key) {
+        if (!leftPresent) {
+            return { rows: oneSidedRows(right, 'right', indent, key), differenceCount: 1 };
+        }
+        if (!rightPresent) {
+            return { rows: oneSidedRows(left, 'left', indent, key), differenceCount: 1 };
+        }
+        if (structurallyEqual(left, right)) {
+            const rows = oneSidedRows(left, 'left', indent, key);
+            const rightRows = oneSidedRows(right, 'right', indent, key);
+            return {
+                rows: rows.map((row, index) => ({
+                    type: 'unchanged',
+                    leftContent: row.leftContent,
+                    rightContent: rightRows[index].rightContent
+                })),
+                differenceCount: 0
+            };
+        }
+
+        if (isObject(left) && isObject(right)) {
+            return compareObjects(left, right, indent, key);
+        }
+        if (Array.isArray(left) && Array.isArray(right)) {
+            return compareArrays(left, right, indent, key);
+        }
+        return { rows: replacementRows(left, right, indent, key), differenceCount: 1 };
+    }
+
+    function compareObjects(left, right, indent, key) {
+        const padding = '  '.repeat(indent);
+        const prefix = propertyPrefix(key);
+        const rows = [{
+            type: 'unchanged',
+            leftContent: `${padding}${prefix}{`,
+            rightContent: `${padding}${prefix}{`
+        }];
+        const keys = [...Object.keys(left), ...Object.keys(right).filter(childKey => !hasOwn(left, childKey))];
+        let differenceCount = 0;
+
+        keys.forEach((childKey, index) => {
+            const result = compareNode(
+                left[childKey],
+                right[childKey],
+                hasOwn(left, childKey),
+                hasOwn(right, childKey),
+                indent + 1,
+                childKey
+            );
+            const remainingKeys = keys.slice(index + 1);
+            if (hasOwn(left, childKey) && remainingKeys.some(nextKey => hasOwn(left, nextKey))) {
+                addComma(result.rows, 'left');
+            }
+            if (hasOwn(right, childKey) && remainingKeys.some(nextKey => hasOwn(right, nextKey))) {
+                addComma(result.rows, 'right');
+            }
+            rows.push(...result.rows);
+            differenceCount += result.differenceCount;
+        });
+
+        rows.push({ type: 'unchanged', leftContent: `${padding}}`, rightContent: `${padding}}` });
+        return { rows, differenceCount };
+    }
+
+    function compareArrays(left, right, indent, key) {
+        const padding = '  '.repeat(indent);
+        const prefix = propertyPrefix(key);
+        const rows = [{
+            type: 'unchanged',
+            leftContent: `${padding}${prefix}[`,
+            rightContent: `${padding}${prefix}[`
+        }];
+        const aligned = alignArray(left, right);
+        let differenceCount = 0;
+
+        aligned.forEach((item, index) => {
+            const leftPresent = hasOwn(item, 'left');
+            const rightPresent = hasOwn(item, 'right');
+            const result = compareNode(item.left, item.right, leftPresent, rightPresent, indent + 1, null);
+            const remainingItems = aligned.slice(index + 1);
+            if (leftPresent && remainingItems.some(nextItem => hasOwn(nextItem, 'left'))) {
+                addComma(result.rows, 'left');
+            }
+            if (rightPresent && remainingItems.some(nextItem => hasOwn(nextItem, 'right'))) {
+                addComma(result.rows, 'right');
+            }
+            rows.push(...result.rows);
+            differenceCount += result.differenceCount;
+        });
+
+        rows.push({ type: 'unchanged', leftContent: `${padding}]`, rightContent: `${padding}]` });
+        return { rows, differenceCount };
+    }
+
+    function numberRows(rows) {
+        let leftLine = 0;
+        let rightLine = 0;
+        return rows.map(row => ({
+            ...row,
+            leftLineNum: row.leftContent === null ? null : ++leftLine,
+            rightLineNum: row.rightContent === null ? null : ++rightLine
+        }));
+    }
+
+    const JsonDiffEngine = {
+        compare(left, right) {
+            const result = compareNode(left, right, true, true, 0, null);
+            return { rows: numberRows(result.rows), differenceCount: result.differenceCount };
+        },
+        parseAndCompare(leftText, rightText) {
+            return this.compare(JSON.parse(leftText), JSON.parse(rightText));
+        },
+        structurallyEqual
+    };
+
+    class JsonCompareUI {
+        constructor(id, opts = {}) {
+            this.initializeElements(id, opts);
+        }
+
+        initializeElements(id, { left = 'Left JSON', right = 'Right JSON' }) {
+            const container = document.querySelector(`.json-diff-container[data-id="${id}"]`);
+            if (!container) throw new Error(`JSON diff container "${id}" was not found`);
+
+            this.status = container.querySelector('.diff-status');
+            this.diffContent = container.querySelector('.diff-content');
+            this.diffView = container.querySelector('.diff-view');
+            this.leftLabel = container.querySelector('.diff-column.left-column');
+            this.rightLabel = container.querySelector('.diff-column.right-column');
+            this.showBtn = container.querySelector('.show-btn');
+            this.swapBtn = container.querySelector('.swap-btn');
+            this.labels = { left, right };
+            this.swapped = false;
+            this.hideUnchanged = false;
+            this.updateLabels();
+
+            this.showBtn.textContent = 'Mostra solo differenze';
+            this.showBtn.addEventListener('click', () => {
+                this.hideUnchanged = !this.hideUnchanged;
+                this.showBtn.textContent = this.hideUnchanged ? 'Mostra tutto' : 'Mostra solo differenze';
+                this.diffView.classList.toggle('hide-unchanged', this.hideUnchanged);
+            });
+
+            this.swapBtn.textContent = 'Scambia verso';
+            this.swapBtn.addEventListener('click', () => {
+                this.swapped = !this.swapped;
+                this.updateLabels();
+                if (this.leftText !== '' || this.rightText !== '') {
+                    const leftText = this.leftText;
+                    this.leftText = this.rightText;
+                    this.rightText = leftText;
+                    this.runDiff();
+                }
+            });
+
+            this.leftText = '';
+            this.rightText = '';
+        }
+
+        updateLabels() {
+            this.leftLabel.textContent = this.swapped ? this.labels.right : this.labels.left;
+            this.rightLabel.textContent = this.swapped ? this.labels.left : this.labels.right;
+        }
+
+        diff(left, right) {
+            this.leftText = left;
+            this.rightText = right;
+            this.runDiff();
+        }
+
+        runDiff() {
+            this.diffContent.textContent = '';
+            if (typeof this.leftText !== 'string' || this.leftText.trim() === ''
+                || typeof this.rightText !== 'string' || this.rightText.trim() === '') {
+                this.showStatus('Please provide JSON in both inputs', 'error');
+                return;
+            }
+
+            if (this.leftText.length > 100000 || this.rightText.length > 100000) {
+                this.showStatus('Large JSON detected. This may take some time...', 'warning');
+            }
+
+            let leftJson;
+            let rightJson;
+            try {
+                leftJson = JSON.parse(this.leftText);
+            } catch (error) {
+                this.showStatus('Invalid JSON in left input', 'error');
+                return;
+            }
+            try {
+                rightJson = JSON.parse(this.rightText);
+            } catch (error) {
+                this.showStatus('Invalid JSON in right input', 'error');
+                return;
+            }
+
+            try {
+                const result = JsonDiffEngine.compare(leftJson, rightJson);
+                result.rows.forEach(row => this.createDiffLine(
+                    row.leftLineNum,
+                    row.leftContent,
+                    row.rightLineNum,
+                    row.rightContent,
+                    row.type
+                ));
+                this.showStatus(
+                    result.differenceCount === 0
+                        ? 'Ô£à No differences found - JSON objects are identical'
+                        : `Found ${result.differenceCount} differences`,
+                    'success'
+                );
+            } catch (error) {
+                this.diffContent.textContent = '';
+                this.showStatus(`Comparison error: ${error.message}`, 'error');
+            }
+        }
+
+        createDiffLine(leftLineNum, leftContent, rightLineNum, rightContent, type) {
+            const diffLine = document.createElement('div');
+            diffLine.className = `diff-line ${type}`;
+
+            const leftNum = document.createElement('div');
+            leftNum.className = 'line-number';
+            leftNum.textContent = leftLineNum ?? '';
+
+            const leftDiv = document.createElement('div');
+            leftDiv.className = 'line-content';
+            leftDiv.textContent = leftContent ?? '';
+
+            const rightNum = document.createElement('div');
+            rightNum.className = 'line-number';
+            rightNum.textContent = rightLineNum ?? '';
+
+            const rightDiv = document.createElement('div');
+            rightDiv.className = 'line-content';
+            rightDiv.textContent = rightContent ?? '';
+
+            diffLine.append(leftNum, leftDiv, rightNum, rightDiv);
+            this.diffContent.appendChild(diffLine);
+        }
+
+        showStatus(message, type) {
+            this.status.textContent = message;
+            this.status.className = `diff-status status ${type}`;
+        }
+    }
+
+    root.JsonCompareUI = JsonCompareUI;
+    root.JsonDiffEngine = JsonDiffEngine;
+
+    if (typeof module !== 'undefined' && module.exports) {
+        module.exports = { JsonCompareUI, JsonDiffEngine };
+    }
+})(typeof window !== 'undefined' ? window : globalThis);
diff --git "a/C:\\Users\\federico.trotta_grup\\AppData\\Local\\Temp\\opencode\\json-differ-empty.txt" "b/test\\json-compare.test.js"
index e69de29..cf3253c 100644
--- "a/C:\\Users\\federico.trotta_grup\\AppData\\Local\\Temp\\opencode\\json-differ-empty.txt"
+++ "b/test\\json-compare.test.js"
@@ -0,0 +1,178 @@
+'use strict';
+
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const { JsonCompareUI, JsonDiffEngine } = require('../json-compare.js');
+
+function changedRows(result) {
+    return result.rows.filter(row => row.type === 'changed');
+}
+
+function createFakeDocument() {
+    class FakeElement {
+        constructor() {
+            this.children = [];
+            this.className = '';
+            this._textContent = '';
+            this.listeners = {};
+            this.classList = { toggle() {} };
+        }
+        set textContent(value) {
+            this._textContent = String(value);
+            if (value === '') this.children = [];
+        }
+        get textContent() { return this._textContent; }
+        append(...children) { this.children.push(...children); }
+        appendChild(child) { this.children.push(child); }
+        addEventListener(event, listener) { this.listeners[event] = listener; }
+    }
+
+    const selectors = Object.fromEntries([
+        '.diff-status', '.diff-content', '.diff-view',
+        '.diff-column.left-column', '.diff-column.right-column', '.show-btn', '.swap-btn'
+    ].map(selector => [selector, new FakeElement()]));
+    const container = { querySelector: selector => selectors[selector] };
+    return {
+        document: {
+            querySelector: selector => selector.includes('data-id="test"') ? container : null,
+            createElement: () => new FakeElement()
+        },
+        elements: selectors
+    };
+}
+
+test('pairs adjacent changed object properties by key', () => {
+    const result = JsonDiffEngine.compare(
+        { name: 'John', age: 30, city: 'New York' },
+        { name: 'Ema', age: 50, city: 'New York' }
+    );
+
+    assert.equal(result.differenceCount, 2);
+    assert.deepEqual(changedRows(result).map(row => [row.leftContent.trim(), row.rightContent.trim()]), [
+        ['"name": "John",', '"name": "Ema",'],
+        ['"age": 30,', '"age": 50,']
+    ]);
+    assert.ok(result.rows.some(row => row.type === 'unchanged'
+        && row.leftContent.includes('"city"') && row.rightContent.includes('"city"')));
+});
+
+test('renders added and removed object members without mispairing neighbors', () => {
+    const result = JsonDiffEngine.compare(
+        { retained: 1, removed: { nested: true }, tail: 3 },
+        { retained: 1, added: [2, 3], tail: 3 }
+    );
+
+    assert.equal(result.differenceCount, 2);
+    assert.ok(result.rows.some(row => row.type === 'removed' && row.leftContent.includes('"removed"')));
+    assert.ok(result.rows.some(row => row.type === 'added' && row.rightContent.includes('"added"')));
+    assert.ok(result.rows.some(row => row.type === 'unchanged' && row.leftContent.includes('"tail"')));
+});
+
+test('compares nested object descendants structurally', () => {
+    const result = JsonDiffEngine.compare(
+        { account: { active: true, profile: { name: 'A' } } },
+        { account: { active: false, profile: { name: 'B', level: 2 } } }
+    );
+
+    assert.equal(result.differenceCount, 3);
+    assert.ok(changedRows(result).some(row => row.leftContent.includes('"active"')));
+    assert.ok(changedRows(result).some(row => row.leftContent.includes('"name"')));
+    assert.ok(result.rows.some(row => row.type === 'added' && row.rightContent.includes('"level"')));
+});
+
+test('aligns array insertions and removals to stable elements', () => {
+    const inserted = JsonDiffEngine.compare([1, 3, 4], [1, 2, 3, 4]);
+    assert.equal(inserted.differenceCount, 1);
+    assert.equal(inserted.rows.filter(row => row.type === 'added').length, 1);
+    assert.ok(inserted.rows.some(row => row.type === 'unchanged'
+        && row.leftContent.trim().startsWith('3') && row.rightContent.trim().startsWith('3')));
+
+    const removed = JsonDiffEngine.compare(['a', 'b', 'c'], ['a', 'c']);
+    assert.equal(removed.differenceCount, 1);
+    assert.equal(removed.rows.filter(row => row.type === 'removed').length, 1);
+});
+
+test('pairs an array replacement as one change', () => {
+    const result = JsonDiffEngine.compare([1, { id: 2 }, 3], [1, { id: 9 }, 3]);
+    assert.equal(result.differenceCount, 1);
+    assert.ok(changedRows(result).some(row => row.leftContent.includes('"id": 2')));
+    assert.ok(result.rows.some(row => row.type === 'unchanged'
+        && row.leftContent.trim() === '3' && row.rightContent.trim() === '3'));
+});
+
+test('ignores object property order at every depth', () => {
+    const result = JsonDiffEngine.compare(
+        { first: 1, nested: { a: true, b: false } },
+        { nested: { b: false, a: true }, first: 1 }
+    );
+    assert.equal(result.differenceCount, 0);
+    assert.ok(result.rows.every(row => row.type === 'unchanged'));
+});
+
+test('supports primitive roots and JSON type changes', () => {
+    assert.equal(JsonDiffEngine.compare(null, null).differenceCount, 0);
+    assert.equal(JsonDiffEngine.compare(false, true).differenceCount, 1);
+    assert.equal(JsonDiffEngine.compare('1', 1).differenceCount, 1);
+    assert.deepEqual(
+        changedRows(JsonDiffEngine.compare('old', 'new'))[0],
+        {
+            type: 'changed',
+            leftContent: '"old"',
+            rightContent: '"new"',
+            leftLineNum: 1,
+            rightLineNum: 1
+        }
+    );
+});
+
+test('formats multi-line additions and removals as complete subtrees', () => {
+    const result = JsonDiffEngine.compare({}, { config: { values: [1, 2] } });
+    assert.equal(result.differenceCount, 1);
+    const rightText = result.rows.map(row => row.rightContent).filter(value => value !== null).join('\n');
+    assert.deepEqual(JSON.parse(rightText), { config: { values: [1, 2] } });
+});
+
+test('produces valid JSON in both displayed columns', () => {
+    const result = JsonDiffEngine.compare(
+        { keep: 1, remove: [1, 2], end: true },
+        { add: { x: null }, keep: 1, end: false }
+    );
+    const leftText = result.rows.map(row => row.leftContent).filter(value => value !== null).join('\n');
+    const rightText = result.rows.map(row => row.rightContent).filter(value => value !== null).join('\n');
+    assert.deepEqual(JSON.parse(leftText), { keep: 1, remove: [1, 2], end: true });
+    assert.deepEqual(JSON.parse(rightText), { keep: 1, end: false, add: { x: null } });
+});
+
+test('parseAndCompare rejects invalid and empty JSON text', () => {
+    assert.throws(() => JsonDiffEngine.parseAndCompare('', '{}'), SyntaxError);
+    assert.throws(() => JsonDiffEngine.parseAndCompare('{}', '{broken'), SyntaxError);
+});
+
+test('browser UI remains constructible and clears stale rows for invalid inputs', () => {
+    const originalDocument = global.document;
+    const fake = createFakeDocument();
+    global.document = fake.document;
+    try {
+        const ui = new JsonCompareUI('test', { left: 'Before', right: 'After' });
+        ui.diff('{"value":1}', '{"value":2}');
+        assert.ok(fake.elements['.diff-content'].children.length > 0);
+        assert.equal(fake.elements['.diff-status'].textContent, 'Found 1 differences');
+
+        ui.diff('{broken', '{}');
+        assert.equal(fake.elements['.diff-content'].children.length, 0);
+        assert.equal(fake.elements['.diff-status'].textContent, 'Invalid JSON in left input');
+
+        ui.diff('{}', '');
+        assert.equal(fake.elements['.diff-content'].children.length, 0);
+        assert.equal(fake.elements['.diff-status'].textContent, 'Please provide JSON in both inputs');
+        assert.equal(global.JsonCompareUI, JsonCompareUI);
+    } finally {
+        global.document = originalDocument;
+    }
+});
+
+test('is deterministic across repeated runs', () => {
+    const left = { items: [{ id: 1 }, { id: 2 }], enabled: true };
+    const right = { enabled: false, items: [{ id: 0 }, { id: 1 }, { id: 2 }] };
+    assert.deepEqual(JsonDiffEngine.compare(left, right), JsonDiffEngine.compare(left, right));
+});
diff --git "a/C:\\Users\\federico.trotta_grup\\AppData\\Local\\Temp\\opencode\\json-differ-empty.txt" b/package.json
index e69de29..fd44879 100644
--- "a/C:\\Users\\federico.trotta_grup\\AppData\\Local\\Temp\\opencode\\json-differ-empty.txt"
+++ b/package.json
@@ -0,0 +1,8 @@
+{
+  "name": "json-diff-standalone",
+  "version": "1.0.0",
+  "private": true,
+  "scripts": {
+    "test": "node --test"
+  }
+}
diff --git "a/C:\\Users\\federico.trotta_grup\\AppData\\Local\\Temp\\opencode\\json-differ-empty.txt" b/index.html
index e69de29..1a14d8f 100644
--- "a/C:\\Users\\federico.trotta_grup\\AppData\\Local\\Temp\\opencode\\json-differ-empty.txt"
+++ b/index.html
@@ -0,0 +1,41 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+    <meta charset="UTF-8">
+    <meta name="viewport" content="width=device-width, initial-scale=1.0">
+    <title>Document</title>
+    <link rel="stylesheet" href="./json-diff.css">
+</head>
+<body>
+    <div class="json-diff-container" data-id="test">
+        <div class="actions">
+            <button class="show-btn"></button>
+            <button class="swap-btn"></button>
+            <span class="diff-status status"></span>
+        </div>
+        <div class="diff-view">
+            <div class="diff-header">
+                <div class="diff-column left-column"></div>
+                <div class="diff-column right-column"></div>
+            </div>
+            <div class="diff-content"></div>
+        </div>
+    </div>
+
+    <script src="./json-compare.js"></script>
+    <script>
+        window.onload = function() {
+            const jsonCompareUI = new JsonCompareUI('test', { left: 'Left JSON', right: 'Right JSON' });
+            jsonCompareUI.diff(`{
+  "name": "John",
+  "age": 30,
+  "city": "New York"
+}`, `{
+  "name": "Ema",
+  "age": 50,
+  "city": "New York"
+}`);
+        };
+    </script>
+</body>
+</html>

--- END REVIEW CONTENT ---


Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

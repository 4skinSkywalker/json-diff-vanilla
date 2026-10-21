Read the following reviewer instructions completely and follow them as your review instructions.

# Edge Case Hunter Review

**Goal:** You are a pure path tracer. Never comment on whether code is good or bad; only list missing handling.
When a diff is provided, scan only the diff hunks and list boundaries that are directly reachable from the changed lines and lack an explicit guard in the diff.
When no diff is provided (full file or function), treat the entire provided content as the scope.
Ignore the rest of the codebase unless the provided content explicitly references external functions.
A brief secondary deletion check runs as Step 4 when the diff removes code.
A claims check runs as Step 5.

**Inputs:**
- **content** — Content to review, or a path to read it from: diff, full file, or function
- **also_consider** (optional) — Areas to keep in mind during review alongside normal edge-case analysis
- **claims_file** — Path to the spec this change was built from. Do NOT read it before Step 5: the path tracing in Steps 2–3 must finish before the claims are seen.

**MANDATORY: Execute steps in the Execution section IN EXACT ORDER. DO NOT skip steps or change the sequence. When a halt condition triggers, follow its specific instruction exactly. Each action within a step is a REQUIRED action to complete that step.**

**Your method is exhaustive path enumeration — mechanically walk every branch, not hunt by intuition. Report ONLY paths and conditions that lack handling — discard handled ones silently. Do NOT editorialize or add filler. Do not assign severity labels, rankings, or priority levels.**


## EXECUTION

### Step 1: Receive Content

- Take the content to review from the parent message that launched you — inline, or by reading the file it points to (never from this instruction file)
- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
- Identify content type (diff, full file, or function) to determine scope rules

### Step 2: Exhaustive Path Analysis

**Walk every branching path and boundary condition within scope — report only unhandled ones.**

- If `also_consider` input was provided, incorporate those areas into the analysis
- Walk all branching paths: control flow (conditionals, loops, error handlers, early returns) and domain boundaries (where values, states, or conditions transition). Derive the relevant edge classes from the content itself — don't rely on a fixed checklist. Examples: missing else/default, unguarded inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Consider implicit branches: the diff special-cases or changes the handling of one or more members of a fixed set of values — enums, status codes, sentinels, type tags, flags, value ranges. The rest of the set is implicit branches (e.g. the diff changes the `RED` and `YELLOW` cases of a `RED`/`YELLOW`/`GREEN` enum; `GREEN` is the implicit branch)
- Consider handle lifetime: when the changed code re-checks, re-fetches, or re-validates something it already held — a handle, index, id, pointer — the re-check exists because an intervening call can invalidate it. Identify that call, what it does to the thing held, and what the changed code silently skips when the re-check fails
- For each call site the diff adds or changes — in test files as well as production code — read the callee's declaration and check the call against it: argument count, order, types, and defaults. Report any mismatch
- For each path: determine whether the content handles it
- Collect only the unhandled paths as findings — discard handled ones silently

### Step 3: Validate Completeness

- Revisit every edge class from Step 2 — e.g., missing else/default, null/empty inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
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

- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
<reference path="references/deletion-check.md">
# Deletion Check

Secondary pass for the Edge Case Hunter — runs only when the diff removed meaningful code. Subordinate to the edge-case pass; findings are usually few or none.

For each chunk of removed or replaced code (ignore pure renames and whitespace), ask: did it carry behavior or a contract that the change neither re-established nor intentionally retired? Add a finding for any resulting regression, orphaned reference, or newly-dead code. Skip anything already covered by your edge-case findings.

Append each finding to the same JSON array as the edge-case findings, with the four standard fields plus:

- `kind`: `"deletion"`
- `confidence`: `"high"`, `"medium"`, or `"low"` — these are inferences; rate them

For a deletion finding the standard fields read as: `location` = the removed item; `trigger_condition` = the behavior or contract it enforced; `guard_snippet` = where or how to re-establish it; `potential_consequence` = the regression or orphan.

Add nothing if nothing qualifies.
</reference>
<reference path="references/claims-check.md">
# Claims Check

Final pass for the Edge Case Hunter. Read the claims file named in the message that launched you now, for the first time; the path tracing is finished and the claims cannot steer it retroactively.

It is the spec the change was built from. Read only its `## Intent` and `## Tasks & Acceptance` sections — the claims live there; ignore the rest of the file. The spec is the change's own account of itself: testimony, not evidence — a claim repeated in a code comment is still the same claim, not confirmation. Extract each checkable claim — what the change does, what it preserves, ordering, arithmetic, and parity with existing code ("exactly as X does") — then try to falsify each one against the code you have already traced. Where your trace is not enough to decide, read the code that decides it: the compared-to function, the actual callee, the state the claim assumes.

Append one finding per falsified claim to the same JSON array, with the four standard fields plus:

- `kind`: `"claim"`
- `confidence`: `"high"`, `"medium"`, or `"low"`

For a claim finding the standard fields read as: `location` = where the code contradicts the claim; `trigger_condition` = the claim, quoted or tightly paraphrased; `guard_snippet` = what the code actually does; `potential_consequence` = what goes wrong for someone who believed the claim.

Verified claims produce nothing. Add nothing if nothing is falsified.
</reference>

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is.


claims_file (leave unread until your instructions call for it) follows inline:

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


Review content: the unified diff follows inline. It is the content under review.

diff --git a/.gitignore b/.gitignore
index cac6a65..00eef00 100644
--- a/.gitignore
+++ b/.gitignore
@@ -8,3 +8,6 @@ docs
 package-lock.json
 git-info*.json
 /.project
+/_bmad*
+/.agents
+/.opencode
\ No newline at end of file
diff --git a/packages/uci/index.ts b/packages/uci/index.ts
index 040bd6f..a5d5ffa 100644
--- a/packages/uci/index.ts
+++ b/packages/uci/index.ts
@@ -19,6 +19,7 @@ import {
 	Loader,
 	LoaderInline,
 	Grid,
+	Griddone,
 	Table,
 	Scroll,
 	Stepper,
@@ -63,6 +64,7 @@ export const widgets = {
 	Modal,
 	Table,
 	Grid,
+	Griddone,
 	Loader,
 	LoaderInline,
 	Text,
@@ -88,4 +90,4 @@ export const widgets = {
 export { h } from "../atmfe-ui-utils";
 export * from "./src/";
 
-export { getWidgetRevision } from "./revision";
\ No newline at end of file
+export { getWidgetRevision } from "./revision";
diff --git a/packages/uci/src/index.ts b/packages/uci/src/index.ts
index 7fb6c56..2033646 100644
--- a/packages/uci/src/index.ts
+++ b/packages/uci/src/index.ts
@@ -19,6 +19,7 @@ export { List, type Props as ListProps } from "./List/list";
 export { Loader, type Props as LoaderProps } from "./Loader/loader";
 export { LoaderInline, type Props as LoaderInlineProps } from "./Loader-inline/loader-inline";
 export { Grid, type Props as GridProps } from "./Grid/grid";
+export { Griddone, type Props as GriddoneProps } from "./Griddone/griddone";
 export { Table, type Props as TableProps } from "./Table/table";
 export { Scroll } from "./Scroll/scroll";
 export { Stepper, type Props as StepperProps } from "./Stepper/stepper";
diff --git a/e2e/griddone.spec.ts b/e2e/griddone.spec.ts
new file mode 100644
index 0000000..8cbb434
--- /dev/null
+++ b/e2e/griddone.spec.ts
@@ -0,0 +1,81 @@
+import { test, expect } from "@playwright/test";
+
+test.describe("Griddone", () => {
+	test.beforeEach(async ({ page }) => {
+		await page.setViewportSize({ width: 1024, height: 768 });
+		await page.goto("http://localhost:5173/#e2e/test");
+		await page.waitForSelector("#target", { state: "attached" });
+		await page.evaluate(() => {
+			$("#loader").trigger(":clear");
+			$("main").trigger("engine:spawnWidget", [
+				{
+					id: "griddone-test-root",
+					tag: "Flex",
+					direction: "vertical",
+					children: [
+						{
+							id: "configured-grid",
+							tag: "Griddone",
+							class: "caller-grid",
+							"aria-label": "Configured grid",
+							columns: 2,
+							rows: "40px 60px",
+							gap: "md",
+							flow: "column dense",
+							align: "center",
+							justify: "end",
+							inline: true,
+							children: [
+								{ id: "grid-child-1", tag: "Text", content: "First" },
+								{ id: "grid-child-2", tag: "Text", content: "Second" },
+							],
+						},
+						{
+							id: "default-grid",
+							tag: "Griddone",
+							columns: 0,
+							gap: "invalid",
+							flow: "invalid",
+							align: "invalid",
+							justify: "invalid",
+						},
+					],
+				},
+				"target",
+			]);
+		});
+		await page.waitForSelector("#configured-grid", { state: "attached" });
+		await page.waitForSelector("#default-grid", { state: "attached" });
+	});
+
+	test("renders configured layout, children, and caller attributes", async ({ page }) => {
+		const grid = page.locator("#configured-grid");
+
+		await expect(grid).toHaveClass(/caller-grid/);
+		await expect(grid).toHaveAttribute("aria-label", "Configured grid");
+		expect(await grid.evaluate((element) => (element as HTMLElement).style.display)).toBe("inline-grid");
+		expect(await grid.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns))
+			.toBe("repeat(2, minmax(0px, 1fr))");
+		await expect(grid).toHaveCSS("grid-auto-flow", "column dense");
+		await expect(grid).toHaveCSS("align-items", "center");
+		await expect(grid).toHaveCSS("justify-items", "end");
+		await expect(grid).toHaveCSS("gap", "16px");
+		await expect(grid).toHaveCSS("grid-template-rows", "40px 60px");
+		await expect(grid.locator(":scope > *")).toHaveCount(2);
+		await expect(grid.locator(":scope > *").nth(0)).toHaveText("First");
+		await expect(grid.locator(":scope > *").nth(1)).toHaveText("Second");
+	});
+
+	test("uses safe defaults and supports an empty child list", async ({ page }) => {
+		const grid = page.locator("#default-grid");
+
+		await expect(grid).toHaveCSS("display", "grid");
+		await expect(grid).toHaveCSS("grid-auto-flow", "row");
+		await expect(grid).toHaveCSS("align-items", "stretch");
+		await expect(grid).toHaveCSS("justify-items", "stretch");
+		await expect(grid).toHaveCSS("gap", "0px");
+		await expect(grid.locator(":scope > *")).toHaveCount(0);
+		expect(await grid.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns))
+			.toBe("minmax(0px, 1fr)");
+	});
+});
diff --git a/packages/uci/src/Griddone/griddone.tsx b/packages/uci/src/Griddone/griddone.tsx
new file mode 100644
index 0000000..62c963b
--- /dev/null
+++ b/packages/uci/src/Griddone/griddone.tsx
@@ -0,0 +1,85 @@
+/** @jsx h */
+import { h, cn } from "../../../atmfe-ui-utils";
+import { CustomWidget, type WidgetSpec } from "atmfe-ui-renderer";
+import css from "./griddone.module.scss";
+
+type Gap = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
+type Flow = "row" | "column" | "row dense" | "column dense";
+type Placement = "start" | "center" | "end" | "stretch";
+
+export interface Props {
+	columns?: number | string;
+	rows?: string;
+	gap?: Gap;
+	flow?: Flow;
+	align?: Placement;
+	justify?: Placement;
+	inline?: boolean;
+	children?: WidgetSpec[];
+	style?: Record<string, string | number>;
+}
+
+const GAP_VALUES: Record<Gap, string> = {
+	none: "0",
+	xs: ".25rem",
+	sm: ".5rem",
+	md: "1rem",
+	lg: "2rem",
+	xl: "2.5rem",
+	"2xl": "4rem",
+	"3xl": "6rem",
+};
+
+const FLOWS: Flow[] = ["row", "column", "row dense", "column dense"];
+const PLACEMENTS: Placement[] = ["start", "center", "end", "stretch"];
+
+/**
+ * A JSON-configurable CSS Grid container for arbitrary child widgets.
+ * Numeric columns create equal-width tracks; string columns and rows accept
+ * CSS grid-template syntax.
+ */
+export class Griddone extends CustomWidget<Partial<Props>> {
+	private columns() {
+		if (typeof this.spec.columns === "number") {
+			return this.spec.columns > 0
+				? `repeat(${this.spec.columns}, minmax(0, 1fr))`
+				: "minmax(0, 1fr)";
+		}
+
+		return this.spec.columns?.trim() || "minmax(0, 1fr)";
+	}
+
+	private enumOrDefault<T extends string>(value: T | undefined, values: T[], fallback: T) {
+		return value && values.includes(value) ? value : fallback;
+	}
+
+	render() {
+		const gap = this.enumOrDefault(this.spec.gap, Object.keys(GAP_VALUES) as Gap[], "none");
+		const flow = this.enumOrDefault(this.spec.flow, FLOWS, "row");
+		const align = this.enumOrDefault(this.spec.align, PLACEMENTS, "stretch");
+		const justify = this.enumOrDefault(this.spec.justify, PLACEMENTS, "stretch");
+		const style: Record<string, string | number> = {
+			...this.spec.style,
+			display: this.spec.inline ? "inline-grid" : "grid",
+			"grid-template-columns": this.columns(),
+			"grid-auto-flow": flow,
+			"align-items": align,
+			"justify-items": justify,
+			gap: GAP_VALUES[gap],
+		};
+
+		if (this.spec.rows?.trim()) {
+			style["grid-template-rows"] = this.spec.rows;
+		}
+
+		return (
+			<div
+				{...this.spec}
+				class={cn([css.root, this.spec.class])}
+				style={style}
+			>
+				{this.children?.map((child) => child.node)}
+			</div>
+		);
+	}
+}
diff --git a/packages/uci/src/Griddone/griddone.module.scss b/packages/uci/src/Griddone/griddone.module.scss
new file mode 100644
index 0000000..53e39e1
--- /dev/null
+++ b/packages/uci/src/Griddone/griddone.module.scss
@@ -0,0 +1,7 @@
+.root {
+	display: grid;
+}
+
+.root[inline] {
+	display: inline-grid;
+}


Do not invoke any skill, and do not spawn subagents of your own � you are the reviewer. If the instruction file is unreadable, report that exact failure and stop. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

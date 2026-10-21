Read the following reviewer instructions completely and follow them as your review instructions.

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

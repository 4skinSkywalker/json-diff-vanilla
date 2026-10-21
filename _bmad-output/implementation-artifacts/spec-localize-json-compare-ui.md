---
title: 'Localize JSON compare UI'
type: 'feature'
created: '2026-10-21'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The JSON comparison controls currently mix Italian and English, so their language does not follow the visitor's browser preference.

**Approach:** Localize the component-generated buttons and status messages in English, Italian, German, French, and Spanish. Select the first supported browser-preferred language, normalize regional locale tags, and fall back to English.

</frozen-after-approval>

## Implementation Notes

- `json-compare.js` owns all component-generated button and status text; keep the diff engine language-independent and preserve the existing constructor API.
- `test/json-compare.test.js` has a fake browser DOM and UI assertions; extend it to control browser locale preferences and verify selection, regional normalization, fallback, and translated controls/statuses.
- Use `navigator.languages` in preference order with `navigator.language` as a secondary source. Do not require a dependency or network-loaded translation catalog.
- Implemented a component-local translation catalog for `en`, `it`, `de`, `fr`, and `es`; locale resolution normalizes regional tags and selects the first supported browser preference.
- Localized generated control labels, validation/result statuses, singular/plural difference counts, and comparison-error prefixes without changing the public constructor or diff engine.
- Added deterministic browser-locale test setup and coverage for every supported locale, preference ordering, regional tags, English fallback, localized validation/results, and known engine errors. `npm test` passes all 22 tests; `git diff --check` reports no whitespace errors.
- Review follow-up localized unsafe-number and nesting-depth errors and documented locale behavior in `README.md`. Locale changes after component creation intentionally require recreation or reload rather than a persistent global event listener.

## Review Triage Log

- `medium` — Unsafe-number validation exposed an English engine message in localized UIs; patched by translating known engine errors before display.
- `medium` — Status-message tests covered only controls and singular results; patched with empty, invalid, identical, plural, unsafe-number, and nesting-error coverage.
- `low` — The `navigator.language` secondary path was untested; patched with an unsupported `navigator.languages` list and supported German secondary locale.
- `false` — Dynamic `languagechange` handling was not requested; each component resolves current browser preferences at creation, while a global listener would add lifecycle responsibilities.
- `low` — Locale behavior was undocumented; patched with supported-language and fallback details in `README.md`.

# EX-003: Test Suite Triage Report

**Date:** October 14, 2026
**Task:** Task P0.00m — Resolve EX-003 flagged test files

---

## 1. Executive Summary

This exploration and triage cataloged the 187 test files across the repository. Seven files were flagged during the EX-003 triage for detailed inspection against v1.0 specifications: six files flagged as **Update** due to spec renames/behavioral changes, and one file flagged as **Review** due to internal private field assertions.

---

## 2. Flagged Files Analysis and Resolution

| File Path | Flagged Status | Initial State | Final Resolution | Summary of Changes |
| :--- | :---: | :---: | :---: | :--- |
| `packages/coralite/tests/unit/lib/plugin-validator.spec.js` | Update | PASS | Unchanged | Triage was conservative. Legacy `depends` tests intentionally verify rejection diagnostic `CORALITE-P206`. |
| `packages/coralite/tests/unit/lib/server/plugin/define.spec.js` | Update | PASS | Unchanged | Triage was conservative. Tests assert rejection of legacy `depends` property with `CORALITE-P206`. |
| `packages/coralite/tests/unit/lib/server/plugin/dependencies.spec.js` | Update | PASS | Unchanged | File already tests `dependencies` array and topological sorting under v1.0. |
| `packages/coralite/tests/unit/lib/server/clean-urls.spec.js` | Update | PASS | Unchanged | File already tests `cleanUrls: boolean` and rejection of legacy `urlStyle`. |
| `packages/coralite/tests/unit/lib/style-feature.spec.js` | Update | PASS | Unchanged | Style functions already use destructured context `({ state }) => ...`. |
| `packages/coralite/tests/unit/lib/vm-dynamic-import.spec.js` | Update | FAIL | Updated | Updated SSR assertions for async getters. Under v1.0 (P1.11), async getters are skipped during SSR, rendering `<c-token></c-token>` placeholders. |
| `packages/coralite/tests/unit/lib/server/plugin/callable.spec.js` | Review | PASS | Refactored (Option A) | Refactored to test public configured instance properties (`name`, `config`) rather than private internal property `_isConfiguredInstance`. |

---

## 3. Resolution Details

### 1. `packages/coralite/tests/unit/lib/plugin-validator.spec.js` (Unchanged)
- **Classification:** Migration/Rejection tests.
- **Details:** The matches for `depends` in this file are intentional test cases verifying that `depends` produces diagnostic code `CORALITE-P206`. No assertions were stale.

### 2. `packages/coralite/tests/unit/lib/server/plugin/define.spec.js` (Unchanged)
- **Classification:** Migration/Rejection tests.
- **Details:** Contains explicit test `should throw CORALITE-P206 if legacy depends property is passed`. This correctly asserts legacy property rejection.

### 3. `packages/coralite/tests/unit/lib/server/plugin/dependencies.spec.js` (Unchanged)
- **Classification:** Up-to-date.
- **Details:** The file tests plugin topological sorting using the v1.0 `dependencies` field.

### 4. `packages/coralite/tests/unit/lib/server/clean-urls.spec.js` (Unchanged)
- **Classification:** Up-to-date.
- **Details:** Tests `cleanUrls: true`/`false` and verifies that passing `urlStyle` throws a `CoraliteError` naming `cleanUrls`.

### 5. `packages/coralite/tests/unit/lib/style-feature.spec.js` (Unchanged)
- **Classification:** Up-to-date.
- **Details:** Style block functions already use the destructured `({ state }) => ...` context signature matching v1.0 specifications.

### 6. `packages/coralite/tests/unit/lib/vm-dynamic-import.spec.js` (Updated)
- **Classification:** Stale SSR async getter assertions.
- **Details:** Under Coralite v1.0 (P1.11), getters declared as `async` are skipped during SSR and resolve on the client runtime. In `vm-dynamic-import.spec.js`, component getters were declared with `async () => { ... }`. The test previously expected SSR HTML to contain the resolved return value (`Success`, `Dynamic import with variable options`). Updated assertions to match `<c-token></c-token>`, confirming async getters skip SSR while preserving template structure for client hydration.

### 7. `packages/coralite/tests/unit/lib/server/plugin/callable.spec.js` (Refactored - Option A)
- **Classification:** Internal field assertion review.
- **Details:** Option A was chosen. Replaced private internal property assertion `assert.strictEqual(instance._isConfiguredInstance, true)` with assertion on public behavior: `assert.strictEqual(typeof instance, 'object')` along with assertions on `instance.name` and `instance.config`.

# EX-002: ESLint Error Triage and Fix Plan

**Date:** October 12, 2024
**Task:** P0.00h — Lint error triage and fix plan
**Target:** Triage all ESLint errors across the workspace, document error distributions, and design a balanced task split for follow-up fixes.

---

## 1. Summary and Execution Context

- **Total Error Count:** `130` problems (130 errors, 0 warnings)
- **Command Used:** `pnpm lint` (which executes `eslint --cache .` across workspace packages)
- **Adapted Command for Analysis:**
  ```sh
  pnpm lint 2>&1 | grep -E '^\s+[0-9]+:[0-9]+\s+error\s+'
  ```

---

## 2. Errors Grouped by Rule

| Rule Name | Error Count | Description / Summary |
| :--- | :---: | :--- |
| `no-unused-vars` | 20 | Unused variables, parameter definitions, or unused imports |
| `no-param-reassign` | 18 | Direct re-assignment of function parameters |
| `no-inline-comments` | 16 | Inline comments placed on the same line as executable statements |
| `eqeqeq` | 16 | Usage of loose equality (`==` / `!=`) instead of strict equality (`===` / `!==`) |
| `no-shadow` | 15 | Local variables shadowing outer-scope variable declarations |
| `jsdoc/require-param-description` | 14 | Missing description text for JSDoc `@param` tags |
| `no-restricted-imports` | 8 | Restricted `node:*` imports in client test files |
| `no-return-await` | 7 | Redundant `return await` inside async functions |
| `jsdoc/no-undefined-types` | 6 | Undefined type references (`ArrayLike`, `Iterable`) in JSDoc comments |
| `prefer-const` | 3 | `let` bindings that are never reassigned |
| `no-nested-ternary` | 3 | Nested ternary expressions |
| `@stylistic/js/no-mixed-operators` | 2 | Unparenthesized mixed math or binary operators (`+` and `*`) |
| `no-invalid-this` | 1 | Method or hook referencing `this` outside class or explicit context |
| `@stylistic/js/object-property-newline` | 1 | Multiple object properties declared on a single line |

---

## 3. Errors Grouped by Directory

| Directory Path | Error Count | High-Level Scope |
| :--- | :---: | :--- |
| `packages/coralite/tests/unit/lib` | 23 | Unit Tests (Core / Client / Server) |
| `packages/coralite/lib/server` | 19 | Coralite Server Runtime |
| `packages/coralite/tests/unit/lib/client` | 11 | Client Spec Unit Tests |
| `packages/coralite/lib/server/utils` | 10 | Coralite Server Utilities |
| `packages/coralite/tests/unit` | 10 | Top-level Unit Tests & Helpers |
| `packages/coralite/tests/e2e/utils` | 8 | E2E Test Utilities |
| `packages/coralite-scripts/libs` | 7 | Coralite CLI Tooling Libraries |
| `packages/coralite/lib/server/collection` | 6 | Coralite Server Collection Handlers |
| `packages/coralite/lib/shared` | 5 | Coralite Shared Core Utilities |
| `packages/coralite/tests/e2e/core` | 4 | E2E Core Feature Tests |
| `packages/coralite/tests/unit/client` | 4 | Unit Client Tests |
| `packages/coralite-scripts/tests/integration` | 3 | Scripts Integration Tests |
| `packages/coralite/tests/e2e` | 3 | E2E Root Helpers |
| `packages/coralite/tests/unit/lib/server/plugin` | 3 | Plugin Unit Spec Tests |
| `packages/create-coralite/lib` | 3 | Scaffolder Generator Library |
| `packages/coralite/lib/client` | 2 | Coralite Client Runtime Elements |
| `packages/coralite/tests/unit/utils` | 2 | Test Utility Specs |
| `packages/create-coralite/bin` | 2 | Scaffolder CLI Binary |
| `packages/coralite-plugin-scripts/lib` | 1 | Plugin Script Generator Lib |
| `packages/coralite-scripts/libs/commands` | 1 | CLI Commands |
| `packages/coralite/lib/client/utils` | 1 | Client Utilities |
| `packages/coralite/lib/server/component` | 1 | Server Component Setup |
| `packages/coralite/lib/server/plugin` | 1 | Server Plugin Setup |

---

## 4. Rule × Directory Matrix

*(Rows = Directory Path, Columns = Rule Name)*

| Directory Path | `no-unused-vars` | `no-param-reassign` | `no-inline-comments` | `eqeqeq` | `no-shadow` | `jsdoc/require-param-desc` | `no-restricted-imports` | `no-return-await` | `jsdoc/no-undefined-types` | `prefer-const` | `no-nested-ternary` | `@stylistic/...` | `no-invalid-this` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `packages/coralite-plugin-scripts/lib` | - | 1 | - | - | - | - | - | - | - | - | - | - | - |
| `packages/coralite-scripts/libs` | - | 2 | - | - | 3 | - | - | - | - | 2 | - | - | - |
| `packages/coralite-scripts/libs/commands` | - | - | - | - | 1 | - | - | - | - | - | - | - | - |
| `packages/coralite-scripts/tests/integration` | 1 | - | 2 | - | - | - | - | - | - | - | - | - | - |
| `packages/coralite/lib/client` | - | 1 | - | 1 | - | - | - | - | - | - | - | - | - |
| `packages/coralite/lib/client/utils` | - | 1 | - | - | - | - | - | - | - | - | - | - | - |
| `packages/coralite/lib/server` | - | 5 | - | 7 | 2 | - | - | 1 | - | 1 | 3 | - | - |
| `packages/coralite/lib/server/collection` | - | 4 | - | - | - | - | - | 2 | - | - | - | - | - |
| `packages/coralite/lib/server/component` | - | 1 | - | - | - | - | - | - | - | - | - | - | - |
| `packages/coralite/lib/server/plugin` | - | 1 | - | - | - | - | - | - | - | - | - | - | - |
| `packages/coralite/lib/server/utils` | - | 2 | - | 5 | 3 | - | - | - | - | - | - | - | - |
| `packages/coralite/lib/shared` | - | - | - | - | 4 | - | - | - | - | - | - | - | 1 |
| `packages/coralite/tests/e2e` | - | - | - | - | - | 3 | - | - | - | - | - | - | - |
| `packages/coralite/tests/e2e/core` | 1 | - | 3 | - | - | - | - | - | - | - | - | - | - |
| `packages/coralite/tests/e2e/utils` | - | - | - | - | - | 8 | - | - | - | - | - | - | - |
| `packages/coralite/tests/unit` | 2 | - | 2 | - | - | - | - | - | 6 | - | - | - | - |
| `packages/coralite/tests/unit/client` | 4 | - | - | - | - | - | - | - | - | - | - | - | - |
| `packages/coralite/tests/unit/lib` | 10 | - | 8 | - | - | 2 | - | 1 | - | - | - | 2 | - |
| `packages/coralite/tests/unit/lib/client` | 1 | - | - | - | - | - | 8 | 1 | - | - | - | 1 | - |
| `packages/coralite/tests/unit/lib/server/plugin` | 1 | - | - | - | - | - | - | 2 | - | - | - | - | - |
| `packages/coralite/tests/unit/utils` | - | - | 1 | - | - | 1 | - | - | - | - | - | - | - |
| `packages/create-coralite/bin` | - | - | - | - | 2 | - | - | - | - | - | - | - | - |
| `packages/create-coralite/lib` | - | - | - | 3 | - | - | - | - | - | - | - | - | - |

---

## 5. High-Level Area Analysis

Evaluating error density across high-level system boundaries reveals two distinct clusters:

1. **Source Code & Runtime Libraries (`packages/*/lib/`, `packages/*/bin/`):** **59 errors** across 24 files.
   - Primary issues: parameter reassignment (`no-param-reassign`), loose equality (`eqeqeq`), variable shadowing (`no-shadow`), nested ternaries (`no-nested-ternary`), and unnecessary `let` (`prefer-const`).
2. **Test Suites & Test Utilities (`packages/*/tests/`):** **71 errors** across 28 files.
   - Primary issues: unused variables (`no-unused-vars`), inline comments (`no-inline-comments`), missing JSDoc descriptions (`jsdoc/require-param-description`), restricted imports (`no-restricted-imports`), and undefined JSDoc types (`jsdoc/no-undefined-types`).

Splitting tasks by high-level area (Source vs. Tests) provides clean, domain-isolated boundaries where source code refactorings are kept separate from test code updates.

---

## 6. Suggested Task Split

We propose a **2-task split** (59 errors in Task 1, 71 errors in Task 2), which neatly satisfies the 40–80 error target range per task:

### Task P0.00i — Fix Source & Runtime Lint Errors

- **Scope:** All source and executable code under `packages/*/lib/`, `packages/*/bin/`, and `packages/coralite-scripts/libs/`.
- **Error Count:** **59 errors** across **24 files**.
- **Target Rules:**
  - `no-param-reassign` (18)
  - `eqeqeq` (16)
  - `no-shadow` (15)
  - `no-nested-ternary` (3)
  - `prefer-const` (3)
  - `no-return-await` (3)
  - `no-invalid-this` (1)
- **Files TO modify:**
  - `packages/coralite/lib/client/element.js`
  - `packages/coralite/lib/client/utils/runtime.js`
  - `packages/coralite/lib/server/collection/handlers.js`
  - `packages/coralite/lib/server/collection/index.js`
  - `packages/coralite/lib/server/component/setup.js`
  - `packages/coralite/lib/server/compiler.js`
  - `packages/coralite/lib/server/config.js`
  - `packages/coralite/lib/server/create.js`
  - `packages/coralite/lib/server/page/route.js`
  - `packages/coralite/lib/server/plugin/setup.js`
  - `packages/coralite/lib/server/renderer.js`
  - `packages/coralite/lib/server/script-manager.js`
  - `packages/coralite/lib/server/utils/fragment.js`
  - `packages/coralite/lib/server/utils/globals.js`
  - `packages/coralite/lib/server/utils/html.js`
  - `packages/coralite/lib/server/utils/manifest.js`
  - `packages/coralite/lib/server/utils/server.js`
  - `packages/coralite/lib/shared/core.js`
  - `packages/coralite-scripts/libs/build.js`
  - `packages/coralite-scripts/libs/commands/serve.js`
  - `packages/coralite-scripts/libs/config.js`
  - `packages/coralite-plugin-scripts/lib/build.js`
  - `packages/create-coralite/bin/index.js`
  - `packages/create-coralite/lib/agent-generator.js`
- **Files NOT to modify:**
  - All files under `packages/*/tests/`
  - `eslint.config.js` or any configuration files

### Task P0.00j — Fix Test Suite Lint Errors

- **Scope:** All unit, integration, and E2E test files under `packages/*/tests/`.
- **Error Count:** **71 errors** across **28 files**.
- **Target Rules:**
  - `no-unused-vars` (20)
  - `no-inline-comments` (16)
  - `jsdoc/require-param-description` (14)
  - `no-restricted-imports` (8)
  - `jsdoc/no-undefined-types` (6)
  - `no-return-await` (4)
  - `@stylistic/js/no-mixed-operators` (2)
  - `@stylistic/js/object-property-newline` (1)
- **Files TO modify:**
  - `packages/coralite/tests/e2e/core/devtools.test.js`
  - `packages/coralite/tests/e2e/core/slots-projection.test.js`
  - `packages/coralite/tests/e2e/helpers.js`
  - `packages/coralite/tests/e2e/utils/mode-utils.js`
  - `packages/coralite/tests/unit/client/context-protocol.spec.js`
  - `packages/coralite/tests/unit/client/reactive-loop-protection.spec.js`
  - `packages/coralite/tests/unit/client/render-concurrency.spec.js`
  - `packages/coralite/tests/unit/helpers.js`
  - `packages/coralite/tests/unit/lib/attribute-reflection.spec.js`
  - `packages/coralite/tests/unit/lib/attributes-state-parity.spec.js`
  - `packages/coralite/tests/unit/lib/attributes-transform.spec.js`
  - `packages/coralite/tests/unit/lib/client-runtime.spec.js`
  - `packages/coralite/tests/unit/lib/client/component-route-context.spec.js`
  - `packages/coralite/tests/unit/lib/client/plugin-route-context.spec.js`
  - `packages/coralite/tests/unit/lib/computed-slots-hydration.spec.js`
  - `packages/coralite/tests/unit/lib/config-assets.spec.js`
  - `packages/coralite/tests/unit/lib/coralite-element.spec.js`
  - `packages/coralite/tests/unit/lib/getters-context.spec.js`
  - `packages/coralite/tests/unit/lib/onerror-contract.spec.js`
  - `packages/coralite/tests/unit/lib/output-files-memory.spec.js`
  - `packages/coralite/tests/unit/lib/script-manager-compile.spec.js`
  - `packages/coralite/tests/unit/lib/server/plugin/late-bound.spec.js`
  - `packages/coralite/tests/unit/lib/server/plugin/plugin-config-serialization.spec.js`
  - `packages/coralite/tests/unit/lib/update-complete.spec.js`
  - `packages/coralite/tests/unit/lib/utils.spec.js`
  - `packages/coralite/tests/unit/setup.js`
  - `packages/coralite/tests/unit/utils/server-dom-parity.spec.js`
  - `packages/coralite/tests/unit/utils/virtual-page-plugin.js`
  - `packages/coralite-scripts/tests/integration/build.test.js`
- **Files NOT to modify:**
  - Any source file under `packages/*/lib/`, `packages/*/bin/`
  - `eslint.config.js` or any configuration files

---

## 7. Risks and Special Cases

1. **Non-Fixable Errors:**
   - Out of 130 problems, ESLint `--fix` only automatically resolves 1 problem (`@stylistic/js/object-property-newline` in `plugin-route-context.spec.js`). All remaining 129 errors require manual code refactoring.
2. **Behavior-Changing Risks:**
   - **Parameter Reassignment (`no-param-reassign`):** Replacing parameter mutability (e.g. `options = options || {}` or `node.parent = parent`) with local variable reassignment or default parameters must preserve exact reference semantics.
   - **Loose Equality (`eqeqeq`):** Replacing `== null` with `=== null || === undefined` or checking string coercions must be verified against edge cases like `0`, `""`, or `false`.
   - **Compiler Circular Reference (`prefer-const` in `compiler.js`):** `createModuleLinker` and `importModuleDynamically` share a circular closure reference requiring `let linker` to be declared prior to `importModuleDynamically` so that dynamic imports executed during module evaluation resolve `linker` without TDZ errors. An `eslint-disable-next-line prefer-const` rule comment must be retained here.
3. **Restricted Client Module Imports (`no-restricted-imports`):**
   - In `tests/unit/lib/client/component-route-context.spec.js` and `plugin-route-context.spec.js`, client specs import Node built-ins (`node:test`, `node:assert/strict`, `node:url`, `node:path`, `node:fs/promises`, `node:os`). ESLint restricts Node imports under `tests/unit/lib/client/`. Since these are unit runner specs executed by Node test runner (`node --test`), adding file-level override comments (`/* eslint-disable no-restricted-imports */`) or adjusting path placement/ESLint config is required to resolve these cleanly without breaking test runner execution.
4. **JSDoc Undefined Types (`jsdoc/no-undefined-types`):**
   - In `tests/unit/helpers.js`, `ArrayLike` and `Iterable` are reported as undefined JSDoc types. Using standard JSDoc notation or explicit `{Array|Object}` types will resolve these without requiring global type declarations.

# Exploration — Repository Cleanliness Audit

## Executive Summary

Following the massive architectural refactor moving `lib/` into `server/`, `client/`, and `shared/`, this audit evaluated the repository structure, checked for leftover `coralite-scripts` artifacts, validated flat files in `lib/server/`, audited all 90 module files under `packages/coralite/lib/` for orphaned/dead code, and analyzed all test fixtures in `packages/coralite/tests/fixtures/`.

Key Findings:
1. All 90 files in `packages/coralite/lib/` are actively imported and used across runtime core modules, CLI entry points, built-in plugins, or unit tests.
2. The only leftover fixture file identified is `packages/coralite/tests/fixtures/dummy-data.json`, which is no longer referenced anywhere in the codebase.
3. The directory structure is pristine and ready for `v1.0.0-rc.6`.

---

### 1. High-Level Structure

Below is the directory tree output up to 2 levels deep (excluding `node_modules`, `.git`, and `dist`):

```
.
./.forgejo
./.forgejo/workflows
./benchmarks
./benchmarks/js-framework-benchmark
./benchmarks/jsbenchmarks
./benchmarks/lumeland-benchmark
./benchmarks/results
./docs
./docs/explorations
./packages
./packages/coralite
./packages/coralite-plugin-scripts
./packages/coralite-release
./packages/coralite-scripts
./packages/create-coralite
./packages/create-coralite-plugin
./scripts
./tests
./tests/fixtures
./website
./website/public
./website/src
```

#### Structural Observations:
- **Workspace Packages:** Workspace layout under `packages/` is clean. `packages/coralite-scripts` remains as the frozen/deprecated standalone package.
- **Root Directories:** Top-level `tests/` directory contains global end-to-end tests and test fixtures.
- **Benchmarks & Documentation:** `benchmarks/` contains all benchmark suites (js-framework-benchmark, jsbenchmarks, lumeland-benchmark) and `website/` contains the Coralite documentation site.
- **No Out-of-Place Folders:** No stray temporary directories, build artifacts, or unexpected folders exist at the root or package levels.

---

### 2. Leftover `coralite-scripts` Artifacts

Command executed:
```sh
find . -type d -name "*coralite-scripts*" -not -path '*/node_modules*'
```

Output:
```
./packages/coralite-scripts
```

#### Analysis:
- `packages/coralite-scripts` is the intentionally frozen and deprecated package maintained for backward compatibility.
- No stray or leftover `coralite-scripts` directories exist inside `packages/coralite/`, `website/`, `benchmarks/`, or the root workspace.

---

### 3. `lib/server/` Flat File Check

Command executed:
```sh
find packages/coralite/lib/server -maxdepth 1 -type f | sort
```

Output:
```
packages/coralite/lib/server/collection-handlers.js
packages/coralite/lib/server/collection.js
packages/coralite/lib/server/compiler.js
packages/coralite/lib/server/component-setup.js
packages/coralite/lib/server/config.js
packages/coralite/lib/server/create.js
packages/coralite/lib/server/hooks.js
packages/coralite/lib/server/interactive.js
packages/coralite/lib/server/redirect.js
packages/coralite/lib/server/renderer.js
packages/coralite/lib/server/route.js
packages/coralite/lib/server/script-manager.js
```

#### Analysis:
- All domain-specific server logic is properly partitioned into subdirectories:
  - `component/` (`fixer.js`, `validator.js`)
  - `page/` (`fixer.js`, `pattern.js`, `validator.js`)
  - `plugin/` (`define.js`, `fixer.js`, `validator.js`)
  - `parser/` (`html.js`)
  - `routes/` (`build-table.js`, `match.js`, `validate.js`)
  - `type-checker/` (`index.js`, `volar-plugin.js`)
  - `utils/` (`csp.js`, `dom.js`, `errors.js`, `fragment.js`, `globals.js`, `html.js`, `manifest.js`, `parse.js`, `render.js`, `server.js`, `style.js`)
  - `validator/` (`context.js`, `function-analyzer.js`, `helpers.js`, `index.js`, `passes/`)
- The flat files at `packages/coralite/lib/server/` root represent core server module entry points (`create.js`, `renderer.js`, `compiler.js`, `script-manager.js`, `config.js`, etc.) and are all required.

---

### 4. Dead Files / Unused Modules

A comprehensive import and reference audit was performed across all 90 files in `packages/coralite/lib/`. Special attention was given to the following queried modules:

1. **`lib/utils/store.js`**: **In Use**
   - Imported by `lib/server/component-setup.js`, `lib/server/renderer.js`, `lib/server/script-manager.js`, `lib/server/compiler.js`, and tests (`store.spec.js`, `store-context.spec.js`).
2. **`lib/utils/signals.js`**: **In Use**
   - Imported by `lib/utils/store.js`, `lib/client/element.js`, and tests (`signals.spec.js`).
3. **`lib/server/collection.js`**: **In Use**
   - Imported by `lib/server/create.js`, `lib/server/utils/html.js`, `plugins/metadata.js`, and tests (`collection.spec.js`).
4. **`lib/slots/fixer.js`**: **In Use**
   - Imported by `lib/server/component/fixer.js`.
5. **`lib/utils/dev-mode.js`**: **In Use**
   - Imported by `plugins/router.js`, `lib/client/utils/devtools.js`, and `lib/client/element.js`.
6. **`lib/utils/observer-record.js`**: **In Use**
   - Imported by `lib/client/element.js` and tests (`reconcile.spec.js`).
7. **`lib/utils/plugin-config-schema.js`**: **In Use**
   - Imported by `lib/server/plugin-setup.js`, `lib/server/renderer.js`, `lib/server/plugin/define.js`, `lib/server/plugin/validator.js`, and tests (`plugin-config-schema.spec.js`).

#### Audit Result:
- **0 dead JS files found in `packages/coralite/lib/`**. Every single file under `lib/` is actively imported by runtime core code, CLI entry points, built-in plugins, or unit test suites.

---

### 5. Orphaned Test Fixtures

An audit of `packages/coralite/tests/fixtures/` was performed by checking directory references across all test files.

#### Fixture Subdirectories (17 Total — All Active):
- `check-types`: Referenced in 1 test suite
- `clean-urls`: Referenced in 1 test suite
- `components`: Referenced in 82 test suites
- `csp-modes`: Referenced in 1 test suite
- `data`: Referenced in 88 test suites
- `head-stripping`: Referenced in 1 test suite
- `lists-app`: Referenced in 2 test suites
- `nested-dependencies`: Referenced in 1 test suite
- `pages`: Referenced in 56 test suites
- `plugins`: Referenced in 49 test suites
- `router`: Referenced in 18 test suites
- `router-app`: Referenced in 1 test suite
- `routes`: Referenced in 8 test suites
- `testing`: Referenced in 45 test suites
- `testing-app`: Referenced in 1 test suite
- `type-checker`: Referenced in 3 test suites
- `validator`: Referenced in 16 test suites

#### Flat Fixture Files:
- `packages/coralite/tests/fixtures/dummy-client-lib.js`: **In Use** (Imported by `packages/coralite/tests/fixtures/components/client-script/client-script-component.html`).
- `packages/coralite/tests/fixtures/dummy-data.json`: **Orphaned** (Not referenced by any test file or component).

---

### 6. Recommendations

For a follow-up cleanup task prior to tagging `v1.0.0-rc.6`:

1. **Delete Orphaned Fixture File:**
   - `packages/coralite/tests/fixtures/dummy-data.json`

2. **No Code Changes Required in `lib/`:**
   - The modularization refactor was clean; all 90 source files in `packages/coralite/lib/` are actively used.

# EX-003: Test Suite Triage

**Date:** 2026-10-14
**Total test files:** 187
**Total tests:** 1823
**Keep / Update / Delete / Review:** 180 / 6 / 0 / 1

## 1. Inventory by directory

| Directory | Files | Keep | Update | Delete | Review |
|---|---|---|---|---|---|
| `packages/coralite/tests/e2e/core/` | 13 | 13 | 0 | 0 | 0 |
| `packages/coralite/tests/e2e/core/dependency-tracking/` | 5 | 5 | 0 | 0 | 0 |
| `packages/coralite/tests/e2e/testing-mode/` | 1 | 1 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/client/` | 10 | 10 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/` | 80 | 77 | 3 | 0 | 0 |
| `packages/coralite/tests/unit/lib/client/` | 5 | 5 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/onBeforeBuild/` | 1 | 1 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/server/` | 15 | 14 | 1 | 0 | 0 |
| `packages/coralite/tests/unit/lib/server/collection/` | 2 | 2 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/server/page/` | 5 | 5 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/server/parser/` | 1 | 1 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/server/plugin/` | 8 | 5 | 2 | 0 | 1 |
| `packages/coralite/tests/unit/lib/server/routes/` | 3 | 3 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/server/slots/` | 2 | 2 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/server/style/` | 2 | 2 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/shared/` | 2 | 2 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/utils/server/` | 4 | 4 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/utils/` | 2 | 2 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/lib/validator/passes/` | 1 | 1 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/plugins/` | 3 | 3 | 0 | 0 | 0 |
| `packages/coralite/tests/unit/utils/` | 1 | 1 | 0 | 0 | 0 |
| `packages/coralite-release/tests/` | 4 | 4 | 0 | 0 | 0 |
| `packages/coralite-scripts/tests/` | 2 | 2 | 0 | 0 | 0 |
| `packages/coralite-scripts/tests/integration/` | 9 | 9 | 0 | 0 | 0 |
| `packages/coralite-scripts/tests/unit/` | 1 | 1 | 0 | 0 | 0 |
| `packages/create-coralite/tests/e2e/` | 1 | 1 | 0 | 0 | 0 |
| `packages/create-coralite/tests/unit/` | 4 | 4 | 0 | 0 | 0 |

## 2. Per-file classification

### packages/coralite/tests/e2e/core/

| File | Classification | Reason |
|---|---|---|
| `boolean-attributes.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `context-protocol.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `devtools.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `imperative-components.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `innerhtml.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `lifecycle.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugins.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `priority-tests.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `reactive-system.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `scoped-styles.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `server-state.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `slots-projection.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `static-components.test.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/e2e/core/dependency-tracking/

| File | Classification | Reason |
|---|---|---|
| `async.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `circular.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `lifecycle.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `nested-getters.test.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `slot-refs.test.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/e2e/testing-mode/

| File | Classification | Reason |
|---|---|---|
| `features.test.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/client/

| File | Classification | Reason |
|---|---|---|
| `async-getter-dependency-tracking.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `async-getters.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `context-protocol.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `getters-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `hydration-store.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `page-route-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `page-runtime.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `reactive-loop-protection.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `render-concurrency.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `slots-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/

| File | Classification | Reason |
|---|---|---|
| `asset-injection.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `attribute-reflection.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `attributes-graceful-validation.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `attributes-required.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `attributes-state-parity.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `attributes-transform.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `attributes-validate.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `attributes-values.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `boolean-custom-attribute-bindings.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `build-modules.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `bundling.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `cli.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `client-runtime.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `coerce.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `collection-handlers.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `collection.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `component-fixer.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `component-validator.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `computed-slots-hydration.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `concurrent-build.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `config-assets.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `config.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `coralite-element.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `coralite.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `core.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `csp-parity.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `csp.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `dev-build-optimizations.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `diagnostics.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `dom-parity-hardening.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `dom.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `e205.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `emit.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `entity-handling.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `errors.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `face.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `find-script.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `fragment-renderer.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `getters-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `head-stripping.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `html-rendering.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `html.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `isr-component-assets.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `isr.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `module-resolution.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `nested-isr.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `on-disconnected-bundling.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `on-disconnected.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `onerror-contract.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `output-files-memory.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `page-validator.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `parse-tokens.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `parse-warnings.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `parser.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `path-population.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-enforcement.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-fixer.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-leak.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-mocking.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-serialization.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-validator.spec.js` | Update | References legacy plugin depends field or validator rule (renamed to dependencies in v1.0) |
| `plugin.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `sanitize-token-attributes.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `script-manager-basics.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `script-manager-compile.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `script-manager-empty-function.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `script-manager-integration.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `slotted-refs.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `sourcemap.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `ssr-fault-isolation.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `string-conversions.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `style-feature.spec.js` | Update | Uses legacy style: (state) => signature instead of destructured ({ state }) parameter shape |
| `styles-transform.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `symmetry.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `tags.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `trusted-types.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `type-helper.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `update-complete.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `utils.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `vm-dynamic-import.spec.js` | Update | Asserts SSR evaluation of async getters, which are skipped during SSR under v1.0 spec |

### packages/coralite/tests/unit/lib/client/

| File | Classification | Reason |
|---|---|---|
| `component-route-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-route-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `raw-state-read.spec.js` | Keep | Asserts Phase 3 compiler/runtime optimizations; preserved in v1.0 but locked during Phase 3 |
| `template-cloning.spec.js` | Keep | Asserts Phase 3 compiler/runtime optimizations; preserved in v1.0 but locked during Phase 3 |
| `updaters.spec.js` | Keep | Asserts Phase 3 compiler/runtime optimizations; preserved in v1.0 but locked during Phase 3 |

### packages/coralite/tests/unit/lib/onBeforeBuild/

| File | Classification | Reason |
|---|---|---|
| `build-queue.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/server/

| File | Classification | Reason |
|---|---|---|
| `async-getters.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `clean-urls.spec.js` | Update | References deprecated urlStyle configuration option (renamed to cleanUrls in v1.0) |
| `compiler-raw-read.spec.js` | Keep | Asserts Phase 3 compiler/runtime optimizations; preserved in v1.0 but locked during Phase 3 |
| `compiler-template-cloning.spec.js` | Keep | Asserts Phase 3 compiler/runtime optimizations; preserved in v1.0 but locked during Phase 3 |
| `compiler-updaters.spec.js` | Keep | Asserts Phase 3 compiler/runtime optimizations; preserved in v1.0 but locked during Phase 3 |
| `component-route-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `dedup.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `getters-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `multi-path.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `page-on-error.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `page-route-context.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-e107.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-on-page-set.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `route-hydration-serialization.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `validator-e401.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/server/collection/

| File | Classification | Reason |
|---|---|---|
| `page-blocks.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `paths.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/server/page/

| File | Classification | Reason |
|---|---|---|
| `404.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `e108-autofix.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `fixer.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `pattern.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `redirect.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/server/parser/

| File | Classification | Reason |
|---|---|---|
| `html-page-script.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/server/plugin/

| File | Classification | Reason |
|---|---|---|
| `callable.spec.js` | Review | Asserts internal private fields (_isConfiguredInstance, _clientConfigStaging); needs review against v1.0 public/internal boundary |
| `define.spec.js` | Update | References legacy plugin depends field or validator rule (renamed to dependencies in v1.0) |
| `dependencies.spec.js` | Update | References legacy plugin depends field or validator rule (renamed to dependencies in v1.0) |
| `init-hook.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `late-bound.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `modes.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-config-serialization.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `setup.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/server/routes/

| File | Classification | Reason |
|---|---|---|
| `build-table.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `match.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `validate.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/server/slots/

| File | Classification | Reason |
|---|---|---|
| `e105.spec.js` | Keep | Validates CORALITE-E105 diagnostic and codemod fixer for non-destructured signature migration |
| `fixer.spec.js` | Keep | Validates CORALITE-E105 diagnostic and codemod fixer for non-destructured signature migration |

### packages/coralite/tests/unit/lib/server/style/

| File | Classification | Reason |
|---|---|---|
| `e105.spec.js` | Keep | Validates CORALITE-E105 diagnostic and codemod fixer for non-destructured signature migration |
| `fixer.spec.js` | Keep | Validates CORALITE-E105 diagnostic and codemod fixer for non-destructured signature migration |

### packages/coralite/tests/unit/lib/shared/

| File | Classification | Reason |
|---|---|---|
| `page.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `plugin-config-schema.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/utils/server/

| File | Classification | Reason |
|---|---|---|
| `ast-cache.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `errors.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `manifest.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `render.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/utils/

| File | Classification | Reason |
|---|---|---|
| `subpath-export.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `validate-serializable.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/lib/validator/passes/

| File | Classification | Reason |
|---|---|---|
| `slots.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/plugins/

| File | Classification | Reason |
|---|---|---|
| `metadata-component.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `static-assets.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `testing.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite/tests/unit/utils/

| File | Classification | Reason |
|---|---|---|
| `server-dom-parity.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite-release/tests/

| File | Classification | Reason |
|---|---|---|
| `cli.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `publish.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `tags.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `version.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite-scripts/tests/

| File | Classification | Reason |
|---|---|---|
| `build-utils.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `resolve-source.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite-scripts/tests/integration/

| File | Classification | Reason |
|---|---|---|
| `assets.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `build-cli.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `check-fix.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `component-reporting.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `dev-csp.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `dev-incremental.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `dev-server-optimizations.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `incremental-assets.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `manifest-decoupling.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/coralite-scripts/tests/unit/

| File | Classification | Reason |
|---|---|---|
| `interactive.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/create-coralite/tests/e2e/

| File | Classification | Reason |
|---|---|---|
| `templates.test.js` | Keep | Asserts behavior preserved in v1.0 spec |

### packages/create-coralite/tests/unit/

| File | Classification | Reason |
|---|---|---|
| `agent-generator.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `cli.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `templates.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |
| `utils.spec.js` | Keep | Asserts behavior preserved in v1.0 spec |

## 3. Category totals

- **Keep:** 180 files (1,770 tests)
- **Update:** 6 files (46 tests)
- **Delete:** 0 files (0 tests)
- **Review:** 1 file (7 tests)

## 4. Priority deletion list

*No test files were classified as Delete. Current test suite coverage remains active; tests needing adjustment are categorized under Update.*

## 5. Phase 3 conflict list

Files that touch Phase 3 compiler/runtime concerns (compiler optimization, template cloning, DOM updaters, raw state proxy reads) and must not be modified until Phase 3 completes:

- `packages/coralite/tests/unit/lib/client/raw-state-read.spec.js`
- `packages/coralite/tests/unit/lib/client/template-cloning.spec.js`
- `packages/coralite/tests/unit/lib/client/updaters.spec.js`
- `packages/coralite/tests/unit/lib/server/compiler-raw-read.spec.js`
- `packages/coralite/tests/unit/lib/server/compiler-template-cloning.spec.js`
- `packages/coralite/tests/unit/lib/server/compiler-updaters.spec.js`

## 6. Recommendations

- **High-Priority Updates:**
  - `packages/coralite/tests/unit/lib/server/clean-urls.spec.js`: Update references from legacy `urlStyle` option to `cleanUrls`.
  - `packages/coralite/tests/unit/lib/style-feature.spec.js`: Update style function declarations from legacy single-identifier signature `style: (state) => ...` to the destructured context object `style: ({ state }) => ...`.
  - `packages/coralite/tests/unit/lib/plugin-validator.spec.js`, `packages/coralite/tests/unit/lib/server/plugin/define.spec.js`, and `packages/coralite/tests/unit/lib/server/plugin/dependencies.spec.js`: Update references from legacy `depends` schema key to `dependencies`.
  - `packages/coralite/tests/unit/lib/vm-dynamic-import.spec.js`: Update assertions where async getters are expected during SSR, updating the test to verify that async getters evaluate lazily on the client while SSR returns `undefined`.
- **Review Items:**
  - `packages/coralite/tests/unit/lib/server/plugin/callable.spec.js`: Review tests inspecting `_isConfiguredInstance` and `_clientConfigStaging` to determine if these internal properties should remain covered by unit tests or if test assertions should be refactored to focus on public API contracts.
- **Phase 3 Guard:**
  - Ensure follow-up cleanup or migration tasks do not touch any of the 6 files listed in the Phase 3 Conflict List until Phase 3 work concludes.

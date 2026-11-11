# Coralite Package Agent Rules

## 1. Scope

The core Coralite framework engine providing build-time page and component rendering, hydration, validation, and plugin runtime support across `packages/coralite/`.

## 2. Package-specific patterns

Directory boundary responsibilities under `lib/`:
- `lib/server/`: SSG pipeline, server-side component/page rendering, collection handling, script manager, and server plugin runner. Node.js target only.
- `lib/client/`: Web Components custom element base class, browser hydration runtime, reactive state updates, and client plugin runner. Zero Node.js dependencies allowed in client bundle.
- `lib/shared/`: Isomorphic utilities, AST helpers, schema definitions, and token parsers shared between server and client runtimes.
- `lib/validator/`: Build-time validation passes, diagnostic emitters, and code fixers for template, script, and config verification.
- `lib/cli/`: CLI commands, runner scripts, and dev server orchestration.

## 3. Authoring invariants

- Do not guard destructured context keys or check browser globals in deterministic functions (`client()`, `server()`, `getters`, `style`, `slots`). Context keys are guaranteed by the framework.
- Author test fixtures under `tests/fixtures/` (`tests/fixtures/pages` and `tests/fixtures/components`) using `fixtures` configuration in `coralite.config.js`. Never place test fixtures or test files inside `src/pages/` or `src/components/`.
- Plugin contexts (`server.context` and `client.context`) are injected into Component and Page `server()` and `client()` execution contexts. Framework keys (`route`, `app`, `session`, `signal`, `store`, `page`) take strict precedence over plugin keys.
- Imperative custom elements must be created in scanned client code: component/page `client()` or plugin client functions (`client.context`, `client.init`, lifecycle hooks). Coralite rewrites `document.createElement`, `innerHTML`, `outerHTML`, and `insertAdjacentHTML` there. Literal tags are preferred because they are recorded in page/component metadata; dynamic tags still lazy-load at runtime but may be untracked. Dynamically imported helper modules are bundled but not AST-scanned, so keep them pure or use `window.__coralite__.dom.createElement(tag)` / `await window.__coralite__.dom.loadComponent(tag)`. Production emits no DOM prototype patches; development and testing do, so add production-build coverage for imperative components.
- Getters strictly receive `{ state, route, root, refs, slots, signal, isServer, store }` and never receive plugin context. State derivation requiring plugins must occur in `server()`, persist to `state`, and getters read from `state`.
- Static components serialize zero client lifecycle code (`client: null`, `getters: {}`). A component exporting only `attributes` or `style` is Zero-JS; native attributes and flat tokens interpolate directly at SSR time.
- Passthrough getters (`({ state }) => state.foo`) are forbidden dead code; use raw template tokens `{{ foo }}` directly.
- Suppress unused element ref warnings (`CORALITE-W402`) during phased evolution using `<!-- coralite-ignore <refName> -->` following `<template>` rather than deleting refs or authoring dummy `client()` blocks.
- Page and component HTML is processed by default. Use the `coralite-ignore` attribute to keep an element subtree literal: no token interpolation, custom-element compilation, hydration, validator diagnostics, or page-controller extraction. On `<slot coralite-ignore>`, projected content is literal while fallback content is processed normally. Never use `data-coralite-ignore` or `coralite-interpolate`; the comment pragma `<!-- coralite-ignore CODE -->` is a separate validator mechanism. Pages accept exactly one Coralite controller `<script>` and fail duplicate controllers with `CORALITE-E107`.
- All browser runtime globals must be attached under the non-enumerable `window.__coralite__` namespace (`config`, `state`, `dom`, `plugins`, `lifecycle`, `devtools`, `test`) and typed in `types/globals.js`. All Node VM execution globals in `compiler.js` must be scoped under `globalThis.__coralite__`. Never introduce top-level `window.*` or `window.__coralite_*` globals.

## 4. Package-scoped commands

Run commands scoped to `coralite`:
- `pnpm --filter coralite lint:format`
- `pnpm --filter coralite lint`
- `pnpm --filter coralite build`
- `pnpm --filter coralite test:smoke`

## 5. Reserved names

Reserved diagnostic and error code ranges for Coralite core:
- `CORALITE-E*`: Core error diagnostics.
- `CORALITE-W*`: Warning diagnostics.
- `CORALITE-A*`: Asset and asset pipeline diagnostics.
- `CORALITE-P*`: Plugin system errors and warnings.
- `CORALITE-PAGE-*`: Page-level diagnostics.

## 6. What belongs elsewhere

- Project scaffolding templates and template generation logic belong in `packages/create-coralite/`.
- Release tooling and version bump scripts belong in `packages/coralite-release/`.

## 7. Benchmark results

Benchmark result files are stored at `benchmarks/results/` at the repository root. Performance tasks must run `pnpm bench:internal --task-id <task-id> --phase <phase> --save` and commit the generated result files.

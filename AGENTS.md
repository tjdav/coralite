# Coralite Agent Invariants

Read this file before starting any task. Rules apply to every task.

## 1. Language and file extension policy

All source is `.js` (ESM). No `.ts`, `.tsx`, `.jsx`, or `.mjs` in the source tree. Type declarations are `.d.ts` only and are generated.

## 2. Authoring pattern

- Use `defineComponent`, `definePage`, `definePlugin`. Never bare objects.
- Templates use flat `{{ token }}` only. No expressions, dot notation, or function calls.
- No inline event handlers. Bind in `client()` with `refs()` + `{ signal }`.
- Getter signature: `({ state, route, ... })`. Must destructure.
- Style function signature: `(state) => ...`. Direct, not destructured.

### Style and script placement

`<style>` and `<script type="module">` are canonically siblings of `<template>`:

```html
<template id="my-component">
  <div>...</div>
</template>

<script type="module">
  import { defineComponent } from 'coralite'
  export default defineComponent({})
</script>

<style>
  :host { display: block }
</style>
```

The native Web Components form — `<style>` and `<script>` inside `<template>` —
is also accepted and normalized to the canonical form by the parser:

```html
<template id="my-component">
  <style>:host { display: block }</style>
  <div>...</div>
  <script type="module">
    import { defineComponent } from 'coralite'
    export default defineComponent({})
  </script>
</template>
```

Both produce identical output. Prefer the sibling form in hand-written code;
use whichever form you prefer in generated code.

## 3. Import rule

Top-level imports reserved for `define*` functions and modules used by isomorphic code (getters, style, slots). Modules used by `server()`, `client()`, or `paths()` are loaded with `await import()` inside the block.

## 4. Serialization boundary

- `server` runs at build time, stripped from the browser bundle.
- `client` runs in the browser, cannot reference module scope.
- Module-scope imports in `client` require `await import()`.
- Enforced by `no-restricted-imports` in `eslint.config.js` — see `**/lib/client/**` block.

## 5. No defensive guards in deterministic blocks

`client()` runs in the browser. `server()` runs in Node at build time. Getters, style, and slots run in both. The context the framework provides is guaranteed. Every destructured context key is always present.

Do not guard context keys.

```js
// Wrong — the guard hides a real bug
client({ lists }) {
  if (!lists) return
  lists.bind(...)
}

// Correct — if lists is undefined, the build should fail
client({ lists }) {
  lists.bind(...)
}
```

Do not check for browser globals in `client()`:

```js
// Wrong — always false, always dead code
client() {
  if (typeof window === 'undefined') return
}

// Correct — no check needed
client() {
  window.addEventListener(...)
}
```

Do not check for browser globals in `server()`:

```js
// Wrong — window is never defined during SSR
server() {
  if (typeof window !== 'undefined') { ... }
}

// Correct — use isServer to branch explicitly
getters: {
  greeting: ({ isServer }) => isServer ? 'SSR' : 'Client'
}
```

If you find yourself writing a defensive guard, stop. The framework's contract is that context keys are present. If they are not, the bug is elsewhere — in plugin registration, in the build, in the config. Guard clauses make that bug invisible.

## 6. Code style

### Factory functions over classes

Default to factory functions (`createCoralite`, `createRenderer`, `createCollection`).
No bare classes. Classes are allowed only when extending a base class:
`extends Error`, `extends HTMLElement`, `extends CoraliteCollection`.

### No `this` outside classes

`this` is only valid inside a class body. In `defineComponent`, `definePage`, and
`definePlugin` blocks, use the destructured context instead:

- `this.state` → `state`
- `this.refs` → `refs`
- `this.emit` → `emit`
- `this.querySelector(...)` → `refs('name')` or `root.querySelector(...)`

If a factory returns an object with methods, those methods use closures, not `this`.

### Factories start with `create`

`createCoralite`, `createRenderer`, `createCollection`. Not `makeX`, `buildX`, or
`XFactory`.

## 7. Non-fixable lint rules

The list of rules `lint:format` cannot auto-fix:

- `no-inline-comments` — no `//` comments on the same line as code.
- `no-nested-ternary` — refactor into if/else.
- `no-restricted-syntax` — no triple-nested optional chaining (`a?.b?.c?.d`).
- `no-restricted-syntax` — no bare classes, no `this` outside ClassBody.
- `jsdoc/require-jsdoc` — every exported function needs a JSDoc block.
- `jsdoc/require-param-type` — every `@param` needs a type.
- `jsdoc/require-param-description` — every `@param` needs a description.
- `no-restricted-comment-patterns` — no `---` separators, no numbered step comments, no stacked single-line comments.
- `no-shadow` — no variable names that shadow outer scope.
- `consistent-return` — all code paths in a function must return, or none must.

## 8. Workflow

Ordered verification commands:
1. `pnpm lint:format`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm build:html:dev`
5. `pnpm --filter coralite test:smoke`

All must exit clean for per-task verification (`pnpm test:unit` runs on merge to `v1`).

## 9. Naming

- Commits: Conventional Commits, scope required. Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `revert`. Scopes: `plugin`, `page`, `component`, `router`, `compiler`, `renderer`, `manifest`, `config`, `signals`, `hydration`, `validator`, `cli`, `test`, `docs`.
- Branch: `{type}/{task-id}-{slug}` (e.g. `docs/p0-00c-agent-documentation`).
- PR title format: match the primary commit title.

## 10. Verification

- Every task starts by verifying its Prerequisites checklist. If any check fails, author an exploration task. Do not proceed.
- Spec drift is a bug: if the code and the spec disagree and the code is right, update the spec.
- Do not use `git reset`, `git restore`, or `git checkout -- <file>` to discard work.

## 11. Execution mode

Autonomous. Do not pause mid-task. Do not emit progress updates. Do not ask clarifying questions. Do not discard work. Stop conditions are the acceptance criteria passing or a hard blocker.

## 12. Benchmark results

Performance tasks (Phase 3 tasks) must record and commit benchmark results.

- Run benchmarks using `pnpm bench:internal --task-id <task-id> --phase <before|after> --save`.
- Results are saved to `benchmarks/results/<task-id>.json`.
- Performance task PRs must commit their `before` and `after` benchmark result files to `benchmarks/results/`.
- The reference baseline is maintained at `benchmarks/results/baseline.json` and updated only when explicitly instructed by maintainers.

**External benchmark verification:** Before release, run `pnpm bench:external` to validate against the canonical external harnesses. This clones the external repos into `.bench-cache/` (gitignored) on first run, and caches across subsequent runs. Results are written to `benchmarks/results/external/` when invoked with `--save`. See `benchmarks/README.md` for the internal-vs-external split.

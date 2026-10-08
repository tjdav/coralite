# Coralite Agent Invariants

Read this file before starting any task. Rules apply to every task.

## Authoring pattern

- Use `defineComponent`, `definePage`, `definePlugin`. Never bare objects.
- Templates use flat `{{ token }}` only. No expressions, dot notation, or function calls.
- No inline event handlers. Bind in `client()` with `refs()` + `{ signal }`.
- Getter signature: `({ state, route, ... })`. Must destructure.
- Style function signature: `(state) => ...`. Direct, not destructured.

## Serialization boundary

- `server` runs at build time, stripped from the browser bundle.
- `client` runs in the browser, cannot reference module scope.
- Module-scope imports in `client` require `await import()`.

## Code style

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

## ESLint rules that are NOT auto-fixable

Write code that satisfies these on the first pass:

- `no-inline-comments` — no `//` comments on the same line as code.
- `no-nested-ternary` — refactor into if/else.
- `no-restricted-syntax` — no triple-nested optional chaining (`a?.b?.c?.d`).
- `no-restricted-syntax` — no bare classes, no `this` outside ClassBody.
- `jsdoc/require-jsdoc` — every exported function needs a JSDoc block.
- `jsdoc/require-param-type` — every `@param` needs a type.
- `jsdoc/require-param-description` — every `@param` needs a description.
- `no-restricted-comment-patterns` — no `---` separators, no numbered step
  comments, no stacked single-line comments.
- `no-shadow` — no variable names that shadow outer scope.
- `consistent-return` — all code paths in a function must return, or none must.

## Workflow

1. Write the code satisfying the rules above on the first pass.
2. Run `pnpm lint:format` to auto-fix stylistic issues.
3. Run `pnpm lint` to verify no non-fixable rules fire.
4. If any do, fix them manually and re-run.
5. Only submit when `pnpm lint` exits clean.

## Naming

- Commits: Conventional Commits, scope required. Types: `feat`, `fix`, `refactor`,
  `perf`, `docs`, `test`, `build`, `ci`, `chore`, `revert`. Scopes: `plugin`,
  `page`, `component`, `router`, `compiler`, `renderer`, `manifest`, `config`,
  `signals`, `hydration`, `validator`, `cli`, `test`, `docs`.
- Branch: `{type}/{task-id}-{slug}`.
- PR title: match the primary commit title.

## Verification

- Every task starts by verifying its Prerequisites checklist.
- If any check fails, author an exploration task. Do not proceed.
- Spec drift is a bug: if the code and the spec disagree and the code is right,
  update the spec.

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

## 3. Import rule

Top-level imports reserved for `define*` functions and modules used by isomorphic code (getters, style, slots). Modules used by `server()`, `client()`, or `paths()` are loaded with `await import()` inside the block.

## 4. Serialization boundary

- `server` runs at build time, stripped from the browser bundle.
- `client` runs in the browser, cannot reference module scope.
- Module-scope imports in `client` require `await import()`.

## 5. Code style

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

## 6. Non-fixable lint rules

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

## 7. Workflow

Ordered verification commands:
1. `pnpm lint:format`
2. `pnpm lint`
3. `pnpm build`
4. `pnpm build:html:dev`
5. `pnpm test:unit`

All must exit clean.

## 8. Naming

- Commits: Conventional Commits, scope required. Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`, `revert`. Scopes: `plugin`, `page`, `component`, `router`, `compiler`, `renderer`, `manifest`, `config`, `signals`, `hydration`, `validator`, `cli`, `test`, `docs`.
- Branch: `{type}/{task-id}-{slug}` (e.g. `docs/p0-00c-agent-documentation`).
- PR title format: match the primary commit title.

## 9. Verification

- Every task starts by verifying its Prerequisites checklist. If any check fails, author an exploration task. Do not proceed.
- Spec drift is a bug: if the code and the spec disagree and the code is right, update the spec.
- Do not use `git reset`, `git restore`, or `git checkout -- <file>` to discard work.

## 10. Execution mode

Autonomous. Do not pause mid-task. Do not emit progress updates. Do not ask clarifying questions. Do not discard work. Stop conditions are the acceptance criteria passing or a hard blocker.

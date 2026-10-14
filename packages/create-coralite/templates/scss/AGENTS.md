# Coralite Project Agent Invariants

Read this file before starting any task in this project.

## Authoring pattern

- Components and pages are defined with `defineComponent` and `definePage`.
- Templates use flat `{{ token }}` placeholders. No expressions, dot notation, or function calls.
- No inline event handlers. Bind in `client()` with `refs()` + `{ signal }`.
- Getter signature: `({ state }) => value`.
- Style signature: `({ state }) => value`.
- Slots signature: `({ nodes, state }) => nodes`.

## Import rule

Top-level imports are for `define*` functions and isomorphic helpers used by
`getters`, `style`, or `slots`. Modules used by `server()`, `client()`, or
`paths()` are loaded with `await import()` inside the block.

## Serialization boundary

- `server()` runs at build time and is stripped from the browser bundle.
- `client()` runs in the browser and cannot reference module scope.

## Workflow

- `pnpm start` — development server
- `pnpm build` — production build
- `pnpm check` — validate components, pages, plugins
- `pnpm fix` — auto-fix validation errors

## Where things live

- `src/components/` — reusable custom elements
- `src/pages/` — route definitions
- `public/` — static assets copied verbatim to the output

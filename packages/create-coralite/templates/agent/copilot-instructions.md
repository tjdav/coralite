# GitHub Copilot Instructions — Coralite (v{{ version }})

When generating or editing Coralite files (`src/components/*.html`, `src/pages/*.html`):

## 1. Language and file extension policy

- All source is `.js` (ESM) and `.html`. No `.ts`, `.tsx`, `.jsx`, or `.vue` files.
- Components are single `.html` files in `src/components/<tag-name>.html`.
- Pages are `.html` files in `src/pages/`.

## 2. Authoring pattern

- **Components (`src/components/*.html`)**: Use top-level named exports (`export function`, `export const`). Never use `defineComponent` for new components (`defineComponent` is retained strictly for legacy backwards compatibility) or `class extends HTMLElement`.
  - **Handlers (`export function`)**: `server`, `client`, `onError`.
  - **Declarations (`export const`)**: `attributes`, `getters`, `style`, `slots`, `provide`, `consume`, `formControl`, `listStrategy`.
  - Extra/helper exports are ignored by the compiler and preserved in module scope.
- **Pages (`src/pages/*.html`)**: Always use `export default definePage({ ... })` imported from `'coralite'`. Never use bare named exports in pages (`CORALITE-E108`).
  - Valid `definePage` blocks: `paths`, `server`, `getters`, `style`, `provide`, `client`, `onError`.
  - Pages do not support `attributes`, `slots`, `consume`, or `formControl`, and must not query component internals directly (`CORALITE-PAGE-201`).
- **Plugins**: Always use `export default definePlugin({ ... })` with two-phase curried context: `context: (pluginCtx) => (instanceCtx) => ({ ... })`.
- **Templates**: Flat `{{ token }}` placeholders only. No expressions (`{{ a + b }}`), dot notation (`{{ user.name }}`), conditionals, loops, or function calls (`CORALITE-E201`). Move all derived logic into synchronous `getters`.
- **Events**: No inline event handlers (`onclick="..."`, `@click`, `CORALITE-E203`). Bind in `client()` using `refs('name').addEventListener('click', fn, { signal })`. Emit custom events via `emit('name', detail)` (never `root.dispatchEvent`).
- **Context signatures (must destructure, `CORALITE-E105`)**:
  - Getters: `({ state, root, isServer, ... }) => value` (synchronous only).
  - Style: `({ state }) => value` (synchronous only, `CORALITE-E303`; returns string, number, or nullish).
  - Slots: `({ nodes, state }) => nodes` (build/server-time slot transformation).
- **Attributes**: Primitive types only (`String`, `Number`, `Boolean`, `CORALITE-E101`). Never `Object` or `Array`, and never combine `required: true` with `default` (`CORALITE-E102`).
- **State observation**: `observe('key', (val) => ...)` in `client()` is exclusively for external side-effects (imperative DOM, Canvas/WebGL, forms). Never mutate reactive `state` inside `observe()` (`CORALITE-E302`).

### Canonical component structure

```html
<template id="my-counter">
  <div class="counter">
    <span>{{ displayCount }}</span>
    <button ref="inc">+1</button>
  </div>
</template>

<script type="module">
  export const attributes = {
    initial: { type: Number, default: 0 }
  }

  export const getters = {
    displayCount: ({ state }) => `Count: ${state.count}`
  }

  export const style = {
    '--count-color': ({ state }) => state.count > 5 ? 'green' : 'inherit'
  }

  export function server ({ state }) {
    return { count: state.initial }
  }

  export async function client ({ state, refs, signal, emit }) {
    refs('inc').addEventListener('click', () => {
      state.count++
      emit('changed', { count: state.count })
    }, { signal })
  }
</script>

<style>
  :host {
    display: block;
    color: var(--count-color);
  }
</style>
```

### Canonical page structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>{{ pageTitle }}</title>
</head>
<body>
  <my-counter initial="2"></my-counter>
</body>
</html>

<script type="module">
  import { definePage } from 'coralite'

  export default definePage({
    getters: {
      pageTitle: ({ state }) => state.title
    },
    server () {
      return { title: 'Home' }
    }
  })
</script>
```

## 3. Import rule & Serialization boundary

- Top-level imports are reserved for `definePage` / `definePlugin` and modules used by isomorphic code (`getters`, `style`, `slots`).
- `server()` runs in Node.js at build time and is stripped from the browser bundle. It returns an object to initialize/hydrate `state`.
- `client()` is serialized to run in the browser and cannot reference module-scope variables or top-level imports. Modules used by `server()`, `client()`, or `paths()` must be loaded with dynamic `await import()` inside the block (`CORALITE-E301`).

## 4. No defensive guards in deterministic blocks

`client()` runs in the browser. `server()` runs in Node at build time. `getters`, `style`, and `slots` run in both. Every destructured context key provided by the framework is guaranteed to exist.

- Do not guard context keys (e.g., `if (!refs) return` or `if (!lists) return`).
- Do not check `typeof window === 'undefined'` inside `client()` or `server()`. Use `{ isServer }` in isomorphic `getters` when branching is required.

## 5. Code style & CSS

- **Factory functions over classes**: Default to factory functions (`createX`). No `this` outside class bodies; always use destructured context (`state`, `refs`, `emit`, `root`).
- **Scoped CSS**: Use `:host` for the custom element root and `:host-context(.selector)` for ancestor themes. Write `.child` directly instead of `:host .child`.

## 6. Workflow

- `pnpm dev` — start development server
- `pnpm build` — build production output to `dist/`
- `pnpm check` — validate components, pages, and plugins (`coralite check`)
- `pnpm fix` — auto-fix safe validation diagnostics (`coralite fix`)

## 7. SPA Router (opt-in)

The opt-in router plugin (`coralite/plugins/router`) gates ALL SPA behavior: without registration in `coralite.config.js`, a `data-router-outlet` marker is inert and the app stays multi-page.

- **Outlets**: The routed region is any element with the outlet attribute (default `data-router-outlet`) or the reserved `<router-outlet>` tag. Every routed page MUST have an outlet or the build fails. Elements OUTSIDE the outlet are untouched by the router and persist across route swaps.
- **Client API**: `client({ router })` injects `navigate(path, { replace })`, `current()`, `beforeEach(guard)` (returns the unregister function), and the `viewTransitions` getter.
- **Guard placement**: The guard list persists for the whole SPA session — outlet swaps never reset it, and nothing auto-unregisters. App-wide guards MUST be registered in a persistent shell component OUTSIDE the outlet; route-scoped guards MUST unregister on component `signal` abort, or every visit accumulates another guard.
- **State scoping**: Component `state` is route-scoped (lost when the route leaves; the new route re-hydrates from its pre-built HTML). App-scoped state MUST live in the global `store`, which survives every swap. Teardown imperative resources on `signal` abort.

Full contract: https://coralite.dev/docs/reference/plugins/router.html — patterns guide: https://coralite.dev/docs/guide/spa-router.html

# Coralite Project Agent Invariants (v{{ version }})

Read this file before starting any task in this project. Rules apply to every task.

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
- **Test fixtures (`tests/fixtures/`)**: Author test fixtures under `tests/fixtures/` (`tests/fixtures/pages` for test pages, `tests/fixtures/components` for mock/harness components) and configure `fixtures` in `coralite.config.js`. Never place test fixtures or test files inside `src/pages/` or `src/components/`.
- **Plugins**: Always use `export default definePlugin({ ... })` with two-phase curried context: `context: (pluginCtx) => (instanceCtx) => ({ ... })`. Top-level `context` is ubiquitous across Component and Page `server`, `getters`, `client`, `slots`, and `style`. Environment-specific `server.context` / `client.context` are injected into Component and Page `server()` and `client()` handlers respectively. Reserved framework keys (`route`, `app`, etc.) take strict precedence.
- **Templates**: Flat `{{ token }}` placeholders only. No expressions (`{{ a + b }}`), dot notation (`{{ user.name }}`), conditionals, loops, or function calls (`CORALITE-E201`). Move all derived logic into synchronous `getters`.
- **Events**: No inline event handlers (`onclick="..."`, `@click`, `CORALITE-E203`). Bind in `client()` using `refs('name').addEventListener('click', fn, { signal })`. Emit custom events via `emit('name', detail)` (never `root.dispatchEvent`).
- **Context signatures (flexible destructuring)**:
  - Getters: `({ state, root, isServer, ... }) => value` or `(context) => context.state...` (synchronous only; pure derivations; receives core context plus any ubiquitous top-level plugin `context`, e.g. `$t`).
  - Style: `({ state }) => value` or `(context) => context.state...` (synchronous only, `CORALITE-E303`; returns string, number, or nullish).
  - Slots: `({ nodes, state }) => nodes` or `(context) => context.nodes` (build/server-time slot transformation).
- **Attributes**: Primitive types only (`String`, `Number`, `Boolean`, `CORALITE-E101`). Never `Object` or `Array`, and never combine `required: true` with `default` (`CORALITE-E102`).
- **State observation**: `observe('key', (val) => ...)` in `client()` is exclusively for external side-effects (imperative DOM, Canvas/WebGL, forms). Never mutate reactive `state` inside `observe()` (`CORALITE-E302`).

### Canonical component structure

`<style>` and `<script type="module">` are canonically siblings of `<template>` (placing `<style>` and `<script>` inside `<template>` is also accepted and normalized by the parser):

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

### Zero-JS static components

A component is **static** when its definition serializes zero client lifecycle code: `client: null`, `getters: {}`, no `server`, no reactive `state` mutations. This is the correct meaning of "zero-JS" in Coralite — the component module is still bundled into `dist/assets/js/` for imperative hydration, but no `client()` handler runs in the browser.

Purely static components do not require a `<script>` tag at all when they only define markup and styles:

```html
<template id="ui-card">
  <div class="card">
    <slot></slot>
  </div>
</template>

<style>
  :host { display: block }
</style>
```

When attributes or types are needed, author a `<script type="module">` exporting `attributes` (or `style`). Both emit 0 bytes of browser runtime lifecycle code. If a `<script type="module">` is included (e.g., for authoring uniformity, comments, or module helpers), no dummy placeholder exports like `export const attributes = {}` are needed — export-free scripts natively evaluate to Zero-JS static components.

```html
<template id="ui-button">
  <button type="{{ type }}" disabled="{{ disabled }}">
    <slot></slot>
  </button>
</template>

<script type="module">
  export const attributes = {
    type: { type: String, default: 'button' },
    disabled: { type: Boolean, default: false }
  }
</script>
```

Key properties:
- `{{ type }}` and `{{ disabled }}` render directly from `state` at SSR time — no getter, no `client()`.
- Native boolean attributes (`disabled`, `readonly`, `required`, `checked`) reflect automatically (`attr=""` when truthy, omitted when falsy).
- Native button/keyboard/form semantics work directly because Coralite renders Light DOM.

### Getters are for derived state, not passthroughs

`getters` compute **derived** values — things not directly present in `state`. A getter whose body is literally `({ state }) => state.someField` is dead code: the field is already available as a flat template token `{{ someField }}`.

Rule of thumb: *If the getter body could be replaced by a raw `{{ token }}` in the template, delete the getter.*

**Forbidden — passthrough getter:**
```html
<template id="bad-example">
  <button type="{{ buttonType }}">…</button>
</template>
<script type="module">
  export const attributes = { type: { type: String, default: 'button' } }
  export const getters = {
    // ❌ passthrough
    buttonType: ({ state }) => state.type
  }
</script>
```

**Required — direct flat token:**
```html
<template id="good-example">
  <button type="{{ type }}">…</button>
</template>
<script type="module">
  export const attributes = { type: { type: String, default: 'button' } }
  // no getters block
</script>
```

**Legitimate getter examples:**
- Combining fields: `fullName: ({ state }) => `${state.firstName} ${state.lastName}``
- Fallback chains: `displayValue: ({ state }) => state.value || state.placeholder || '—'`
- Slot presence: `hasIcon: ({ slots }) => slots.has('icon')`

### Ref pragmas for phased component evolution (`CORALITE-W402`)

When authoring UI components incrementally (e.g., Step 1 builds static markup `<button ref="button">`, Step 2 wires events in `client()`), the validator emits `CORALITE-W402: Element ref 'button' defined in template but never accessed`.

Do NOT delete the `ref` attribute, and do NOT add an empty `client({ refs }) { refs('button') }` handler (which breaks zero-JS static status). Instead, suppress the warning with a scoped pragma comment `<!-- coralite-ignore <refName> -->` immediately following `<template>`:

```html
<template id="ui-button">
  <!-- coralite-ignore button -->
  <button ref="button" type="{{ type }}">
    <slot></slot>
  </button>
</template>
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
      pageTitle: ({ state }) => `App — ${state.title}`
    },
    server () {
      return { title: 'Home' }
    }
  })
</script>
```

## 3. Import rule

Top-level imports are reserved for `definePage` / `definePlugin` and modules used by isomorphic code (`getters`, `style`, `slots`). Modules used by `server()`, `client()`, or `paths()` must be loaded with dynamic `await import()` inside the block (`CORALITE-E301`).

- **Lazy dependency stylesheets (`await import('*.css')`)**: Load dependency or local `.css` files lazily inside component and page `client()` blocks (or transitive client `.js` helpers) via `await import('pkg/styles.css', options)`, which bundles CSS at build time into hashed `assets/css/` assets, injects `<link rel="stylesheet">` into `<head>` in deterministic manifest order at runtime, and resolves to `{ default: link.sheet ?? null, link }`. Both flat options (`{ media, nonce, crossorigin, referrerPolicy, signal, force }`) and Import Attributes (`{ with: { type: 'css', ... }, signal, force }`) are supported. Static top-level `.css` imports or dynamic `.css` imports outside `client()` throw `CORALITE-E109`; unresolvable `.css` files throw `CORALITE-E403`.

## 4. Serialization boundary

- `server()` runs in Node.js at build time and is stripped from the browser bundle. It returns an object to initialize/hydrate `state`.
- `client()` is serialized to run in the browser and cannot reference module-scope variables or top-level imports. Use `await import()` inside `client()`.

## 5. No defensive guards in deterministic blocks

`client()` runs in the browser. `server()` runs in Node at build time. `getters`, `style`, and `slots` run in both. Every destructured context key provided by the framework is guaranteed to exist.

- Do not guard context keys (e.g., `if (!refs) return` or `if (!lists) return`).
- Do not check `typeof window === 'undefined'` inside `client()` or `server()`. Use `{ isServer }` in isomorphic `getters` when branching is required.

## 6. Code style & CSS

- **Factory functions over classes**: Default to factory functions (`createX`). No `this` outside class bodies; always use destructured context (`state`, `refs`, `emit`, `root`).
- **Scoped CSS**: Use `:host` for the custom element root and `:host-context(.selector)` for ancestor themes. Write `.child` directly instead of `:host .child`.

## 7. Workflow & project layout

- `pnpm dev` — start development server
- `pnpm build` — build production output to `dist/`
- `pnpm check` — validate components, pages, and plugins (`coralite check`)
- `pnpm fix` — auto-fix safe validation diagnostics (`coralite fix`)

### Where things live

- `src/components/` — reusable custom elements (`.html`)
- `src/pages/` — route definitions (`.html`)
- `tests/fixtures/` — component test fixtures (`.html`)
- `public/` — static assets copied verbatim to output
- `coralite.config.js` — project & plugin configuration

## 8. SPA Router (opt-in)

The opt-in router plugin (`coralite/plugins/router`) provides single-page application navigation. Register it in `coralite.config.js` under `plugins` (`plugins: [router({ ... })]`). Registration gates ALL SPA behavior — without it, every SPA navigation behavior (link interception, popstate, guards, head reconciliation) is inert: a `data-router-outlet` marker alone does nothing, and the page behaves as a standard multi-page app.

- **Outlets**: Any element carrying the outlet attribute (default `data-router-outlet`) or the reserved `<router-outlet>` tag is an outlet. Every SPA-routed page MUST have an outlet or client navigation fails; outlet-less pages are auto-wrapped by default. Set `autoWrap: false` to disable automatic body wrapping; outlet-less pages then render as authored and still resolve tokens normally. Set `outletOnly: true` to skip link interception when the live document has no outlet, so those clicks use native browser navigation. `router.navigate()` is NOT affected by `outletOnly` and still updates history before failing if no outlet exists, so do not call it from outlet-less pages. Everything outside the outlet (navbar, background audio, open sockets) is never touched by the router — those component instances and their state persist across every route swap.
- **Client API**: `client({ router })` injects the router: `navigate(path, { replace })`, `current()`, `beforeEach(guard)` (returns the unregister function), and the `viewTransitions` getter. Also available on `window.__coralite__.plugins.router`.
- **Guards**: `beforeEach` guards may return `true`/`undefined` (allow), `false` (block), a relative or same-origin path (soft redirect; redirect chains are capped at depth 10), or an `http(s)` URL (hard redirect via `window.location.replace()`).
- **Guard placement**: The guard list lives in the router's client-init scope and PERSISTS across the whole SPA session — an outlet swap does not reset it, and nothing auto-unregisters a guard when its route leaves. App-wide guards (auth, redirects) MUST be registered in a persistent shell component OUTSIDE the outlet (it connects once, so the guard registers exactly once). Route-scoped guards MUST capture the function returned by `beforeEach` and call it on their component `signal` abort. Registering guards inside a route component's `client()` without unregistering accumulates one extra guard per visit.
- **State scoping**: Component `state` is route-scoped — on navigation the old outlet is disconnected (its `signal` aborts), and the new route hydrates from its pre-built HTML, so `state` mutations are lost when the route leaves. App-scoped state belongs in the global `store` (declared in `coralite.config.js`), which the router never touches and which survives every swap. Release imperative resources a component allocates (workers, canvas/WebGL contexts, external library handles) when the component is torn down — hook teardown to the `signal` `abort` event.
- **Navigation events**: Cancelable `coralite:navigating` (fired before the swap) and post-swap `coralite:navigated` on `window`, both with `detail: { from, to }`.

Full contract: https://coralite.dev/docs/reference/plugins/router.html — patterns guide: https://coralite.dev/docs/guide/spa-router.html

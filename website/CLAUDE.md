# Claude Code Project Guidelines — Coralite (v{{ version }})

Refer to [`AGENTS.md`](./AGENTS.md) for complete architectural invariants. Quick reference for Claude Code:

## Quick Component Template (`src/components/my-component.html`)

```html
<template id="my-component">
  <div class="container">
    <h2>{{ title }}</h2>
    <p>{{ displayCount }}</p>
    <button ref="action">Do Thing</button>
  </div>
</template>

<script type="module">
  export const attributes = {
    title: { type: String, default: 'Title' }
  }

  export const getters = {
    displayCount: ({ state }) => `Count: ${state.count}`
  }

  export const style = {
    '--accent-color': ({ state }) => (state.count > 5 ? 'green' : 'blue')
  }

  export function server ({ state }) {
    return { count: 0, ...state }
  }

  export async function client ({ state, refs, signal, emit }) {
    refs('action').addEventListener('click', () => {
      state.count++
      emit('count-changed', { count: state.count })
    }, { signal })
  }
</script>

<style>
  :host {
    display: block;
    padding: 1rem;
  }
</style>
```

## Quick Page Template (`src/pages/index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>{{ pageTitle }}</title>
</head>
<body>
  <my-component title="Hello"></my-component>
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

## Core Invariants

1. **Components vs. Pages**: Components use top-level named exports (`export function`, `export const`). Pages use `export default definePage({ ... })` (never bare named exports).
2. **Flat Tokens Only in `<template>`**: `{{ token }}` placeholders only. No logic, expressions, dot notation, or inline events in HTML.
3. **Serialization Boundary**: Code inside `client()` is serialized for the browser. Never close over module-scope variables or top-level imports inside `client()`; use dynamic `await import()` inside `client()`, `server()`, or `paths()`.
4. **No Defensive Guards**: Context keys (`state`, `refs`, `signal`, `emit`, `lists`, etc.) are guaranteed by the framework. Never guard context keys or check `typeof window` in `client()` or `server()`.
5. **Primitive Attributes Only**: Attributes are `String`, `Number`, or `Boolean`. Never `Object` or `Array`.
6. **Destructured Contexts**: Always destructure `getters`, `style`, and `slots` (`({ state }) => ...` / `({ nodes, state }) => ...`).
7. **Events & Observation**: Bind events in `client()` via `refs('name').addEventListener(..., { signal })`. Dispatch custom events with `emit('name', detail)`. Never mutate `state` inside `observe()`.

## Commands

- `pnpm dev` — start development server
- `pnpm build` — build production output to `dist/`
- `pnpm check` — validate components, pages, and plugins (`coralite check`)
- `pnpm fix` — auto-fix safe validation diagnostics (`coralite fix`)

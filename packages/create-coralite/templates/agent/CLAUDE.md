# Claude Code Project Guidelines — Coralite (v{{ version }})

Refer to `AGENTS.md` for full architectural details. Quick summary for Claude Code:

## Quick Component Template

```html
<template id="my-component">
  <div class="container">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <button ref="action">Do Thing</button>
  </div>
</template>

<script type="module">
  import { defineComponent } from 'coralite'

  export default defineComponent({
    attributes: {
      title: { type: String, default: 'Title' },
      description: { type: String, default: '' }
    },
    state: {
      count: 0
    },
    getters: {
      displayCount: ({ state }) => `Count: ${state.count}`
    },
    server({ state }) {
      // SSR/build-time only — can use Node.js APIs
      return { ...state }
    },
    client({ state, refs, signal, emit }) {
      const handleClick = () => {
        state.count++
        emit('count-changed', { count: state.count })
      }

      refs('action').addEventListener('click', handleClick, { signal })
    },
    style: {
      '--accent-color': (state) => state.count > 5 ? 'green' : 'blue'
    }
  })
</script>

<style>
  :host {
    display: block;
    padding: 1rem;
  }
  .container { /* ... */ }
</style>
```

## Core Invariants

1. **Flat Tokens Only in `<template>`**: `{{ token }}` placeholders only. No logic, expressions, or inline events in HTML.
2. **Client Serialization Boundary**: Code inside `client()` is stringified and sent to the browser. Never close over module-scope variables or top-level imports inside `client()`.
3. **Primitive Attributes Only**: Attributes are `String`, `Number`, or `Boolean`. Never `Object` or `Array`.
4. **Clean Getters**: `getters` are pure derived functions. Always destructure context like `({ state }) => ...`.
5. **Event Binding**: Use `ref="name"` in template, bind in `client()` with `{ signal }` for automatic cleanup.
6. **Emissions**: Use `emit('name', detail)` — not `dispatchEvent`.

## Commands

- `npm start` — Start development server
- `npm run build` — Build production site
- `npx coralite check` — Validate components, plugins, and pages
- `npx coralite fix` — Auto-fix safe component issues

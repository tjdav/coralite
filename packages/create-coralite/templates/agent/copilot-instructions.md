# GitHub Copilot Instructions — Coralite (v{{ version }})

When generating or editing Coralite components (`src/components/*.html`, `src/pages/*.html`):

## 1. Component File Structure

Every component is a single `.html` file:

```html
<template id="component-name">
  <!-- markup with flat {{ token }} placeholders -->
</template>

<script type="module">
  import { defineComponent } from 'coralite'

  export default defineComponent({
    attributes: { ... },
    state: { ... },
    getters: { ... },
    slots: { ... },       // optional - transform slot content
    server({ state }) { ... },
    client({ state, refs, signal, emit, observe, slots, root }) { ... },
    style: { ... }
  })
</script>

<style>
  :host { display: block }
</style>
```

## 2. Template Rules (<template>)

- **Flat tokens only**: `{{ title }}`, `{{ count }}` — no expressions
- **No JavaScript expressions**: `{{ count + 1 }}`, `{{ user.name }}`, `{{ format(x) }}`
- **No inline handlers**: No `onclick="..."`, `onsubmit="..."`, `@click`
- **No conditionals/loops**: No `if`, `v-for`, `*ngFor`, `{{#each}}`
- **Compute in getters**: Move all derived values to `getters: { ... }`

### Template Example

```html
<template id="counter-card">
  <div class="card">
    <h2>{{ title }}</h2>
    <p class="value">Count: {{ displayCount }}</p>
    <button ref="increment">+1</button>
    <button ref="decrement">-1</button>
  </div>
</template>
```

## 3. Component Definition

### `defineComponent({ ... })`
- Always use `defineComponent` from `'coralite'`
- Never use `class X extends HTMLElement` or `customElements.define()`
- Export as default export

### `attributes`
- Only primitives: `String`, `Number`, `Boolean`
- Never `Object` or `Array`

```js
attributes: {
  title: { type: String, default: 'Counter' },
  initialCount: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false }
}
```

### `state`
- Declare reactive properties with initial values

```js
state: {
  count: 0
}
```

### `getters`
- Pure derived values
- **MUST destructure context**: `({ state }) => ...`
- Synchronous only
- Receive full context: `{ state, root, refs, slots, signal }`

```js
getters: {
  displayCount: ({ state }) => `Count: ${state.count}`,
  doubled: ({ state }) => state.count * 2
}
```

### `server({ state })`
- Runs during SSR/build (Node.js only)
- Stripped from browser bundles
- Returns object to hydrate client state

```js
server({ state }) {
  // Server-only code here
  return { count: state.count }
}
```

### `client({ state, refs, signal, emit, observe })`
- Runs in browser only
- **Cannot access module-scope variables or top-level imports**
- Use `await import()` for browser dependencies
- Bind events with `{ signal }` for cleanup

```js
client({ state, refs, signal, emit }) {
  const increment = () => { state.count++ }
  const decrement = () => { state.count-- }

  refs('increment').addEventListener('click', increment, { signal })
  refs('decrement').addEventListener('click', decrement, { signal })
}
```

### `observe(key, callback)` - State Observation

Use `observe()` to sync with external systems (NOT for mutating state):

```js
client({ state, observe, signal }) {
  observe('count', (newValue) => {
    // Sync with external system only - don't mutate state here!
    console.log('Count changed to:', newValue)
  })
}
```

### `slots` (optional)
- Transform slot content at build/server time

```js
slots: {
  default (content) {
    // Filter out whitespace-only text nodes
    return content.filter(n => n.type !== 'text' || n.data.trim())
  }
}
```

### `style` (dynamic CSS)
- Functions receive `state` directly: `(state) => ...`
- Synchronous only
- Return string, number, or nullish

```js
style: {
  '--primary-color': (state) => state.count > 5 ? 'green' : 'blue'
}
```

## 4. Client Boundary Rules

- **Do NOT reference top-level imports** inside `client()`
- **Do NOT reference outer-scope variables** inside `client()`
- `client()` is stringified and executed in the browser
- Use dynamic `await import()` inside `client()` for external dependencies

### Correct Pattern

```js
client({ signal }) {
  const { something } = await import('some-browser-lib')
  something()
}
```

### Wrong Pattern

```js
import { something } from 'some-lib' // top-level import

client({ signal }) {
  something() // ERROR: cannot access top-level import
}
```

## 5. Event Handling

1. Add `ref="name"` to template elements
2. Bind in `client()` using `refs('name')`
3. Always pass `{ signal }` to `addEventListener`
4. Use `emit('event-name', detail)` for custom events

```html
<template id="my-btn">
  <button ref="btn">Click me</button>
</template>
```

```js
client({ refs, signal, emit }) {
  refs('btn').addEventListener('click', () => {
    emit('clicked', { timestamp: Date.now() })
  }, { signal })
}
```

## 6. Styling Rules

- Use `:host` to target the component root element
- Use `:host-context(.dark)` for theme-aware styles
- Do NOT write `:host .child` — just write `.child`
- Slotted content (`<slot>`) participates in parent layout automatically

```css
:host {
  display: block;
  padding: 1rem;
}

:host-context(.dark) {
  background: #1a1a1a;
  color: white;
}

.child {
  /* styles for child elements */
}
```

## 7. Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| `{{ a + b }}` in template | Create getter: `sum: ({ state }) => state.a + state.b` |
| `onclick="handle()"` | Use `ref="btn"` + bind in `client()` |
| `(state) => ...` in getter | Destructure: `({ state }) => ...` |
| Import at top, use in `client()` | `await import()` inside `client()` |
| `dispatchEvent()` | Use `emit()` |
| Async in `style` | Keep synchronous |
| Mutate state in `observe()` | Mutate in event handlers only |
| `Object`/`Array` in attributes | Pass primitives, use `server()` for complex data |

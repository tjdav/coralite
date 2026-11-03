# Coralite Components Reference

> Authoring specifications and API reference for Coralite custom elements.

## 1. File Structure

Every Coralite component is authored as a single `.html` file located in `src/components/<tag-name>.html`:

```html
<template id="my-element">
  <!-- Declarative markup with flat {{ token }} placeholders -->
</template>

<script type="module">
  // Named declarations
  export const attributes = { ... }
  export const getters = { ... }
  export const style = { ... }
  export const slots = { ... } // optional
  export const provide = { ... } // optional
  export const consume = [ ... ] // optional
  export const formControl = false // optional (true for FACE)
  export const listStrategy = 'minimal' // optional ('minimal' | 'full')

  // Named lifecycle handlers
  export function server ({ state }) { ... }
  export function client ({ state, refs, signal, emit, observe }) { ... }
  export function onError ({ error, state }) { ... }
</script>

<style>
  :host { display: block; }
</style>
```

## 2. Invariants

1. **Named Exports Rule**: Handlers use `export function` (`server`, `client`, `onError`). Declarations use `export const` (`attributes`, `getters`, `style`, `slots`, `provide`, `consume`, `formControl`, `listStrategy`). Never use `defineComponent` or `class extends HTMLElement` for new components.
2. **Templates are Dumb**: Only flat `{{ token }}` interpolations are supported. No expressions (`{{ a + b }}`), function calls, or inline events (`onclick`).
3. **No Defensive Guards**: Framework-injected context arguments (`state`, `refs`, `signal`, `emit`, etc.) are guaranteed to exist. Never guard them with `if (!refs) return`.
4. **Zero-JS Static Components**: A component is static when its definition serializes zero client lifecycle code (`client: null`, `getters: {}`). A component exporting only `attributes` (or `style`) emits 0 bytes of client lifecycle code. Attributes reflect directly to template tokens at SSR time.
5. **Getters are for Derived State, Not Passthroughs**: `getters` compute derived values. Never author a getter that merely passes through raw state (`({ state }) => state.someProp`). If a getter body could be replaced by a flat `{{ token }}`, delete the getter.
6. **Ref Pragmas for Phased Evolution (`CORALITE-W402`)**: Suppress unused element ref warnings during multi-step development with `<!-- coralite-ignore <refName> -->` following `<template>`, rather than deleting refs or authoring dummy `client()` blocks.

## 3. Declarations Reference

### `attributes`
Declares external HTML attributes coerced and validated into reactive component state.
* **Allowed Types**: `String`, `Number`, `Boolean`. Never `Object` or `Array` (`CORALITE-E101`).
* **Options**: `default`, `required: true` (cannot combine with `default`), `reflect: true`, `transform: (val) => val`, `validate: (val) => boolean | string`.

```javascript
export const attributes = {
  label: { type: String, default: 'Default Label' },
  count: {
    type: Number,
    default: 0,
    validate: (val) => val >= 0 || 'Count must be non-negative'
  },
  disabled: { type: Boolean, default: false }
}
```

### `getters`
Pure derived state computed synchronously.
* Receives unified context: `({ state, root, refs, slots, signal }) => value` or `(context) => context.state...`.
* Synchronous only.

```javascript
export const getters = {
  displayCount: ({ state }) => `Total: ${state.count}`,
  hasItems: (context) => context.state.items.length > 0
}
```

### `style`
Dynamic CSS properties and CSS variables mapped to synchronous functions.
* Receives style context: `({ state, isServer, signal }) => value` or `(context) => context.state...`.
* Synchronous only (`CORALITE-E303`). Returning a Promise throws an error.

```javascript
export const style = {
  '--theme-color': ({ state }) => (state.active ? '#22c55e' : '#64748b'),
  display: (context) => (context.state.hidden ? 'none' : 'block')
}
```

### `slots`
Build-time/SSR slot transformations.
* Receives slot context: `({ nodes, state }) => nodes` or `(context) => context.nodes`.

```javascript
export const slots = {
  default: ({ nodes }) => nodes.filter(n => n.type !== 'text' || n.data.trim())
}
```

## 4. Lifecycle Handlers

### `server({ state, root, session, page, signal, slots, refs })`
* Runs in Node.js at build time / SSR. Stripped completely from browser bundles.
* Returns an object merged into initial client state.

```javascript
export function server ({ state }) {
  return {
    initialTime: Date.now()
  }
}
```

### `client({ state, root, refs, signal, emit, observe, updateComplete, errors, internals })`
* Executes in the browser when the component mounts.
* **Serialization Boundary**: Cannot access module-scope variables or top-level static imports. Use dynamic `await import()` inside `client()`.
* Always pass `{ signal }` to event listeners for automatic cleanup.
* Never mutate reactive `state` inside `observe()` (`CORALITE-E302`).

```javascript
export async function client ({ state, refs, signal, emit }) {
  const button = refs('btn')
  button.addEventListener('click', () => {
    state.count++
    emit('count-change', { count: state.count })
  }, { signal })
}
```

### `onError({ error, state, element, page, root })`
SSR error boundary fallback when component rendering throws in production:

```javascript
export function onError ({ error, state }) {
  return {
    template: '<div class="fallback"><p>{{ message }}</p></div>',
    state: { message: 'Component failed to load.' }
  }
}
```

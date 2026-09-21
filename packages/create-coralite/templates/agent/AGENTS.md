# Coralite AI Agent Guidelines & Architecture Reference (v{{ version }})

> **Audience**: AI coding assistants (Cursor, Claude Code, GitHub Copilot, Codex, Cline, Windsurf) and developers building applications with Coralite.
> **Runtime Floor**: Node.js `>=22.22.2` (ESM native)
> **Source of Truth**: This document defines the non-negotiable architectural invariants, reactivity rules, and negative constraints for Coralite workspaces.

---

## Table of Contents

1. [Critical Directives (MUST & MUST NEVER)](#0-critical-directives-must--must-never)
2. [Component Architecture](#1-component-architecture)
3. [Template Rules](#2-template-rules)
4. [Reactivity & State](#3-reactivity--state)
5. [Serialization Boundary](#4-serialization-boundary)
6. [Event Handling](#5-event-handling)
7. [State Observation](#6-state-observation)
8. [Slots](#7-slots)
9. [Styling](#8-styling)
10. [Testing & Playwright Patterns](#9-testing--playwright-patterns)
11. [Diagnostic Codes & Gotchas](#10-diagnostic-codes--gotchas)
12. [Verification Workflows](#11-verification-workflows)

---

## 0. Critical Directives (MUST & MUST NEVER)

When writing, refactoring, or generating code for Coralite:

1. **MUST use `defineComponent`**: Never generate class-based Web Components (`class X extends HTMLElement`) and never invoke `customElements.define()` manually. Always export `defineComponent({ ... })` imported from `'coralite'`.
2. **MUST author components in `.html`**: Components are authored strictly as single `.html` files in `src/components/<tag-name>.html` containing `<template id="<tag-name>">`, optional `<style>`, and optional `<script type="module">`. Never create `.js`, `.jsx`, `.tsx`, or `.vue` component files.
3. **MUST keep templates "dumb" (flat tokens only)**: Templates strictly support flat identifier interpolations: `{{ propertyName }}`. Never write expressions (`{{ a + b }}`), function calls (`{{ format(x) }}`), negations (`{{ !flag }}`), loops (`v-for`, `*ngFor`), conditionals (`if="..."`), or dot-notation (`{{ user.name }}`). Lift all logic into synchronous `getters`.
4. **MUST NEVER use inline event handlers (`CORALITE-E203`)**: Never put `onclick="..."`, `onsubmit="..."`, or `@click` attributes in `<template>` markup. All events must be wired inside `client()` using `refs()`.
5. **MUST respect the Serialization Boundary**:
   - `server({ state })` runs exclusively during SSR / build time in Node.js and is stripped from browser bundles. It MUST return an object to hydrate client state.
   - `client({ state, ... })` runs strictly in the browser. It cannot access outer module-scope variables, top-level static imports, or server packages.
6. **MUST pass `{ signal }` to all browser event listeners**: Always bind DOM events inside `client()` using the lifecycle signal: `el.addEventListener('click', fn, { signal })`. This ensures automatic cleanup when components disconnect, preventing memory leaks.
7. **MUST destructure the getter context (`CORALITE-E105`)**: Getters receive a single unified context object `({ state, root, refs, slots, signal })`. You MUST destructure parameters (e.g., `({ state }) => state.count`). Authoring `(state) => state.count` binds the context object itself to `state`, causing properties to evaluate to `undefined`.
8. **MUST keep `style` getters synchronous (`CORALITE-E303`)**: Functions in the `style` block receive `state` directly: `(state) => ...` (NOT a context object). They must be strictly synchronous and return a string, number, or nullish value. Returning a `Promise` throws an error.
9. **MUST NEVER mutate state inside `observe()` (`CORALITE-E302`)**: `observe(prop, callback)` is exclusively for syncing with external subsystems (WebGL, imperative DOM, forms). Mutating reactive state inside an observer causes infinite reactive loops and triggers diagnostic `CORALITE-E302`.
10. **MUST use `emit()` instead of `root.dispatchEvent`**: `emit(name, detail, options)` automatically defaults to `{ bubbles: true, composed: true }`, which is required to cross custom element boundaries.
11. **MUST restrict attributes to primitives (`CORALITE-E101`)**: Attribute schemas only support `String`, `Number`, and `Boolean`. `Array` and `Object` are not supported as attribute types.

---

## 1. Component Architecture

### File Structure

Every Coralite component is a single `.html` file:

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

### Component Anatomy

| Section | Purpose | Runtime |
|---------|---------|---------|
| `<template>` | Declarative markup with flat tokens | Both (compiled) |
| `attributes` | External input schema (primitives only) | Both |
| `state` | Reactive internal state | Both |
| `getters` | Derived/computed values | Both |
| `slots` | Slot content transformation | Server/build |
| `server()` | SSR/build-time initialization | Node.js only (stripped) |
| `client()` | Browser runtime logic & event binding | Browser only |
| `<style>` | Static component styles | Both |
| `style` | Dynamic CSS custom properties | Both |

---

## 2. Template Rules

### Dumb Templates (Flat Tokens Only)

Templates support only flat identifier interpolations:

```html
<!-- CORRECT -->
<template id="greeting-card">
  <h1>{{ title }}</h1>
  <p>{{ message }}</p>
</template>

<!-- WRONG - expressions not allowed -->
<template id="greeting-card">
  <h1>{{ title.toUpperCase() }}</h1>  <!-- No function calls -->
  <p>{{ user.firstName }}</p>         <!-- No dot notation -->
  <p>{{ count + 1 }}</p>              <!-- No expressions -->
</template>
```

### No Inline Event Handlers

```html
<!-- CORRECT -->
<template id="button-comp">
  <button ref="click-me">Click</button>
</template>

<!-- WRONG -->
<template id="button-comp">
  <button onclick="handle()">Click</button>   <!-- No inline handlers -->
  <button @click="handle()">Click</button>    <!-- No framework syntax -->
</template>
```

### No Conditionals or Loops

Templates do not support `if`, `v-for`, `*ngFor`, or similar constructs. Use getters to prepare data:

```html
<!-- CORRECT - use getter to prepare conditional content -->
<template id="list-item">
  <div class="item">{{ itemDisplay }}</div>
</template>

<script type="module">
  export default defineComponent({
    getters: {
      itemDisplay: ({ state }) => 
        state.items.length > 0 ? state.items[0].name : 'Empty'
    }
  })
</script>
```

---

## 3. Reactivity & State

### State Declaration

```js
state: {
  count: 0,
  name: 'default',
  items: [],  // arrays work in state, just not as attributes
  config: null
}
```

### Getters (Derived State)

- Pure functions that derive values from state
- **Must destructure context**: `({ state }) => ...`
- Synchronous only
- Receive full context: `{ state, root, refs, slots, signal }`

```js
getters: {
  // Basic derivation
  doubled: ({ state }) => state.count * 2,
  
  // String formatting
  greeting: ({ state }) => `Hello, ${state.name}!`,
  
  // Conditional logic
  statusClass: ({ state }) => 
    state.count > 10 ? 'high' : state.count > 5 ? 'medium' : 'low',
  
  // Accessing root (parent component state)
  totalWithTax: ({ state, root }) => 
    state.price * root.taxRate
}
```

### Style Getters (Dynamic CSS)

- Functions receive `state` directly: `(state) => ...` (NOT destructured)
- Synchronous only
- Return string, number, or nullish

```js
style: {
  '--primary': (state) => state.active ? '#0066ff' : '#666',
  '--padding': (state) => `${state.padding}px`,
  '--display': (state) => state.visible ? 'block' : 'none'
}
```

---

## 4. Serialization Boundary

### `server({ state })`

- Runs during SSR and build time in Node.js
- Stripped from browser bundles
- Can use Node.js imports and server-only packages
- Must return an object to hydrate client state

```js
server({ state }) {
  // Can use Node.js APIs
  return {
    items: [],
    loaded: true
  }
}
```

### `client({ state, refs, signal, emit, observe, slots, root })`

- Runs in browser only
- **Serialization boundary**: Cannot access:
  - Top-level module imports
  - Outer-scope variables
  - Server-only packages
- Use dynamic `await import()` for browser dependencies

```js
client({ signal }) {
  // CORRECT: dynamic import for browser
  const lib = await import('browser-library')
  
  // WRONG: top-level import reference
  // import { lib } from 'browser-library'  // at top of file
  // lib.doSomething()  // ERROR in client()
}
```

---

## 5. Event Handling

### Binding Events with Refs

1. Add `ref="name"` to template elements
2. Access via `refs('name')` in `client()`
3. Bind with `{ signal }` for automatic cleanup

```html
<template id="clickable">
  <button ref="primary">Primary</button>
  <button ref="secondary">Secondary</button>
</template>
```

```js
client({ refs, signal, emit }) {
  const handlePrimary = () => {
    emit('click', { source: 'primary' })
  }
  
  const handleSecondary = () => {
    emit('click', { source: 'secondary' })
  }
  
  refs('primary').addEventListener('click', handlePrimary, { signal })
  refs('secondary').addEventListener('click', handleSecondary, { signal })
}
```

### Emitting Events

- Use `emit(name, detail, options)` — not `dispatchEvent`
- Defaults to `{ bubbles: true, composed: true }` for cross-shadow-boundary events

```js
client({ emit }) {
  const notifyParent = () => {
    emit('item-selected', { id: 123, label: 'Item A' })
  }
}
```

---

## 6. State Observation

### `observe(key, callback)`

Use `observe()` to sync with external systems when state changes:

```js
client({ state, observe, signal }) {
  observe('count', (newValue) => {
    // Sync with external system - DO NOT mutate state here!
    externalApi.update(newValue)
  })
  
  observe('name', (newName) => {
    document.title = newName
  })
}
```

**CRITICAL**: Never mutate reactive state inside `observe()` callback — this causes infinite reactive loops.

---

## 7. Slots

### Slot Content Transformation (`slots` option)

Transform slot content at build/server time:

```js
slots: {
  default (content) {
    // Filter out whitespace-only text nodes
    if (typeof window !== 'undefined') return  // SSR only
    return content.filter(n => n.type !== 'text' || n.data.trim())
  },
  header (content) {
    // Transform named slot content
    return content
  }
}
```

### Runtime Slot Access (`slots` in context)

The `slots` helper in `client()` context provides access to slotted nodes:

```js
client({ slots }) {
  slots.get('default')   // Array of projected nodes (filters comments/whitespace)
  slots.has('header')    // Boolean: does a named slot have content?
  slots.count('default') // Number of projected nodes
  slots.names            // Array of available slot names
  slots.default          // Proxy shorthand for slots.get('default')
}
```

---

## 8. Styling

### Host Element Styling

- Use `:host` to target the component's root custom element
- Use `:host-context(.selector)` for theme/context-aware styles
- Do NOT write `:host .child` — write `.child` directly

```css
:host {
  display: block;
  container-type: inline-size;
}

:host(:hover) {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

:host-context(.dark) {
  background: #1a1a1a;
  color: white;
}

.child-element {
  /* Styles for elements inside the component */
}
```

### Slotted Content

- Projected children inside `<slot>` participate in parent layouts
- Compiler injects `slot, c-token { display: contents; }`
- `::slotted(element)` selectors are auto-scoped

```html
<template id="card-wrapper">
  <div class="card">
    <slot></slot>  <!-- Projected content flows into parent layout -->
  </div>
</template>
```

---

## 9. Testing & Playwright Patterns

### Locator Chaining

Target the component host element first, then chain to internal elements:

```javascript
// CORRECT Playwright locator chaining
const card = page.locator('counter-card').first()
await card.getByTestId('increment-btn').click()
await expect(card.locator('.value')).toHaveText('Count: 1')
```

### Deterministic Settlement

Wait on `updateComplete` before asserting reactive changes:

```javascript
await element.updateComplete
```

### No Brittle Selectors

Avoid structural chains like `page.locator('counter-card > div > button:nth-child(2)')`. Use:
- Static `data-testid` attributes
- Semantic accessible roles (`getByRole('button')`)

---

## 10. Diagnostic Codes & Gotchas

| Code | Cause | Remediated Pattern |
|------|-------|--------------------|
| `CORALITE-E101` | Non-primitive (`Array` or `Object`) in `attributes` | Retrieve complex data via `server()` or pass individual primitive attributes |
| `CORALITE-E102` | `required: true` combined with `default` | Remove `default` if the attribute is strictly required |
| `CORALITE-E103` | Asynchronous attribute `transform` or `validate` | Make transform and validate functions synchronous |
| `CORALITE-E105` | Non-destructured getter parameter: `(state) => ...` | Destructure context: `({ state }) => state.property` |
| `CORALITE-E201` | Non-flat identifier expression in `<template>` | Replace `{{ a + b }}` with a getter `computedSum: ({ state }) => state.a + state.b` |
| `CORALITE-E203` | Inline event attribute (e.g. `onclick="..."`) in template | Use template `ref="btn"` and bind in `client()` via `refs('btn').addEventListener(..., { signal })` |
| `CORALITE-E301` | Module-scope static import referenced inside `client()` | Use dynamic `await import(...)` inside `client()` |
| `CORALITE-E302` | State mutated inside `observe()` callback | Mutate state in event handlers or compute values via `getters`. `observe()` is for external DOM side-effects only |
| `CORALITE-E303` | Asynchronous getter function in `style` block | Make the style function synchronous: `'--color': (state) => state.color` |
| `CORALITE-PAGE-201` | Page script querying component internals | Communicate across component boundaries using declarative attributes, standard DOM events, or W3C contexts |

---

## 11. Verification Workflows

After modifying components, run the Coralite workspace AST validation suite:

```bash
# Check all components, pages, and plugins
npx coralite check

# Check components with strict diagnostics and coverage
npx coralite validate-components --strict --coverage

# Automatically apply AST fixes where safe
npx coralite fix
```

# Coralite Assistant Rules (v{{ version }})

You are working on a project built with **Coralite**, an HTML-first static site generator with isomorphic web components, fine-grained reactivity, and AST-level template validation.

---

## 1. Primary Directives

1. **Keep Component Templates "Dumb"**
   - `<template>` HTML contains **flat tokens only**: `{{ title }}`, `{{ counter }}`.
   - **NO** expressions (`{{ a + b }}`), **NO** dot paths (`{{ user.name }}`), **NO** inline event handlers (`onclick="..."`).
   - Derived values belong in synchronous derived getters (`getters: { ... }`).

2. **Respect the Serialization Boundary**
   - The `client()` method is stringified and shipped to the browser.
   - **DO NOT** reference top-level imports, outer-scope variables, or Node built-ins inside `client()`.
   - Dynamic imports inside `async client()` are fine (`await import(...)`), or pass config via component options.

3. **Attribute Types Are Primitives**
   - Attributes strictly support `String`, `Number`, and `Boolean`.
   - `Array` and `Object` attributes are forbidden to prevent state pollution. Pass objects via `server()` or manage them in internal `state`.

4. **Isomorphic Component Lifecycle**
   - `server({ state, options, page })` runs at build time on Node.js.
   - `client({ state, root, refs, slots, signal, emit })` runs in the browser.
   - Derived `getters` run synchronously on both sides. Keep them side-effect-free.

---

## 2. Component Layout Standard

Component files (`src/components/*.html`):

```html
<template id="my-card">
  <div class="card">
    <h3>{{ formattedTitle }}</h3>
    <slot name="body"></slot>
    <button ref="btn">Click me</button>
  </div>
</template>

<style>
  .card { padding: 1rem; border: 1px solid #ccc; }
</style>

<script type="module">
  import { defineComponent } from 'coralite'

  export default defineComponent({
    attributes: {
      title: String,
      disabled: Boolean
    },

    getters: {
      formattedTitle ({ state }) {
        return (state.title || '').toUpperCase()
      }
    },

    server ({ state }) {
      if (!state.title) state.title = 'Default Title'
    },

    client ({ refs, signal }) {
      refs('btn')?.addEventListener('click', () => {
        alert('Clicked!')
      }, { signal })
    }
  })
</script>
```

---

## 3. Preferred CLI Workflows

- Run `npx coralite check` after editing components or pages to run AST-level diagnostics.
- Run `npx coralite fix` to auto-repair fixable AST issues (e.g., unused refs, incorrect getter context destructuring).

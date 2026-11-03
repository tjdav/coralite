# Coralite CSS Scoping & Styling Reference

> Light DOM CSS scoping, `@layer`, `:host` styling, and dynamic CSS custom properties.

## 1. Light DOM Architecture

Coralite components render in the Light DOM rather than Shadow DOM. Scoping and style isolation are handled via compile-time CSS scoping, PostCSS, and native Cascade Layers:

1. Component styles inside `<style>` are automatically wrapped in `@layer components`.
2. Unlayered utility classes (e.g. Tailwind or custom utility stylesheets) override component styles with zero specificity conflicts.
3. Host element styles are scoped to `:where(tag-name)` to add zero specificity.

## 2. Host Styling Rules

* Use `:host` to target the custom element itself.
* Use `:host-context(.selector)` or `:host(.selector)` for variant or theme-based styling.
* Do **not** write `:host .child`. Write `.child` directly.

```css
<style>
  :host {
    display: block;
    margin: 1rem 0;
  }

  :host-context(.dark) {
    background: #0f172a;
    color: #f8fafc;
  }

  .card-body {
    padding: 1.5rem;
  }
</style>
```

## 3. Dynamic Styles (`export const style = { ... }`)

Map CSS custom properties (`--*`) or standard properties to synchronous getter functions:

```javascript
export const style = {
  // Destructured context ({ state, isServer, signal })
  '--accent-color': ({ state }) => (state.active ? '#3b82f6' : '#94a3b8'),
  '--padding-size': ({ state }) => `${state.padding}px`,
  display: ({ state }) => (state.hidden ? 'none' : 'block'),
  opacity: ({ state }) => state.opacity // numeric 0 is preserved
}
```

* **Context parameter**: You can write destructured `({ state }) => ...` or unified context `(context) => context.state.prop`. Writing `(state) => state.prop` binds `state` to the context object, evaluating to `undefined` (`CORALITE-E105`).
* **Synchronous Only (`CORALITE-E303`)**: Returning a Promise throws a `CoraliteError`.

## 4. Slot Layout Transparency (`display: contents`)

The compiler automatically emits `slot, c-token { display: contents; }` outside `@layer components`. Slotted Light DOM children participate directly in parent Flexbox or CSS Grid layouts without box interruption.

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

## 5. Lazy Dependency Stylesheets (`await import('*.css')`)

Third-party libraries and heavy client widgets often ship global CSS that should only load when the component or page mounts. Use native ECMAScript dynamic `await import()` inside component or page `client()` blocks (or transitive client `.js` helper modules):

```html
<template id="venue-map">
  <div class="leaflet-container" ref="map"></div>
</template>

<script type="module">
  export async function client ({ refs, signal }) {
    const [{ default: sheet, link }, L] = await Promise.all([
      import('leaflet/dist/leaflet.css', { media: 'screen', signal }),
      import('leaflet')
    ])
    L.map(refs('map'))
  }
</script>
```

* **Build-Time Bundling**: Local relative (`./map.css`), absolute, and bare npm package (`leaflet/dist/leaflet.css`) specifiers resolve from the importing file and are bundled at build time via esbuild + PostCSS into hashed `assets/css/[name]-[hash].css` files (rewriting `@import` and relative `url()` assets). No `<link>` is emitted during SSR.
* **Global & Unscoped**: Dependency stylesheets are injected as global `<link rel="stylesheet">` tags in `<head>` in deterministic manifest order, independent of network completion timing. Multiple components importing the same resolved stylesheet share a single bundled asset and `<link>` element.
* **Remote URLs**: Remote `http(s)://` or `//` stylesheet URLs pass through to the browser runtime without build-time bundling.
* **Options (2nd Argument)**: Supports both flat options (`{ media, nonce, crossorigin, referrerPolicy, signal, force }`) and standard Import Attributes (`{ with: { type: 'css', media, nonce, crossorigin, referrerPolicy }, signal, force }`).
* **Return Value**: Resolves on browser `load` to `{ default: link.sheet ?? null, link }`. Aborting `signal` stops waiting for the caller without removing the shared `<link>`. Pass `{ force: true }` to retry a previously failed load.
* **Diagnostics**:
  * `CORALITE-E109`: Thrown if `.css` is imported via top-level static `import`, inside `server()` / `getters` / `style` / `slots` / `paths` / `onError`, or with unsupported option keys/types.
  * `CORALITE-E403`: Thrown if a local or package `.css` specifier cannot be resolved on disk at build time.

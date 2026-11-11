# Coralite Plugins Reference

> Extending the compile-time and runtime lifecycles of Coralite using `definePlugin`.

## 1. Plugin Anatomy

Plugins are declared with `export default definePlugin({ ... })`:

```javascript
import { definePlugin } from 'coralite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default definePlugin({
  name: 'my-custom-plugin',
  rootDir: __dirname,
  filePath: fileURLToPath(import.meta.url),

  // Two-phase curried context resolver
  context: (pluginContext) => (instanceContext) => ({
    formatDate: (timestamp) => new Date(timestamp).toLocaleDateString()
  }),

  // Server lifecycle hooks
  server: {
    async onBeforeBuild ({ app }) {
      // Build setup, register virtual modules, prepare assets
    },
    async onAfterBuild ({ app }) {
      // Post-build processing (e.g., sitemap, RSS feed, search indexing)
    }
  },

  // Client lifecycle hooks
  client: {
    init: `
      // Injected client initialization code
    `
  }
})
```

## 2. Invariants

1. **Two-Phase Context Resolvers**:
   * If a plugin injects helper methods or properties into component contexts that depend on instance state, the `context` function MUST be curried:
     `(pluginContext) => (instanceContext) => ({ ... })`
2. **Mutual Exclusivity (`CORALITE-P211`)**:
   * A plugin must specify either ubiquitous top-level `context` (for synchronous ambient helpers across all blocks) OR environment-specific `server.context` / `client.context`. Combining top-level `context` with `server.context` or `client.context` throws `CORALITE-P211`.
3. **Explicit `rootDir` and `filePath`**:
   * Supplying `rootDir` and `filePath` ensures compiler diagnostic reports and AST auto-fixers map errors directly to physical files on disk.
4. **No Bare Objects**:
   * Plugins must always be wrapped with `definePlugin(...)` for static verification and type inference.

## 3. Context Injection Targets & Getter Invariant

Plugin context properties are injected into Component and Page handlers:

- **Top-Level `context` (Ubiquitous Ambient Context)**:
  - Injected synchronously across **all** component and page execution blocks: `server()`, `getters`, `client()`, `slots`, and `style`.
- **Environment-Specific Handlers**:
  - `server.context` is injected into Component `server({ ...plugins, ...props, route, state, store })` and Page `definePage({ server })`.
  - `client.context` is injected into Component `client({ ...plugins, refs, signal, state, store, ... })` and Page `definePage({ client })`.
- **Reserved Key Precedence**:
  - Reserved framework keys (`state`, `route`, `app`, `session`, `signal`, `store`, `page`) are guaranteed and take precedence over plugin keys. Collisions trigger a warning in dev/test mode.
- **Getter Isomorphism Invariant**:
  - Getters strictly receive `{ state, route, root, refs, slots, signal, isServer, store }` plus any ambient utilities provided by top-level plugin `context` (e.g. `({ state, $t })`).
  - **Getters NEVER receive environment-specific plugin context** (`server.context` or `client.context`). Getters are isomorphic and evaluate synchronously during both SSR and reactive browser state updates.
  - To use data from `server.context` in getters: call the plugin in `server()`, write to `state`, and read from `state` in getters.

### Imperative Custom Elements

Client-side plugin functions may create custom elements with `document.createElement()` or HTML assignment. Coralite rewrites these calls to its on-demand component loader, so the component bundle is loaded and upgraded without a manual `loadComponent()` call:

```javascript
import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'widgets',
  client: {
    context: () => (instanceContext) => ({
      create (container) {
        const child = document.createElement('my-widget')
        container.appendChild(child)
        container.insertAdjacentHTML('beforeend', '<my-widget></my-widget>')
      }
    })
  }
})
```

This applies to plugin `client.context` phase 2, `client.init`, client lifecycle hooks, and component/page `client()` blocks. Phase 1 runs before the component loader is ready; create elements in phase 2 or `client.init`.

- **Scanned:** component/page `client()`, plugin `client.context`, `client.init`, and client lifecycle hooks.
- **Not scanned:** dynamically imported helper modules. Keep them pure or use `window.__coralite__.dom.createElement(tag)` / `await window.__coralite__.dom.loadComponent(tag)`.
- **Literal tags:** preferred because `document.createElement('my-widget')` is recorded during the build. Dynamic tags may not appear in page metadata.
- **Dependencies:** `dependencies` controls plugin registration order and cross-plugin availability, not custom-element tracking.
- **Production:** development and testing patch DOM APIs; production does not. Add a production-build smoke test for imperative components.
- **Refs:** phase-2 context and lifecycle hooks scope injected refs by `instanceId`, with target-owner fallback. A new ref still needs a matching `state.ref_<name>` to resolve through `refs()`.

Canonical reference: https://coralite.dev/docs/reference/imperative-components.html

## 4. Testing Plugins

1. Register the plugin under `plugins: [...]` in `coralite.config.js`.
2. Author testing fixtures under `tests/fixtures/pages/` or `tests/fixtures/components/`.
3. In tests, invoke `createCoralite({ plugins: [...] })` or mount fixture routes (`/__fixtures__/<name>`).
4. In `mode: 'testing'`, override resolved context methods with `testing.mocks.plugins`. Mocks shallow-merge over the real Phase 2 result; the real Phase 1/Phase 2 functions still run. Use a stub plugin for full isolation or top-level `context`.
5. For focused unit tests, inject a plugin-shaped object via `loadComponent(path, { context })` or `loadPage(path, { context })`; this bypasses plugin setup.

## 5. Built-In Plugins

Coralite ships core plugins importable from `coralite/plugins/*` (metadata, static assets, testing, SPA router). The normative SPA router contract — registration, outlet semantics, `navigate`/`current`/`beforeEach` guard API, navigation events, head reconciliation, hydration re-store, and View Transitions interplay — is documented in `llms-full.txt` §10 "Built-In Plugins" and §10.1 "SPA Router (`coralite/plugins/router`)". Router config options include `base`, `outlet`, `autoWrap` (default `true`; set `false` to disable automatic body wrapping), and `outletOnly` (default `false`; when `true`, links on outlet-less pages use native browser navigation). Dedicated pages: [Router Plugin Reference](https://coralite.dev/docs/reference/plugins/router.html) and [SPA Router Guide](https://coralite.dev/docs/guide/spa-router.html).

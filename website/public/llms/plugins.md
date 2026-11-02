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
2. **Explicit `rootDir` and `filePath`**:
   * Supplying `rootDir` and `filePath` ensures compiler diagnostic reports and AST auto-fixers map errors directly to physical files on disk.
3. **No Bare Objects**:
   * Plugins must always be wrapped with `definePlugin(...)` for static verification and type inference.

## 3. Context Injection Targets & Getter Invariant

Plugin context properties are injected into Component and Page handlers:

- **Server Handlers**:
  - Components: `export function server ({ ...plugins, ...props, route, state, store })`
  - Pages: `export default definePage({ server ({ ...plugins, route, app, session, signal, store, page }) })`
- **Client Handlers**:
  - Components: `export function client ({ ...plugins, refs, signal, state, store, ... })`
  - Pages: `export default definePage({ client ({ ...plugins, route, state, signal, ... }) })`
- **Reserved Key Precedence**:
  - Reserved framework keys (`route`, `app`, `session`, `signal`, `store`, `page`) are guaranteed and take precedence over plugin keys. Collisions trigger a warning in dev/test mode.
- **Getter Isomorphism Invariant**:
  - Getters strictly receive `{ state, route, root, refs, slots, signal, isServer, store }`.
  - **Getters NEVER receive plugin context**. Getters are isomorphic and run synchronously during both SSR and reactive browser state updates.
  - To use plugin data in getters: call the plugin in `server()`, write to `state`, and read from `state` in getters.

## 4. Testing Plugins

1. Register the plugin under `plugins: [...]` in `coralite.config.js`.
2. Author testing fixtures under `tests/fixtures/pages/` or `tests/fixtures/components/`.
3. In tests, invoke `createCoralite({ plugins: [...] })` or mount fixture routes (`/__fixtures__/<name>`). Mocks can be passed directly via the plugin context resolver.

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

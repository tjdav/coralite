# 🪸 Coralite

## Build for the Web, With the Web

Coralite is a powerful **Isomorphic Web Component Framework** designed to build fast, interactive single-page applications (SPAs), dynamic websites, and static sites. It seamlessly blends the initial load speed of Server-Side Rendering (SSR) with robust, high-performance client-side hydration, giving you total flexibility over your rendering strategy using standard Web Components.

### Why Coralite?

Coralite stands out by actively fixing the most frustrating pain points of modern web development:

* **True Native Web Components (Without the Boilerplate)**
  Abandon verbose `class extends HTMLElement` boilerplate. Coralite uses a clean, ergonomic `defineComponent` flat-options API (`attributes`, `server`, `getters`, `style`, `client`, `slots`) that outputs true native Custom Elements.
* **Scoped CSS without Shadow DOM**
  Shadow DOM notoriously breaks global CSS systems and creates accessibility barriers. Coralite completely bypasses this by using compiler-generated instance identifiers to perfectly scope your CSS in the Light DOM.
* **Isomorphism Built-In (The Vanishing `server` Block)**
  Fetch database or API records in the `server()` block during SSR. Coralite automatically serializes that data, hydrates it seamlessly into a unified reactive state on the client, and safely strips the `server()` code entirely from your browser bundle.
* **Opt-Out Hydration**
  For purely static sections, simply append the `no-hydration` attribute to your HTML tag. Coralite will render it on the server but skip client-side hydration completely, keeping your JavaScript bundle incredibly lean.
* **Declarative Reactive Styling (`style`)**
  Define reactive inline styles and CSS Custom Properties (`--*`) directly in component definitions with automatic kebab-case mapping and zero-cost SSR emission.
* **Reactive Slot Transformations (`slots`)**
  Intercept and transform slotted children into rich AST structures or reactive DOM projections with built-in fine-grained state observation.
* **The "Smart State, Dumb Template" Paradigm**
  Say goodbye to spaghetti code. Templates are strictly declarative—no logic loops, inline expressions, or dot-notation allowed. All UI logic resides in pure, synchronous JavaScript `getters` which map cleanly to native HTML attributes.
* **O(1) Microtask Reactivity (No Virtual DOM)**
  Mutate state in the `client()` controller block, and Coralite automatically schedules surgical DOM updates in the next microtask queue with O(1) precision via a compiler-generated hydration map.
* **Async Race-Condition Immunity**
  Coralite’s reactive engine handles asynchronous data with built-in version locks, ensuring your DOM never renders stale data from out-of-order Promise resolutions.

---

## Quick Start

The easiest way to start a new Coralite project is to use the official scaffolding tool. This sets up your directory structure, installs dependencies, and configures ready-to-run npm scripts automatically.

```bash
npm create coralite@latest my-coralite-app
cd my-coralite-app
npm run start
```

#### Key Features

* **Live Reload** - Automatic browser refresh on HTML, template, and asset changes.
* **Hot CSS Updates** - Instant CSS injection without page refresh via Server-Sent Events.
* **Sass/SCSS Support** - Compile Sass files with source maps and auto-prefixing.
* **File Watching** - Monitors all source directories for changes.
* **Production Optimization** - Clean builds with optimized output.
* **Plugin Integration** - Full support for Coralite plugins.

> Learn more about the scaffolding process in the [Coralite scripts reference](https://coralite.dev/docs/reference/coralite-scripts.html).

---

## AI-Assisted Development (`llms.txt`)

Coralite includes an authoritative, zero-token [`llms.txt`](https://coralite.dev/llms.txt) specification in the root of the published npm package (`node_modules/coralite/llms.txt`).

When using modern AI coding assistants (Claude Code, Cursor, GitHub Copilot, Antigravity, Jules), the model automatically discovers Coralite's specific architectural invariants (dumb templates, serialization boundaries, two-phase plugins, isomorphic state proxy), ensuring accurate, hallucination-free code generation.

---

## Code Quality & Static Auditing

Coralite includes built-in static analysis and self-healing tools to audit and fix your code across Components, Plugins, and Pages:

```bash
# Run multi-domain workspace audit
npx coralite check

# Preview self-healing AST auto-fixes without writing to disk
npx coralite fix --dry-run

# Apply deterministic AST auto-fixes in-place
npx coralite fix
```

### Auditing Commands

* **`coralite check`**: Audits template syntax, unreferenced getters/server props, encapsulation rules, and unknown custom elements.
* **`coralite fix`**: Automatically resolves AST anti-patterns, lifts expressions to getters, rewrites client dynamic imports, and fixes plugin definitions.
* **`coralite validate-components`**: Statically audits component templates, refs, CSS selectors, and script blocks.
* **`coralite validate-plugins`**: Validates plugin contracts, lifecycle hooks, and isomorphic boundary compliance.
* **`coralite validate-pages`**: Validates page HTML against component schemas and encapsulation rules.

---

## Manual Installation & Compiler CLI

If you are adding Coralite to an existing project or building from scratch manually, install the core package:

```bash
npm install coralite
```

Coralite ships with a built-in CLI to manage direct build operations:

```bash
npx coralite [options]
```

### Required CLI Options

* **`-c` or `--components`**: The path to your components directory (e.g., `-c src/components`).
* **`-p` or `--pages`**: The path to your pages directory (e.g., `-p src/pages`).
* **`--output` or `-o`**: The output directory for the generated site (e.g., `--output dist`).

### Additional CLI Options

* **`-m` or `--mode`**: Build mode: `development`, `production`, or `testing` (defaults to `production`).
* **`-i` or `--ignore-attribute`**: Ignore elements by attribute name value pair (format: `key=value`).
* **`-s` or `--skip-render-attribute`**: Parse elements but exclude them from final render output.
* **`-d` or `--dry-run`**: Preview the actions that would be performed without generating output.
* **`-a` or `--assets`**: Static assets to copy. Format: `pkg:path:dest` (or `pkg:path`).

---

## Configuration (`defineConfig`)

Coralite uses a `coralite.config.js` file at the root of your project. We provide a `defineConfig` helper to give you full IDE autocomplete and type safety.

```javascript
import { defineConfig } from 'coralite'
import myCustomPlugin from './plugins/my-plugin.js'

export default defineConfig({
  pages: './src/pages',
  components: './src/components',
  output: './dist',
  plugins: [
    myCustomPlugin()
  ]
})
```

---

## Building Components (`defineComponent`)

Coralite components are single-file HTML modules containing a `<template>`, an optional `<style>`, and a `<script type="module">`.

> Notice how the HTML template remains strictly declarative, reading flat properties from the unified state proxy, while all complex logic is pushed into the `getters` block.

**`src/components/user-card.html`**

```html
<template id="user-card">
  <h2 ref="title">{{ formatName }}</h2>
  <p>{{ userMeta }}</p>
  
  <slot></slot>
  
  <p class="stats">Logins: {{ loginCount }}</p>
  <p class="warning" hidden="{{ hideWarning }}">High Activity User</p>
</template>

<style>
  /* Preferred: Style the root custom element container */
  :host {
    display: block;
    border: 1px solid #eaeaea;
    padding: 1.5rem;
    border-radius: 8px;
  }

  /* Internal elements are automatically scoped (:host not required) */
  h2 { color: coral; }
  .warning { color: red; font-weight: bold; }
</style>

<script type="module">
  import { defineComponent } from 'coralite'
  import { userService } from './services.js'

  export default defineComponent({
    // ATTRIBUTES: Public API, coerced from HTML (String, Number, Boolean)
    attributes: {
      userId: { type: Number, default: 0 },
      role: { type: String, default: 'Guest' },
      theme: { type: String, default: 'light' }
    },

    // SERVER: Async server-side initialization (Stripped from client bundle!)
    async server({ state }) {
      const user = await userService.getById(state.userId)
      return {
        firstName: user.firstName,
        lastName: user.lastName,
        loginCount: user.loginCount
      }
    },

    // GETTERS: Pure, sync derived state mapping to the Dumb Template
    getters: {
      formatName: (state) => `${state.firstName} ${state.lastName}`.trim(),
      userMeta: (state) => `Role: ${state.role} | ID: ${state.userId}`,
      hideWarning: (state) => state.loginCount < 50 // Logic stays out of HTML
    },

    // STYLE: Declarative reactive inline CSS and custom properties on host
    style: {
      '--accent-color': (state) => state.theme === 'dark' ? '#38bdf8' : '#0284c7'
    },

    // SLOTS: Transform or build projected slot content
    slots: {
      default: (nodes, { state }) => nodes
    },

    // CLIENT: Client-side controller and side-effects
    client({ state, refs, signal }) {
      const titleEl = refs('title')

      // Bind events with the 'signal' for automatic garbage collection
      titleEl.addEventListener('click', () => {
        // Direct mutations automatically trigger O(1) DOM updates
        state.loginCount++
      }, { signal }) 
    }
  })
</script>
```

---

## Extending the Engine (`definePlugin`)

Coralite features a strictly isomorphic plugin architecture where plugins are divided into `server` (Node.js/Build) and `client` (Browser/Runtime) blocks.

Both layers utilize a **Two-Phase Curried Context** pattern `(pluginContext) => (instanceContext) => ({ ... })` that provides a clear separation between global setup and instance-scoped execution:

1. **Phase 1: Global Setup (`pluginContext`)**: Runs **once** during framework/plugin registration. Use this to initialize shared resources (e.g. database pools, in-memory caches, global event buses). Properties attached to `pluginContext` are shared across the entire server build or client runtime.
2. **Phase 2: Instance Resolver (`instanceContext`)**: Runs for **each component instance**. Receives instance metadata (`instanceId`, `componentId`, `page`, `root`) and allows lazy cross-plugin resolution. The returned object is automatically injected into that component's `server()` or `client()` block under the plugin's namespace.

```javascript
import { definePlugin } from 'coralite'

export default function telemetryPlugin(options = {}) {
  return definePlugin({
    name: 'telemetry', // Namespaces the context in components: context.telemetry

    server: {
      // Phase 1 (pluginContext): Runs ONCE on server startup
      // Phase 2 (instanceContext): Runs per component to inject instance-scoped APIs
      context: (pluginContext) => {
        const buildMetrics = new Map()
        pluginContext.metrics = buildMetrics // Shared globally across server plugins

        return (instanceContext) => ({
          trackServerEvent: (name, data = {}) => {
            buildMetrics.set(`${instanceContext.componentId}:${instanceContext.instanceId}`, {
              event: name,
              route: instanceContext.page?.url,
              timestamp: Date.now(),
              ...data
            })
          }
        })
      }
    },

    client: {
      // Phase 1 (pluginContext): Initializes shared client resources (e.g. centralized EventBus)
      // Phase 2 (instanceContext): Injects instance-scoped tracking tagged with component metadata
      context: (pluginContext) => {
        const sharedBus = new EventTarget()
        pluginContext.bus = sharedBus // Shared across all component instances in browser

        return (instanceContext) => ({
          emitEvent: (type, detail = {}) => {
            sharedBus.dispatchEvent(new CustomEvent(type, {
              detail: {
                ...detail,
                originId: instanceContext.instanceId,
                originTag: instanceContext.componentId
              }
            }))
          },
          onEvent: (type, handler) => {
            sharedBus.addEventListener(type, handler)
          }
        })
      }
    }
  })
}
```

### Consuming Plugin Context in Components

Components access the injected APIs directly via destructuring in `server()` and `client()`:

```html
<script type="module">
  import { defineComponent } from 'coralite'

  export default defineComponent({
    async server({ telemetry, state }) {
      // Sourced from server Phase 2 resolver
      telemetry.trackServerEvent('user_rendered', { userId: state.userId })
      return {}
    },

    client({ telemetry, state, signal }) {
      // Sourced from client Phase 2 resolver
      telemetry.onEvent('cart:updated', (e) => {
        console.log('Cart updated from component', e.detail.originTag)
      })

      telemetry.emitEvent('item_viewed', { itemId: state.userId })
    }
  })
</script>
```

---

## Contributing

We welcome community contributions! Coralite is managed as a monorepo.

### 1. Prerequisites

* **Node.js** v20.19.0 or higher (Node.js v24 LTS recommended)
* **pnpm** v11+

### 2. Fork & Clone

```bash
git clone https://codeberg.org/tjdavid/coralite.git
cd coralite
```

### 3. Install Dependencies

Run the installation from the root directory. pnpm will automatically link the local packages together:

```bash
pnpm install
```

### 4. Run Tests & Benchmarks

Before submitting a Pull Request, ensure your changes pass all tests and haven't caused performance regressions:

```bash
cd packages/coralite

# Run the unit test suite
pnpm run test:unit

# Run the strict deterministic E2E test suite
pnpm run test:e2e

# Run the performance benchmarks
pnpm run bench
```

## Documentation

For a deep dive into advanced features, imperative slot rendering, end-to-end testing strategies, and full API references, check out the [official documentation](https://coralite.dev/docs/guide/getting-started.html).

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](https://codeberg.org/tjdavid/coralite/src/branch/main/LICENSE) file for details.
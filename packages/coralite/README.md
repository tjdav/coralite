# 🪸 Coralite

## Build for the Web, With the Web

Coralite is a static-first Web Component framework that compiles HTML modules into static HTML at build time with zero client JavaScript by default. When interactivity or dynamic data is required, Coralite progressively adds server-side rendering (SSR), fine-grained client-side hydration, and single-page application (SPA) routing using standard native Web Components.

### Key Features

* **Static HTML by Default**: Components without client logic emit pure static HTML and scoped CSS at build time with zero browser JavaScript overhead.
* **Native Web Components via Named Exports**: Author components in `.html` files using standard ES module exports (`export const`, `export function`) rather than boilerplate class syntax.
* **Light DOM Scoped CSS**: Scoped styling using compiler-generated instance identifiers and CSS `@layer` without requiring Shadow DOM boundaries.
* **Isomorphic Server Execution**: Fetch data or compute state at build/SSR time in `server()`. Initial state serializes to the client while server code is stripped from the browser bundle.
* **Opt-Out Hydration**: Mark components with `no-hydration` to render markup statically and bypass client runtime hydration entirely.
* **Declarative Reactive Styling (`style`)**: Define reactive inline styles and CSS Custom Properties (`--*`) directly in component declarations with zero-cost SSR emission.
* **Reactive Slot Transformations (`slots`)**: Intercept and project slotted children isomorphically across SSR and client updates.
* **Declarative Templates & Pure Getters**: Templates read flat tokens (`{{ token }}`) while UI transformations live in pure, synchronous getter functions.
* **Microtask DOM Reactivity**: Mutate state in `client()` controllers and Coralite schedules batched DOM updates in the microtask queue without a virtual DOM.
* **Async Race-Condition Protection**: Built-in version locks ensure stale asynchronous promise resolutions never overwrite newer state.

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

When using modern AI coding assistants (Claude Code, Cursor, GitHub Copilot, Antigravity, Jules), the model automatically discovers Coralite's specific architectural invariants (dumb templates, serialization boundaries, two-phase plugins, isomorphic state proxy, imperative component tracking), ensuring accurate, hallucination-free code generation.

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

## Building Components (Named Exports)

Coralite components are single-file HTML modules containing a `<template>`, an optional `<style>`, and a `<script type="module">`. Behavior is defined through top-level named exports (`export function`, `export const`).

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
  import { userService } from './services.js'

  // ATTRIBUTES: Public API, coerced from HTML (String, Number, Boolean)
  export const attributes = {
    userId: { type: Number, default: 0 },
    role: { type: String, default: 'Guest' },
    theme: { type: String, default: 'light' }
  }

  // SERVER: Async server-side initialization (Stripped from client bundle!)
  export async function server ({ state }) {
    const user = await userService.getById(state.userId)
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      loginCount: user.loginCount
    }
  }

  // GETTERS: Pure, sync derived state mapping to the Dumb Template
  export const getters = {
    formatName: ({ state }) => `${state.firstName} ${state.lastName}`.trim(),
    userMeta: ({ state }) => `Role: ${state.role} | ID: ${state.userId}`,
    hideWarning: ({ state }) => state.loginCount < 50
  }

  // STYLE: Declarative reactive inline CSS and custom properties on host
  export const style = {
    '--accent-color': ({ state }) => state.theme === 'dark' ? '#38bdf8' : '#0284c7'
  }

  // SLOTS: Transform or build projected slot content
  export const slots = {
    default: (nodes) => nodes
  }

  // CLIENT: Client-side controller and side-effects
  export function client ({ state, refs, signal }) {
    const titleEl = refs('title')

    // Bind events with the 'signal' for automatic garbage collection
    titleEl.addEventListener('click', () => {
      // Direct mutations schedule DOM updates in the next microtask
      state.loginCount++
    }, { signal }) 
  }
</script>
```

### Computed Slots & Isomorphic DOM Compatibility

Computed slots (`slots: { [name]: (nodes, context) => ... }`) run during both Server-Side Rendering (SSR) and client runtime state updates:

* **First-Class DOM Compatibility on Server**: Coralite equips server-side AST nodes with a full DOM-emulation layer. Properties such as `node.textContent`, `node.nodeType`, `node.childNodes`, `node.getAttribute()`, `node.hasAttribute()`, `node.tagName`, and `node.classList` are fully supported on the server.
* **Write Standard DOM Code**: Because of this compatibility layer, you do **not** need to branch on server-specific AST properties (like `.data` or `.type`). Writing standard DOM operations like `nodes.map(n => n.textContent).join('')` or checking `node.nodeType === 1` runs 100% isomorphically across both Node.js SSR and the browser.
* **Hydration Parity**: Server-rendered computed slots are marked with `data-coralite-slot-computed` during SSR. During initial client hydration, Coralite preserves the server-rendered markup without redundant re-evaluation—preventing double transformations on non-idempotent slot functions (e.g. `X!` -> `X!!`) and eliminating Cumulative Layout Shifts (CLS). Live projected node references are stored in `slotEl._originalNodes` so subsequent client state mutations re-evaluate against the live projected nodes directly, ensuring owner component bindings remain attached and reactive.
* **Environment Boundaries**: Slot transformers should avoid browser-only layout APIs (`getBoundingClientRect()`, `offsetWidth`) or DOM event listeners (`addEventListener()`), as these require an active browser rendering engine. Return HTML strings, DOM nodes, or `undefined` (to preserve original slotted content).

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
  // Sourced from server Phase 2 resolver
  export async function server ({ telemetry, state }) {
    telemetry.trackServerEvent('user_rendered', { userId: state.userId })
    return {}
  }

  // Sourced from client Phase 2 resolver
  export function client ({ telemetry, state, signal }) {
    telemetry.onEvent('cart:updated', (e) => {
      console.log('Cart updated from component', e.detail.originTag)
    })

    telemetry.emitEvent('item_viewed', { itemId: state.userId })
  }
</script>
```

### Imperative Custom Elements and Shared Helpers

Shared DOM factories belong in a plugin's `client.context` / `client.init` or in component/page `client()` code. Coralite AST-scans those client functions, rewrites `document.createElement`, `innerHTML`, `outerHTML`, and `insertAdjacentHTML` to its on-demand component loaders, and records literal custom-element tags in page/component dependency metadata.

```javascript
import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'eventCards',
  client: {
    context: () => (instanceContext) => ({
      createCard (event) {
        const card = document.createElement('event-card')
        card.setAttribute('event-id', event.id)
        card.setAttribute('label', event.title)
        return card
      }
    })
  }
})
```

Use a literal tag when the component should be tracked during the build. Dynamic tag expressions also lazy-load at runtime, but the concrete component may not be recorded in page metadata.

Do not move custom-element creation into a dynamically imported helper module. Those modules are bundled but not scanned. Keep helpers pure or use `window.__coralite__.dom.createElement(tag)` / `await window.__coralite__.dom.loadComponent(tag)` when DOM creation is unavoidable. `dependencies` controls plugin registration order, not custom-element tracking. Phase 1 of `client.context` runs before the loader is ready; create elements in phase 2 or `client.init`.

See the [Imperative Components Reference](https://coralite.dev/docs/reference/imperative-components.html) for creation paths, scan boundaries, runtime APIs, upgrade timing, ownership, styling, testing, and troubleshooting.

---

## Contributing

We welcome community contributions! Coralite is managed as a monorepo.

### 1. Prerequisites

* **Node.js**: >=22.22.2 (ESM native)
* **pnpm**: v11+

### 2. Fork & Clone

```bash
git clone git@github.com:tjdav/coralite.git
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

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](https://github.com/tjdav/coralite/blob/main/LICENSE) file for details.

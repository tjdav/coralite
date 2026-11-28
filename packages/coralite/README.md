# 🪸 Coralite

## Build for the Web, With the Web

Coralite compiles HTML modules into static HTML at build time. Components with no client lifecycle code emit pure markup and scoped CSS — no browser JavaScript runs for them. When a page needs interactivity, Coralite adds SSR, fine-grained hydration and optional SPA routing using real Web Components.

## Why Coralite

* **Deterministic and fail-fast.** Validation runs before output is written, builds fail on the first error by default, and diagnostics are stable, machine-readable and auto-fixable where safe. The same input produces the same output.
* **Native-first.** Real `customElements`, Light DOM, CSS `@layer` scoping and standard ES modules. Templates are flat `{{ token }}` placeholders; all logic lives in named exports — no proprietary template language.
* **Optimized for humans and AI assistants.** Flat templates, named exports, explicit serialization boundaries and `AGENTS.md` conventions make the code easy to read and easy for models to generate correctly. `coralite init-agent` scaffolds agent rules, and published packages include `llms.txt` and `llms-full.txt`.
* **Rapid development.** One CLI covers `dev`, `build`, `test`, `check`, `fix` and `diagnostics`. File watching with SSE reload, incremental rebuilds and deterministic fixers keep the feedback loop short.
* **Performance by default.** Static components ship no client lifecycle code, hydration is opt-out per element, and incremental builds reuse unchanged output. In a 2,000-page benchmark, a warm build went from 425 ms to 110 ms once unchanged pages could skip SSR work ([results](../../benchmarks/results/bench-01-build-performance-after.json)).

> Guides: [getting started](https://coralite.dev/docs/guide/getting-started/) · [reference](https://coralite.dev/reference/)

---

## Quick Start

The easiest way to start a new Coralite project is to use the official scaffolding tool. This sets up your directory structure, installs dependencies, and configures ready-to-run npm scripts automatically.

```bash
npm create coralite@latest my-coralite-app
cd my-coralite-app
npm run dev
```

#### What the dev workflow gives you

* **File watching with automatic browser reload** over pages, components and assets (SSE).
* **Sass/SCSS support** in the scaffold, with source maps and auto-prefixing.
* **Incremental production builds** into the configured `output` directory.
* **Plugin integration** across components, pages and plugins.

> Learn more about the scaffolding process in the [Quick Start guide](https://coralite.dev/docs/guide/quick-start/) and the [CLI reference](https://coralite.dev/reference/cli/).

---

## AI-Assisted Development (`llms.txt`)

Coralite ships an authoritative [`llms.txt`](https://coralite.dev/llms.txt) specification alongside `llms-full.txt` in the published npm package (`node_modules/coralite/llms.txt`). In this repository the sources live in `website/public/` and are copied into the package at publish time.

When using modern AI coding assistants (Claude Code, Cursor, GitHub Copilot, Antigravity, Jules), the model automatically discovers Coralite's specific architectural invariants (dumb templates, serialization boundaries, two-phase plugin context, signal-backed state, imperative component tracking), ensuring accurate, hallucination-free code generation.

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
* **`coralite diagnostics`**: Lists every diagnostic code with severity, auto-fix availability and guidance. Supports `--family`, `--severity`, `--fixable`, `--search` and `--format json` for tooling and CI. Also available as `DIAGNOSTIC_CATALOG` from the package root.

---

## Manual Installation & CLI

If you are adding Coralite to an existing project or building from scratch manually, install the core package:

```bash
npm install coralite
```

The `coralite` binary resolves `coralite.config.js` from the current directory upward, so commands need no path arguments in a standard project:

| Command | Purpose |
| :--- | :--- |
| `coralite dev` | Development server with incremental rebuilds |
| `coralite build` | Production build into the configured `output` directory (`dist/` in scaffolds) |
| `coralite test` | Deterministic build served for E2E tests |
| `coralite check` | Unified validation across components, pages, and plugins |
| `coralite fix` | Apply safe AST auto-fixes (`--dry-run` to preview) |
| `coralite diagnostics` | List every diagnostic code and its metadata |
| `coralite init-agent` | Scaffold `AGENTS.md` and AI IDE config aliases |
| `coralite validate-*` | Scope validation to components, pages, or plugins |

`dev`, `build`, and `test` share `--clean`, `--verbose`, `--no-incremental`, and `--assets`. See the [CLI reference](https://coralite.dev/reference/cli/) for filters, type-check flags, exit codes, and the diagnostic catalogue.

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

> Notice how the HTML template remains strictly declarative, reading flat properties from signal-backed state, while all complex logic is pushed into the `getters` block.

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
  // ATTRIBUTES: Public API, coerced from HTML (String, Number, Boolean)
  export const attributes = {
    userId: { type: Number, default: 0 },
    role: { type: String, default: 'Guest' },
    theme: { type: String, default: 'light' }
  }

  // SERVER: Async server-side initialization (Stripped from client bundle!)
  export async function server ({ state }) {
    const { userService } = await import('./services.js')
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
    default: ({ nodes }) => nodes
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

Computed slots (`slots: { [name]: ({ nodes, state }) => ... }`) render projected content at build time and are re-evaluated on client state updates:

* **First-Class DOM Compatibility on Server**: Coralite equips server-side AST nodes with a full DOM-emulation layer. Properties such as `node.textContent`, `node.nodeType`, `node.childNodes`, `node.getAttribute()`, `node.hasAttribute()`, `node.tagName`, and `node.classList` are fully supported on the server.
* **Write Standard DOM Code**: Because of this compatibility layer, you do **not** need to branch on server-specific AST properties (like `.data` or `.type`). Writing standard DOM operations like `nodes.map(n => n.textContent).join('')` or checking `node.nodeType === 1` runs 100% isomorphically across both Node.js SSR and the browser.
* **Hydration Parity**: Server-rendered computed slots are marked with `data-coralite-slot-computed` during SSR. During initial client hydration, Coralite preserves the server-rendered markup without redundant re-evaluation—preventing double transformations on non-idempotent slot functions (e.g. `X!` -> `X!!`) and eliminating Cumulative Layout Shifts (CLS). Live projected node references are stored in `slotEl._originalNodes` so subsequent client state mutations re-evaluate against the live projected nodes directly, ensuring owner component bindings remain attached and reactive.
* **Environment Boundaries**: Slot transformers should avoid browser-only layout APIs (`getBoundingClientRect()`, `offsetWidth`) or DOM event listeners (`addEventListener()`), as these require an active browser rendering engine. Return HTML strings, DOM nodes, or `undefined` (to preserve original slotted content).

---

## Extending the Engine (`definePlugin`)

Plugins contribute helpers and build hooks under a namespace derived from their `name`. The canonical form is a single default export:

```javascript
import { definePlugin } from 'coralite'

export default definePlugin({
  name: 'formatters', // injected as `formatters` in component and page context

  context: () => () => ({
    greeting: (name) => `Hello, ${name}`
  }),

  server: {
    context: () => () => ({
      readTitle: (page) => page.meta?.title ?? ''
    })
  },

  client: {
    context: () => () => ({
      notify: (message) => console.info(message)
    }),
    init: ({ config }) => {
      // one-time browser setup
    }
  }
})
```

Rules worth knowing:

* `context` is ubiquitous — available to component and page `server`, `getters`, `client`, `slots` and `style`. `server.context` and `client.context` are environment-specific and **may be used together**. A top-level `context` cannot be combined with either.
* Every context is curried: `(pluginContext) => (instanceContext) => ({ ... })`. Phase 1 runs once at plugin setup; phase 2 resolves per component instance. In the browser, phase 1 receives a shallow copy of the runtime, so share state through closures captured by phase 2 rather than assigning to `pluginContext`.
* Phase 2 receives `id`, `module`, `page`, `root`, `state`, `session`, `app` and `route`. Core keys (`state`, `route`, `app`, `session`, `signal`, `store`, `page`) take precedence over plugin keys.
* Config lives in `config`, `server.config` or `client.config`; a key may appear in only one block. Plugins can declare build hooks such as `onBeforeBuild`, `onAfterBuild`, `onPageSet` and `onBeforePageRender`, plus `client.init`. Use `dependencies` for plugin ordering; `depends` is rejected.

See the [plugin reference](https://coralite.dev/reference/plugins/) for the full hook list and validation rules.

### Consuming Plugin Context in Components

Components access the injected APIs directly via destructuring in `server()` and `client()`:

```html
<script type="module">
  // Sourced from the server Phase 2 resolver
  export function server ({ formatters, state }) {
    return { heading: formatters.greeting(state.userName) }
  }

  // Sourced from the client Phase 2 resolver
  export function client ({ formatters, state }) {
    formatters.notify(`Welcome back, ${state.userName}`)
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
* **pnpm**: v12+

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

# Run the deterministic E2E test suite
pnpm run test:e2e

# Run the fast internal regression benchmarks
pnpm run bench:internal
```

For canonical external harness runs, use `pnpm run bench:external` from the repository root. See [`benchmarks/README.md`](../../benchmarks/README.md).

## Documentation

For a deep dive into advanced features, imperative slot rendering, end-to-end testing strategies, and full API references, check out the [official documentation](https://coralite.dev/docs/guide/getting-started/).

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](https://github.com/tjdav/coralite/blob/main/LICENSE) file for details.

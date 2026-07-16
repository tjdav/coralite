# 🪸 Coralite

## Build for the Web, With the Web

Coralite is a powerful **Isomorphic Web Component Framework** designed to build fast, interactive single-page applications (SPAs), dynamic websites, and static sites. It seamlessly blends the initial load speed of Server-Side Rendering (SSR) with robust, high-performance client-side hydration, giving you total flexibility over your rendering strategy using standard Web Components.

### Why Coralite?

Coralite stands out by actively fixing the most frustrating pain points of modern web development:

* **True Native Web Components (Without the Boilerplate)**
Abandon the verbose `class extends HTMLElement` syntax. Coralite uses a clean, ergonomic `defineComponent` flat-options API (`attributes`, `server`, `getters`, `client`) that outputs true native Custom Elements.
* **Scoped CSS without Shadow DOM**
Shadow DOM notoriously breaks global CSS systems and creates accessibility barriers. Coralite completely bypasses this by using compiler-generated instance identifiers to perfectly scope your CSS in the Light DOM.
* **Isomorphism Built-In (The Vanishing `server` Block)**
Fetch database or API records in the `server()` block during SSR. Coralite automatically serializes that data, hydrates it seamlessly into a unified reactive state on the client, and safely strips the `server()` code entirely from your browser bundle.
* **Opt-Out Hydration**
For purely static sections, simply append the `no-hydration` attribute to your HTML tag. Coralite will render it on the server but skip client-side hydration completely, keeping your JavaScript bundle incredibly lean.
* **The "Smart State, Dumb Template" Paradigm**
Say goodbye to spaghetti code. Templates are strictly declarative—no logic loops, inline expressions, or dot-notation allowed. All UI logic resides in pure, synchronous JavaScript `getters` which map cleanly to native HTML attributes.
* **O(1) Microtask Reactivity (No Virtual DOM)**
Mutate state in the `client()` controller block, and Coralite automatically schedules surgical DOM updates in the next microtask queue with O(1) precision via a compiler-generated hydration map.
* **Async Race-Condition Immunity**
Coralite’s reactive engine handles asynchronous data with built-in version locks, ensuring your DOM never renders stale data from out-of-order Promise resolutions.

---

## Quick Start

The easiest way to start a new Coralite project is to use the scaffolding tool. This will set up your directory structure, install dependencies, and configure your npm scripts automatically.

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

## Manual Installation & CLI

If you are adding Coralite to an existing project or building from scratch manually, install the core package:

```bash
npm install coralite

```

Coralite ships with a built-in CLI to manage your development workflow:

```bash
npx coralite [options]

```

### Required CLI Options

* **`-c` or `--components**`: The path to your components directory (e.g., `-c src/components`).
* **`-p` or `--pages**`: The path to your pages directory (e.g., `-p src/pages`).
* **`--output` or `-o**`: The output directory for the generated site (e.g., `--output dist`).

### Additional CLI Options

* **`-m` or `--mode**`: Build mode: `development`, `production`, or `testing` (defaults to `production`).
* **`-i` or `--ignore-attribute**`: Ignore elements by attribute name value pair (format: `key=value`).
* **`-s` or `--skip-render-attribute**`: Parse elements but exclude them from final render output.
* **`-d` or `--dry-run**`: Preview the actions that would be performed without generating output.
* **`-a` or `--assets**`: Static assets to copy. Format: `pkg:path:dest` (or `pkg:path`).

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
  <div class="card">
    <h2 ref="title">{{ formatName }}</h2>
    <p>{{ userMeta }}</p>
    
    <slot></slot>
    
    <p class="stats">Logins: {{ loginCount }}</p>
    <p class="warning" hidden="{{ hideWarning }}">High Activity User</p>
  </div>
</template>

<style>
  /* These styles are scoped to this component instance in the Light DOM */
  .card {
    border: 1px solid #eaeaea;
    padding: 1.5rem;
    border-radius: 8px;
  }
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
      role: { type: String, default: 'Guest' }
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

Coralite uses a strictly typed isomorphic plugin architecture. A plugin is divided into `server` (Node.js/Build) and `client` (Browser/Runtime) blocks, using a **Two-Phase Curried** API to safely inject context exactly where you need it.

```javascript
import { definePlugin } from 'coralite'

export default function myPlugin(options = {}) {
  return definePlugin({
    name: 'my-plugin',

    server: {
      // Symmetrical context: available in defineComponent server block
      context: (pluginContext) => (instanceContext) => {
        return {
          getData: () => ({ custom: 'data' })
        }
      },
      onBeforeComponentRender: ({ state }) => {
        state.pluginAdded = true
      }
    },

    client: {
      // Injects context helpers directly into the component's client block
      context: (pluginContext) => (instanceContext) => {
        return {
          myHelper: () => {
            console.log('Hello from component', instanceContext.instanceId)
          }
        }
      }
    }
  })
}

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
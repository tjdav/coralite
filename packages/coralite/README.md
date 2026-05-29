# 🪸 Coralite

[![npm version](https://img.shields.io/npm/v/coralite.svg)](https://www.npmjs.com/package/coralite)
[![License](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](https://codeberg.org/tjdavid/coralite/src/branch/main/LICENSE)


## Build for the Web, With the Web

Coralite is a **Native-First**, strictly Server-Side Rendered (SSR) framework for building fast, accessible, and future-proof websites.

- **True Native Web Components with a "Flat" API**
  No vanilla boilerplate. Use a clean `defineComponent` flat-options API (`attributes`, `data`, `getters`, `script`) to build powerful Custom Elements without the `class extends HTMLElement` friction.
- **The "Smart State, Dumb Template" Paradigm**
  Templates are strictly declarative and "dumb"—no logic loops or dot-notation in HTML. All logic lives in pure JavaScript `getters` which receive a safe, Read-Only Proxy.
- **Scoped CSS without Shadow DOM**
  Enjoy perfect style encapsulation using standard CSS. The Coralite compiler automatically injects unique instance identifiers and nests rules, avoiding the accessibility and global styling headaches of Shadow DOM.
- **Native Async Race-Condition Immunity**
  Coralite's reactive engine handles asynchronous `data()` and `getters` with built-in version locks, ensuring your DOM never renders stale data from out-of-order Promise resolutions.
- **Isomorphic, Two-Phase Curried Plugins**
  Extend the engine with a strict, typed boundary. Plugins use a two-phase currying pattern to inject heavy context during initialization, leaving you with a clean, scoped API at runtime.

---

## Creating a new project

The easiest way to start a new Coralite project is to use the scaffolding tool. This will set up your directory structure, install dependencies, and configure your npm scripts automatically.

```bash
npm create coralite@latest my-coralite-app
cd my-coralite-app
npm run start
```

#### Key Features
- **Live Reload** - Automatic browser refresh on HTML, template, and asset changes.
- **Hot CSS Updates** - Instant CSS injection without page refresh via Server-Sent Events.
- **Sass/SCSS Support** - Compile Sass files with source maps and auto-prefixing.
- **File Watching** - Monitors all source directories for changes.
- **Production Optimization** - Clean builds with optimized output.
- **Plugin Integration** - Full support for Coralite plugins.

> Learn more about the scaffolding process in the [Coralite scripts reference](https://coralite.dev/docs/reference/coralite-scripts.html).

---

## Manual Installation & CLI

If you are adding Coralite to an existing project or building from scratch manually, install the core package:

```bash
npm install coralite
```

Coralite ships with a built-in CLI to manage your development workflow. You can execute it directly:

```bash
npx coralite [options]
```

### Required CLI Options

- **`-c` or `--components`**: The path to your components directory containing reusable UI elements (e.g., `-c src/components`).
- **`-p` or `--pages`**: The path to your pages directory where static HTML files reside (e.g., `-p src/pages`).
- **`--output` or `-o`**: The output directory for the generated site (e.g., `--output dist`).

### Additional CLI Options

- **`-m` or `--mode`**: Build mode: "development" or "production" (defaults to "production").
- **`-i` or `--ignore-attribute`**: Ignore elements by attribute name value pair (format: `key=value`).
- **`-s` or `--skip-render-attribute`**: Parse elements but exclude them from final render output.
- **`-d` or `--dry-run`**: Run the CLI in dry-run mode to preview the actions that would be performed without actually generating the website.
- **`-a` or `--assets`**: Static assets to copy. Format: `pkg:path:dest` (or `pkg:path`).

Example:
```bash
npx coralite --components src/components --pages src/pages --output dist
```

> Explore all CLI capabilities in the [Coralite CLI reference](https://coralite.dev/docs/reference/cli.html).

---

## Configuration (`defineConfig`)

Coralite uses a `coralite.config.js` file at the root of your project. We provide a `defineConfig` helper to give you full IDE autocomplete and type safety.

```javascript
import { defineConfig } from 'coralite'
import myCustomPlugin from './plugins/my-plugin.js'

export default defineConfig({
  // Directory configuration
  pages: './src/pages',
  components: './src/components',
  output: './dist',
  
  // Register plugins to hook into the build lifecycle
  plugins: [
    myCustomPlugin()
  ]
})
```

> Read more about project configuration in the [Coralite configuration reference](https://coralite.dev/docs/reference/config.html).

---

## Building components (`defineComponent`)

Coralite components are single-file HTML modules containing a `<template>`, an optional `<style>`, and a `<script type="module">`.

Styles defined in the `<style>` block are automatically **scoped** to the component, meaning they won't leak out and affect the rest of your site. The `defineComponent` API allows you to safely inject state and logic into your HTML using computed tokens.

**`src/components/user-card.html`**

```html
<template id="user-card">
  <div class="card">
    <!-- Templates only render flat keys. Logic belongs in getters! -->
    <h2 ref="title">{{ formatName }}</h2>
    <p>{{ userMeta }}</p>
    
    <slot></slot>
    
    <p class="stats">Logins: {{ loginCount }}</p>
  </div>
</template>

<style>
  /* These styles are automatically scoped to this component instance */
  .card {
    border: 1px solid #eaeaea;
    padding: 1.5rem;
    border-radius: 8px;
  }
  h2 { color: coral; }
</style>

<script type="module">
  import { defineComponent } from 'coralite'
  import { userService } from './services.js'

  export default defineComponent({
    // ATTRIBUTES: Coerced from HTML (String, Number, Boolean)
    attributes: {
      userId: { type: Number, default: 0 },
      role: { type: String, default: 'Guest' }
    },

    // DATA: Async server-side fetching (Stripped from client bundle)
    async data({ state }) {
      const user = await userService.getById(state.userId)
      return {
        firstName: user.firstName,
        lastName: user.lastName,
        loginCount: user.loginCount
      }
    },

    // GETTERS: Pure, sync derived state (Read-Only Proxy)
    getters: {
      formatName: (state) => `${state.firstName} ${state.lastName}`.trim(),
      userMeta: (state) => `Role: ${state.role} | ID: ${state.userId}`
    },

    // SCRIPT: Client-side controller (Read/Write Proxy)
    script({ state, refs, signal }) {
      // Use the 'refs' utility to get the unique DOM element
      const titleEl = refs('title')

      titleEl.addEventListener('click', () => {
        // Mutations automatically trigger DOM updates & getter re-evaluations
        state.loginCount++
      }, { signal }) // Always use 'signal' for auto-cleanup!
    }
  })
</script>
```

> Learn advanced component techniques in the [getting started guide](https://coralite.dev/docs/guide/getting-started.html).

---

## Extending the Engine (`definePlugin`)

Coralite uses an isomorphic plugin architecture. A plugin is divided into `server` (Node.js) and `client` (Browser) blocks, using a **Two-Phase Curried** API to safely inject context.

```javascript
import { definePlugin } from 'coralite'

export default function myPlugin(options = {}) {
  return definePlugin({
    name: 'my-plugin',

    server: {
      // Phase 1: Global Context | Phase 2: Component Arguments
      exports: {
        getData: (context) => (query) => {
          return { custom: 'data' }
        }
      },
      onBeforeComponentRender: ({ state }) => {
        state.pluginAdded = true
      }
    },

    client: {
      // Injects a utility directly into the component's 'script' context
      context: {
        myHelper: (globalCtx) => (instanceCtx) => () => {
          console.log('Hello from component', instanceCtx.instanceId)
        }
      }
    }
  })
}
```

> Start writing your own custom plugins with the [Create Plugin Reference](https://coralite.dev/docs/reference/define-plugin.html).

---

## Server-Side Lifecycle Hooks

Coralite plugins tap into specific hooks that execute strictly during the SSG build phase. Framework utilities (like `parseHTML`) must be explicitly imported from `coralite/utils`, and engine state is accessed via `this`.

### Granular Hooks
- **`onPageSet` / `onPageUpdate` / `onPageDelete`**: Triggered when a page is added, modified, or removed from the collection.
- **`onComponentSet` / `onComponentUpdate` / `onComponentDelete`**: Triggered when a component definition is added, modified, or removed.

### Orchestration Hooks
- **`onBeforeBuild`**: Executes once before the build process begins. Ideal for resetting global plugin state.
- **`onAfterBuild`**: Executes after the build finishes. Provides results and performance metrics.

### Rendering Hooks
- **`onBeforePageRender`**: A state-reducing hook to patch the page context just before HTML serialization.
- **`onAfterPageRender`**: An aggregator hook that runs after a page is rendered, allowing plugins to append additional pages (e.g., RSS feeds, sitemaps) to the build output.
- **`no-hydration`**: An attribute that can be added to any component tag to completely exclude it from client-side hydration while still rendering its content on the server.

---

## Contributing

We welcome community contributions! Coralite is managed as a monorepo, so setting up your local environment correctly is important.

### 1. Prerequisites

We rely on **pnpm workspaces** to manage dependencies across all internal packages.

  * **Node.js** v20.19.0 or higher (Node.js v24 LTS recommended)
  * **pnpm** v10+

### 2. Fork & Clone

Fork the [Coralite repository](https://codeberg.org/tjdavid/coralite) and clone it locally:

```bash
git clone https://codeberg.org/tjdavid/coralite.git
cd coralite
```

### 3. Install Dependencies

Run the installation from the root directory. pnpm will automatically link the local packages (like the core engine and CLI) together:

```bash
pnpm install
```

### 4. Run Tests & Benchmarks

Before submitting a Pull Request, navigate to the core package and ensure your changes haven't broken existing features or caused performance regressions:

```bash
cd packages/coralite

# Run the unit test suite
pnpm run test-unit

# Run the end-to-end test suite
pnpm run test-e2e

# Run the performance benchmarks (highly recommended if modifying the AST or Plugin core)
pnpm run bench
```

## Documentation

For a deep dive into advanced features, imperative slot rendering, scoped styles, and full API references, check out the [official documentation](https://coralite.dev/docs/guide/getting-started.html).

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](https://codeberg.org/tjdavid/coralite/src/branch/main/LICENSE) file for details.

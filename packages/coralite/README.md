# 🪸 Coralite

[![npm version](https://img.shields.io/npm/v/coralite.svg)](https://www.npmjs.com/package/coralite)
[![License](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](https://codeberg.org/tjdavid/coralite/src/branch/main/LICENSE)


## Build for the Web, With the Web

Coralite is a static site generator built around HTML modules and the Native Web.

- **Build with HTML Modules**
  Build your entire website with modular components using only native web technologies. This provides a simple, stable, and maintainable foundation.
- **Accessibility and Security First**
  By leveraging native HTML elements, sites inherit strong accessibility features out-of-the-box. A small footprint with no third-party library dependencies creates a more secure website. 
- **Progressive Enhancement**
  Ensures that all basic content and functionality are accessible, even on browsers without JavaScript. JavaScript is treated as an optional enhancement, not a requirement. 
- **Powerful Plugin System**
  Extend and customize the build process with a plugin API. Use hooks to manage content, create aggregations like blog posts with pagination, or transform final HTML and CSS output.

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

## 📦 Manual Installation & CLI

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
import { defineConfig } from 'coralite/plugins'
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
  <div class="card" ref="card">
    <h2>{{ formatName }}</h2>
    <p>{{ userMeta }}</p>
    <slot>
    <p class="stats">Logins: {{ loginCount }}</p>
  </div>
</template>

<style>
  /* These styles are automatically scoped to this component */
  .card {
    border: 1px solid #eaeaea;
    padding: 1.5rem;
    border-radius: 8px;
    cursor: pointer;
  }
  h2 {
    color: coral;
  }
  .stats {
    font-size: 0.85em;
    color: gray;
  }
</style>

<script type="module">
  import { defineComponent } from 'coralite'
  import db from 'database'

  export default defineComponent({
    // INPUTS (Coerced from HTML string attributes)
    attributes: {
      firstName: { type: String, default: 'Unknown' },
      lastName: { type: String, default: '' },
      role: { type: String, default: 'Guest' }
    },

    // SERVER DATA (Async fetching, runs on build/server)
    async data(context) {
      // We can use the parsed attributes to fetch specific data
      const stats = await db.fetchUserStats(context.attributes.firstName)
      
      return {
        // These will be merged into the base state
        department: stats.department || 'General',
        loginCount: stats.loginCount || 0
      }
    },

    // DERIVED STATE (Sync, pure functions, Read-Only Proxy)
    getters: {
      // state = attributes + data
      formatName: (state) => `${state.firstName} ${state.lastName}`.trim(),
      userMeta: (state) => `Role: ${state.role} | Dept: ${state.department}`
    },

    // Light DOM transformations
    slots: {
      default (nodes, context) {
        return nodes.map(node => node)
      }
    },

    // CLIENT CONTROLLER (Mutations, Events, Read/Write Proxy, Teardown)
    script({ state, refs, root, signal }) {
      console.log(`Component mounted: ${state.formatName}`)
      
      // Use the refs dictionary provided by the core plugin to target the element
      const cardEl = root.querySelector(`[ref="${refs.card}"]`)

      cardEl.addEventListener('click', () => {
        alert(`Hello from the browser, ${state.formatName}!`)
        
        // automatically updates the DOM, and re-runs any dependent getters.
        state.loginCount++ 
      }, { signal })
    }
  })
</script>
```

> Learn advanced component techniques in the [getting started guide](https://coralite.dev/docs/guide/getting-started.html).

---

## Extending the Engine (`definePlugin`)

Coralite is built to be extended. The `definePlugin` API lets you tap directly into the framework's build lifecycle.

Plugins in Coralite use a functional, immutable API. Instead of mutating shared state, your plugin hooks simply return the specific data patches or pages you want to add. Core utilities are available via `coralite/utils`, and global engine state is accessible through `this` binding.

```javascript
import { definePlugin } from 'coralite/plugins'
import { parseHTML } from 'coralite/utils'

export default function seoPlugin(options = {}) {
  return definePlugin({
    name: 'coralite-seo-plugin',

    // State Reducers: Patch the page context before rendering
    onBeforePageRender (context) {
      // Return a patch object; Coralite will safely deep-merge it for you!
      return {
        state: {
          siteTitle: options.title || 'My Coralite Site',
          metaDescription: 'Generated by Coralite'
        }
      }
    },

    // Data Aggregators: Generate entirely new pages during the build
    onAfterPageRender (basePageResult) {
      // Access the engine instance via `this`
      // this.pages.getItem('/index.html')

      // Return an array of new pages to append to the final build
      if (basePageResult.path.filename === 'index.html') {
        return [
          {
            path: { filename: 'sitemap.xml', pathname: '/sitemap.xml' },
            content: '<xml>...</xml>'
          }
        ]
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

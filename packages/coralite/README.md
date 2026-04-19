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
  <div class="card">
    <h2>{{ formatName }}</h2>
    <p>Role: {{ userRole }}</p>
  </div>
</template>

<style>
  /* These styles are automatically scoped to this component */
  .card {
    border: 1px solid #eaeaea;
    padding: 1.5rem;
    border-radius: 8px;
  }
  h2 {
    color: coral;
  }
</style>

<script type="module">
  import { defineComponent } from 'coralite/plugins'

  export default defineComponent({
    tokens: {
      // Tokens receive the current component context and values
      formatName(values) {
        return `${values.firstName} ${values.lastName}`
      },
      userRole(values) {
        return values.role || 'Guest'
      }
    }
  })
</script>
```

> Learn advanced component techniques in the [getting started guide](https://coralite.dev/docs/guide/getting-started.html).

---

## Extending the Engine (`definePlugin`)

Coralite is built to be extended. The `definePlugin` API lets you tap directly into the framework's build lifecycle.

Plugins in Coralite use a functional, immutable API. Instead of mutating shared state, your plugin hooks simply return the specific data patches or pages you want to add.

```javascript
import { definePlugin } from 'coralite/plugins'

export default function seoPlugin(options = {}) {
  return definePlugin({
    name: 'coralite-seo-plugin',

    // 1. State Reducers: Patch the page context before rendering
    onBeforePageRender: async (context) => {
      // Return a patch object; Coralite will safely deep-merge it for you!
      return {
        values: {
          siteTitle: options.title || 'My Coralite Site',
          metaDescription: 'Generated by Coralite'
        }
      }
    },

    // 2. Data Aggregators: Generate entirely new pages during the build
    onAfterPageRender: async (basePageResult) => {
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

## Contributing

We welcome community contributions! Coralite is managed as a monorepo, so setting up your local environment correctly is important.

### 1. Prerequisites

We rely on **pnpm workspaces** to manage dependencies across all internal packages.

  * **Node.js** v24+
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

# Coralite Scripts

Welcome to **Coralite Scripts**, a lightweight script toolset for building and serving Coralite applications. This guide walks you through setting up your local development environment using the provided `coralite-scripts` package and configuration files.

---

## Project Structure

Coralite expects a standard folder layout:

```
my-coralite-site/
├── src/
│   ├── pages/        # Your page components (e.g., `about.html`, `index.html`)
│   ├── css/          # SCSS/Sass/CSS global styles
│   └── components/   # Reusable component files
├── public/           # Static assets (CSS, JS, images)
├── dist/             # Output directory for built site (auto-generated)
├── coralite.config.js # Configuration file
└── package.json      # Scripts & dependencies
```

---

## Step 1: Configure `coralite.config.js`

Create or update your config file with the following:

```js
import { defineConfig } from 'coralite-scripts'

export default defineConfig({
  // Directory configuration
  output: 'dist',
  public: 'public',
  pages: 'src/pages',
  components: 'src/components',
  
  // Style pipeline (CSS, Sass, PostCSS)
  styles: {
    // Array of entry points
    input: [
      'src/css/main.scss'
    ],
    // Processor configurations
    processors: {
      scss: {
        style: 'compressed',
        loadPaths: ['node_modules']
      }
    }
  },

  // Plugins
  plugins: [],

  // Static Assets
  assets: [
    { pkg: 'some-package', path: 'dist/asset.js', dest: 'assets/asset.js' }
  ]
})
```

> This tells Coralite where to find your source files, compile CSS from SCSS/Sass/CSS, and serve static assets. It also sets up advanced features like copying static assets or ignoring/skipping rendering of specific elements based on attributes.

---

## Step 2: Start the Development Server

Update your `package.json` scripts to include:

```json
{
  "scripts": {
    "start": "coralite-scripts dev",
    "test": "coralite-scripts test",
    "build": "coralite-scripts build"
  }
}
```

Then start the dev server:

```bash
npm run start
```

> The server runs on `http://localhost:3000` by default.

---

## Test Mode

Coralite Scripts includes a dedicated mode for automated testing (e.g., E2E testing with Playwright or Cypress).

```bash
npm run test
```

When running in `test` mode:
- **`testing` mode enabled**: Sets Coralite's internal mode to `testing`, which enables deterministic IDs, telemetry, and disables CSS animations/transitions to speed up tests.
- **No Hot Reloading**: Disables Server-Sent Events (SSE) and live reload script injection for a stable testing environment.
- **No File Watching**: Disables the file watcher to reduce resource usage during CI/CD pipelines.

---

## Live Development Features

Coralite provides real-time development workflows out of the box:

| Feature | How It Works |
|-------|-------------|
| **Live Reload** | Automatically reloads browser when any `.html`, `.scss`, `.sass`, or `.css` file changes. |
| **Hot CSS Updates** | Sass/SCSS files are compiled instantly and injected into your page via Server-Sent Events (SSE). |
| **File Watching** | Monitors `src/pages`, `styles.input` files, `public`, and `src/components`. |
| **Dev Logs** | Shows real-time build times, file changes, and status codes in terminal. |

---

## How it works under the hood

- **Routing**: `/` → `index.html`, `/about` → `about.html`
- **HTML Compilation**: Pages are compiled with embedded live reload scripts during development.
- **Sass/CSS Support**: `.scss`, `.sass`, or `.css` files specified in `styles.input` are auto-compiled to CSS in `dist/assets/css`.
- **Auto-Injection**: Global styles are automatically injected as `<link>` tags into the `<head>` of every page, before component-scoped styles.
- **Server-Sent Events (SSE)**: Used for real-time updates without full page refresh.

> No extra tooling needed — everything is built-in!

---

## Prerequisites

* **Node.js** v20.19.0 or higher (Node.js v24 LTS recommended)

---

## Example usage

1. Create a new file at `src/pages/about.html`:
   ```html
   <!DOCTYPE html>
   <html lang="en">
     <head><title>About</title></head>
     <body><h1>Welcome to Coralite!</h1></body>
   </html>
   ```

2. Visit `http://localhost:3000/about` in your browser — it loads instantly.

3. Edit the file → see auto-reload!

4. Add a new SCSS file at `src/css/style.scss`, add it to `styles.input` in your config, and see it automatically injected into your pages!

---

> **Feedback?** Found a bug or want a feature? [Open an issue](https://codeberg.org/tjdavid/coralite/issues) on our Codeberg repository!

Happy building with Coralite!

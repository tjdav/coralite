> ⚠️ **NOTE: This is a read-only mirror.** Development happens on [Codeberg](https://codeberg.org/tjdavid/coralite).

# Coralite Development Environment Guide

Welcome to **Coralite starter script**, a lightweight Static Site Generator (SSG) built for rapid development and clean output. This guide walks you through setting up your local development environment using the provided `coralite-scripts` package and configuration files.

---

## Project Structure

Coralite expects a standard folder layout:

```
my-coralite-site/
├── src/
│   ├── pages/        # Your page templates (e.g., `about.html`, `index.html`)
│   ├── scss/         # SCSS/Sass styles
│   └── templates/    # Reusable template files
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
  output: 'dist',
  public: 'public',
  pages: 'src/pages',
  templates: 'src/templates',
  sass: {
    input: 'src/scss'
  }
})
```

> This tells Coralite where to find your source files, compile CSS from SCSS, and serve static assets.

---

## Step 2: Start the Development Server

Update your `package.json` scripts to include:

```json package.json
{
  "scripts": {
    "start": "coralite-script"
  }
}
```

Then start the dev server:

```bash
npm run start
```

> ✅ The server runs on `http://localhost:3000` by default.

---

## Live Development Features

Coralite provides real-time development workflows out of the box:

| Feature | How It Works |
|-------|-------------|
| **Live Reload** | Automatically reloads browser when any `.html`, `.scss`, or `.sass` file changes. |
| **Hot CSS Updates** | Sass/SCSS files are compiled instantly and injected into your page via Server-Sent Events (SSE). |
| **File Watching** | Monitors `src/pages`, `src/scss`, `public`, and `src/templates`. |
| **Dev Logs** | Shows real-time build times, file changes, and status codes in terminal. |

---

## How it works under the hood

- **Routing**: `/` → `index.html`, `/about` → `about.html`
- **HTML Compilation**: Pages are compiled with embedded live reload scripts.
- **Sass Support**: `.scss`/`.sass` files are auto-compiled to CSS in `dist/css`.
- **Server-Sent Events (SSE)**: Used for real-time updates without full page refresh.

> No extra tooling needed — everything is built-in!

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

4. Add a new SCSS file at `src/scss/style.scss`, and import it into an HTML page via `<link rel="stylesheet" href="/css/style.css">`.

---

> **Feedback?** Found a bug or want a feature? Open an issue!

Happy building with Coralite!
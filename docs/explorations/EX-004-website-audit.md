# EX-004: Website Build Audit — Unstyled Page Investigation

## Overview

During the addition/generation of the new documentation page (`docs/getting-started/`), the page rendered completely unstyled (without CSS). This audit investigates the toolchain, build process, output structure, and HTML references to identify why CSS was missing and determine the scope of the problem across the site.

---

### 1. Toolchain

- **Build Package / Toolchain:** The site build script in `website/package.json` executes `coralite-scripts build`.
- **Exact `package.json` scripts:**
  ```json
  "scripts": {
    "build": "coralite-scripts build",
    "start": "cross-env NODE_ENV='--experimental-vm-modules --experimental-import-meta-resolve' coralite-scripts dev",
    "check": "coralite-scripts check",
    "fix": "coralite-scripts fix",
    "lint:css": "stylelint 'src/css/*.css'",
    "lint:css:fix": "stylelint --fix 'src/css/*.css'"
  }
  ```
- **Package Versions Referenced (`website/package.json`):**
  - `"coralite"`: `"workspace:*"` (resolves to local package `packages/coralite`)
  - `"coralite-scripts"`: `"workspace:*"` (resolves to local package `packages/coralite-scripts`)

---

### 2. Build Output

Attempting to run `pnpm website:build` or `coralite-scripts build` initially fails if the `coralite` package has not been compiled (`pnpm build`). Once `coralite` is built, running `coralite-scripts build` on the website fails during page compilation with an uncaught runtime error:

```text
ERROR ─ Failed to evaluate paths block for page "src/pages/docs/guide/ssr.html": Cannot find module '#lib/database'
ERROR ─ Build failed
TypeError [ERR_INVALID_ARG_TYPE]: The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. Received undefined
    at writeFile (node:internal/fs/promises:1195:5)
    at file:///app/packages/coralite-scripts/libs/commands/build.js:154:13
```

Because `coralite-scripts build` crashes during the page building phase, execution never reaches the `buildStyles` phase (line 217 of `packages/coralite-scripts/libs/commands/build.js`). Consequently:

- **Directory listing of `website/dist/` after build failure:**
  ```text
  total 24
  drwxrwxr-x 3 jules jules 4096 Oct 16 13:01 .
  drwxrwxr-x 4 jules jules 4096 Oct 16 13:01 ..
  -rw-rw-r-- 1 jules jules  936 Oct 16 13:01 _redirects
  drwxrwxr-x 3 jules jules 4096 Oct 16 13:01 docs
  -rw-rw-r-- 1 jules jules 9662 Oct 16 13:01 favicon.ico
  ```
- **`dist/assets/` status:** `assets/` directory does not exist (`no assets dir`). `assets/css/` is not created and no CSS files are emitted.

---

### 3. HTML References

Inspecting the generated HTML files in `dist/` shows that `<link rel="stylesheet">` tags are present in the HTML head for all pages.

- **New Page (`website/dist/docs/getting-started/index.html`):**
  ```html
  <link rel="stylesheet" href="/assets/css/styles.css">
  ```
- **Older Page 1 (`website/dist/docs/guides/i18n/index.html`):**
  ```html
  <link rel="stylesheet" href="/assets/css/styles.css">
  ```
- **Older Page 2 (`website/dist/docs/guides/seo/index.html`):**
  ```html
  <link rel="stylesheet" href="/assets/css/styles.css">
  ```

All pages reference exact `href="/assets/css/styles.css"`.

---

### 4. CSS Presence

Checking disk for `/assets/css/styles.css` (relative to output root `website/dist/assets/css/styles.css`):

- **File Path:** `website/dist/assets/css/styles.css`
- **Status:** **DOES NOT EXIST**.
- **Size:** 0 bytes (missing file).

---

### 5. Scope of the Problem

**The issue affects EVERY PAGE on the site, not just the new page.**

Comparison across pages:
- `website/dist/docs/getting-started/index.html` references `/assets/css/styles.css` -> File missing -> **Unstyled**.
- `website/dist/docs/guides/i18n/index.html` references `/assets/css/styles.css` -> File missing -> **Unstyled**.
- `website/dist/docs/guides/seo/index.html` references `/assets/css/styles.css` -> File missing -> **Unstyled**.

Because the build pipeline aborts before compiling CSS assets, no page on the website receives stylesheets.

---

### 6. Root Cause

**Primary Candidate:** **(e) Something else / (a) The build does not emit CSS at all due to an early build pipeline failure.**

Detailed breakdown:
1. `coralite.config.js` properly configures external CSS under `styles.input: ['src/css/styles.css']`.
2. During initialization, `createCoralite` configures `externalStyles: ['/assets/css/styles.css']`, which injects `<link rel="stylesheet" href="/assets/css/styles.css">` into every page's `<head>`.
3. However, `coralite-scripts build` sequences CSS compilation (`buildStyles`) *after* page building (`coralite.build(...)`).
4. During page collection/rendering, `src/pages/docs/guide/ssr.html` includes sample code in a `paths` block that tries to require `#lib/database`, causing a fatal error during page compilation.
5. In addition, `coralite.build(...)` callback attempts to write output for pages with unhandled errors or missing content (`writeFile(outFile, undefined)`), triggering a fatal Node `TypeError [ERR_INVALID_ARG_TYPE]`.
6. As a result, `coralite-scripts build` crashes mid-way, halting execution before `buildStyles` can process PostCSS/Autoprefixer and emit `dist/assets/css/styles.css`.

---

### 7. Recommended Fix

To permanently resolve the unstyled pages issue and repair the build pipeline, the following steps are recommended:

#### Option 1: Fix the documentation page SSR sample code and error handling in build scripts (Recommended)
- **Action:**
  1. Fix `website/src/pages/docs/guide/ssr.html` to ensure sample code snippets use `<coralite-code-html>` or `<coralite-code-highlight>` tags instead of executable JS/HTML script blocks so Coralite doesn't attempt to execute fake database imports (`#lib/database`) at build time.
  2. Ensure `coralite-scripts build` safely handles or skips failed page outputs without passing `undefined` to `writeFile`.
- **Trade-off:** Minimal risk, maintains existing `coralite-scripts` build architecture, restores clean builds and CSS generation for all pages.

#### Option 2: Migrate website toolchain to `coralite` CLI directly
- **Action:** Update `website/package.json` scripts to use `coralite build` directly instead of the deprecated `coralite-scripts`.
- **Trade-off:** `coralite` CLI is the modern engine standard, but style compilation integration in `coralite` CLI needs to be verified against `website/coralite.config.js`.

---

### 8. Screenshot

A headless browser screenshot was captured of the rendered HTML for the newly generated page `website/dist/docs/getting-started/index.html`.

- **Screenshot Path:** `website/screenshots/exploration-website-audit.png`
- **Visual Confirmation:** The screenshot confirms the page renders unstyled plain HTML with unstyled text, links, and code blocks due to the missing `/assets/css/styles.css` file.

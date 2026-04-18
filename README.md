# Coralite

Coralite is a strictly Server-Side Rendered (SSR) static site generator built around the emerging [HTML modules proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/html-modules-explainer.md). 

- **Zero Hydration:** Pure SSR output. No Virtual DOM or heavy client-side frameworks required.
- **HTML Modules:** Author components natively in HTML using `<template>` `<style>` and `<script type="module">`.
- **Hybrid Architecture:** Seamlessly mix fully declarative static components with reactive, imperative Web Components.
- **Extensible Plugin System:** Hook into the build pipeline and inject client-side helpers via a powerful plugin API.

## Packages
This repository is a monorepo managed with `pnpm`. It contains the following packages:

### Core Framework
- [`coralite`](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite) - The core HTML modules static site generator and CLI.
- [`create-coralite`](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/create-coralite) - The scaffolding script to initialize new Coralite projects.
- [`coralite-scripts`](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite-scripts) - Configuration, build, and dev scripts for Coralite projects.

### Plugin Ecosystem
- [`create-coralite-plugin`](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/create-coralite-plugin) - Scaffolding script for generating new Coralite plugins.
- [`coralite-plugin-scripts`](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite-plugin-scripts) - Build and compilation scripts for plugin authors.

### Internal
- [`coralite-release`](https://codeberg.org/tjdavid/coralite/src/branch/main/packages/coralite-release) - Internal release and changelog management tools.

## 🚀 Getting Started

To scaffold a new Coralite project, run:

```bash
npm create coralite@latest
# or
yarn create coralite
# or
pnpm create coralite
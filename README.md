> ⚠️ **NOTE: This is a read-only mirror.** Development happens on [Codeberg](https://codeberg.org/tjdavid/coralite).

# 🪸 Coralite

Coralite is a **Native-First**, strictly Server-Side Rendered (SSR) framework for building fast, accessible, and future-proof websites. It leverages standard web technologies—HTML modules, Custom Elements, and standard ES modules—to eliminate framework-specific friction while providing a modern, reactive developer experience.

- **Native-First Architecture:** No custom template languages or proprietary compilers. If you know HTML, CSS, and JS, you know Coralite.
- **Smart State, Dumb Template:** A strict reactive model that keeps logic in pure JavaScript (getters) and keeps templates clean and declarative.
- **Zero Hydration by Default:** High-performance SSR output. Opt-in to reactivity only where needed with "Hybrid" Web Components.
- **Scoped CSS without Shadow DOM:** Enjoy perfect style encapsulation using standard CSS, without the accessibility and styling headaches of Shadow DOM.
- **Isomorphic Plugin System:** A powerful, two-phase curried API to extend the engine on both the server and the client.

## Packages
This repository is a monorepo managed with `pnpm`. It contains the following packages:

### Core Framework
- [`coralite`](./packages/coralite) - The core reactive engine, HTML module compiler, and CLI.
- [`coralite-scripts`](./packages/coralite-scripts) - Unified build, dev-server, and asset pipeline for Coralite projects.
- [`create-coralite`](./packages/create-coralite) - Scaffolding tool to initialize new projects in seconds.

### Plugin Ecosystem
- [`coralite-plugin-scripts`](./packages/coralite-plugin-scripts) - Development and release toolset for plugin authors.
- [`create-coralite-plugin`](./packages/create-coralite-plugin) - Scaffolding tool for generating new Coralite plugins.

### Release Tools
- [`coralite-release`](./packages/coralite-release) - Internal monorepo release and changelog management.

## Getting Started

To scaffold a new Coralite project, run:

```bash
npm create coralite@latest
# or
pnpm create coralite
```

### Prerequisites
* **Node.js** v20.19.0 or higher (Node.js v24 LTS recommended)
# 🪸 Coralite

Coralite is a **Native-First**, **Isomorphic Web Component Framework** designed to build fast, interactive single-page applications (SPAs), dynamic websites, and static sites. It seamlessly blends the initial load speed of Server-Side Rendering (SSR) with robust, high-performance client-side hydration, giving you total flexibility over your rendering strategy using standard Web Components.

It leverages standard web technologies—HTML modules, Custom Elements, and standard ES modules—to eliminate framework-specific friction while providing a modern, reactive developer experience.

## Key Features

* **True Native Web Components (Without the Boilerplate)**: Abandon the verbose `class extends HTMLElement` syntax. Coralite uses a clean, ergonomic `defineComponent` flat-options API (`attributes`, `server`, `getters`, `client`) that outputs true native Custom Elements.
* **Scoped CSS without Shadow DOM**: Shadow DOM notoriously breaks global CSS systems and creates accessibility barriers. Coralite completely bypasses this by using compiler-generated instance identifiers to perfectly scope your CSS in the Light DOM.
* **Isomorphism Built-In (The Vanishing `server` Block)**: Fetch database or API records in the `server()` block during SSR. Coralite automatically serializes that data, hydrates it seamlessly into a unified reactive state on the client, and safely strips the `server()` code entirely from your browser bundle.
* **Opt-Out Hydration**: For purely static sections, simply append the `no-hydration` attribute to your HTML tag. Coralite will render it on the server but skip client-side hydration completely, keeping your JavaScript bundle incredibly lean.
* **The "Smart State, Dumb Template" Paradigm**: Say goodbye to spaghetti code. Templates are strictly declarative—no logic loops, inline expressions, or dot-notation allowed. All UI logic resides in pure, synchronous JavaScript `getters` which map cleanly to native HTML attributes.
* **O(1) Microtask Reactivity (No Virtual DOM)**: Mutate state in the `client()` controller block, and Coralite automatically schedules surgical DOM updates in the next microtask queue with O(1) precision via a compiler-generated hydration map.
* **Async Race-Condition Immunity**: Coralite’s reactive engine handles asynchronous data with built-in version locks, ensuring your DOM never renders stale data from out-of-order Promise resolutions.

---

## Monorepo Package Structure

This repository is a monorepo managed with `pnpm`. It contains the following packages:

### Core Framework
* [`coralite`](./packages/coralite) - The core reactive engine, HTML module compiler, and CLI.
* [`coralite-scripts`](./packages/coralite-scripts) - Unified build, dev-server, and asset pipeline for Coralite projects.
* [`create-coralite`](./packages/create-coralite) - Scaffolding tool to initialize new projects in seconds.

### Plugin Ecosystem
* [`coralite-plugin-scripts`](./packages/coralite-plugin-scripts) - Development and release toolset for plugin authors.
* [`create-coralite-plugin`](./packages/create-coralite-plugin) - Scaffolding tool for generating new Coralite plugins.

### Release Tools
* [`coralite-release`](./packages/coralite-release) - Internal monorepo release and changelog management.

---

## Getting Started

To scaffold a new Coralite project in seconds, run:

```bash
npm create coralite@latest
# or
pnpm create coralite
```

### Prerequisites
* **Node.js**: v20.19.0 or higher (Node.js v24 LTS recommended)
* **pnpm**: v11+ (recommended for monorepo development)

---

## Monorepo Development

If you want to contribute or build Coralite from source, follow the steps below.

### 1. Setup & Installation

Clone the repository and install all dependencies. pnpm will automatically link the local packages together:

```bash
git clone https://codeberg.org/tjdavid/coralite.git
cd coralite
pnpm install
```

### 2. Common Development Scripts

You can run the following workspace-wide scripts from the root directory:

* **Build the project**:
  ```bash
  pnpm run build
  ```
  This builds the `coralite` package (generating library code and TypeScript declarations).
* **Format & Lint**:
  ```bash
  pnpm run format   # Auto-formats all source files using ESLint
  pnpm run lint     # Runs ESLint checks
  ```
* **Run Unit Tests**:
  ```bash
  pnpm run test:unit
  ```
  Runs the unit test suites across all packages.
* **Run E2E Tests**:
  ```bash
  pnpm run test:e2e
  ```
  Builds the project and runs the Playwright end-to-end tests for the core package.
* **Run Official Website Locally**:
  ```bash
  pnpm run website:dev
  ```
  Launches the official `coralite.dev` docs/website locally in development mode.
* **Build Official Website**:
  ```bash
  pnpm run website:build
  ```

---

## Documentation

For a deep dive into advanced features, imperative slot rendering, end-to-end testing strategies, and full API references, check out the [official documentation](https://coralite.dev/).

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](./LICENSE) file for details.
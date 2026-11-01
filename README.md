# 🪸 Coralite

Coralite is a static-first Web Component framework that compiles HTML modules into static HTML at build time with zero client JavaScript by default. When interactivity or dynamic data is required, Coralite progressively adds server-side rendering (SSR), fine-grained client-side hydration, and single-page application (SPA) routing using standard native Web Components.

## Key Features

* **Static HTML by Default**: Components without client logic emit pure static HTML and scoped CSS at build time with zero browser JavaScript overhead.
* **Native Web Components via Named Exports**: Author components in `.html` files using standard ES module exports (`export const`, `export function`) rather than boilerplate class syntax.
* **Light DOM Scoped CSS**: Scoped styling using compiler-generated instance identifiers and CSS `@layer` without requiring Shadow DOM boundaries.
* **Isomorphic Server Execution**: Fetch data or compute state at build/SSR time in `server()`. Initial state serializes to the client while server code is stripped from the browser bundle.
* **Opt-Out Hydration**: Mark components with `no-hydration` to render markup statically and bypass client runtime hydration entirely.
* **Declarative Templates & Pure Getters**: Templates read flat tokens (`{{ token }}`) while UI transformations live in pure, synchronous getter functions.
* **Microtask DOM Reactivity**: Reactive state mutations schedule batched DOM updates directly in the microtask queue without a virtual DOM.
* **Async Race-Condition Protection**: Version locks prevent stale out-of-order asynchronous responses from overwriting newer state.

---

## Monorepo Package Structure

This repository is a monorepo managed with `pnpm`. It contains the following packages:

### Core Framework
* [`coralite`](./packages/coralite) - The core reactive engine, HTML module compiler, and CLI.
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
* **Node.js**: >=22.22.2 (ESM native)
* **pnpm**: v11+ (recommended for monorepo development)

---

## Monorepo Development

If you want to contribute or build Coralite from source, follow the steps below.

### 1. Setup & Installation

Clone the repository and install all dependencies. pnpm will automatically link the local packages together:

```bash
git clone git@github.com:tjdav/coralite.git
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

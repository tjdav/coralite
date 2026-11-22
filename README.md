# 🪸 Coralite

Coralite is a static-first Web Component framework built on native Web Platform standards. It compiles HTML modules into static HTML at build time with zero client JavaScript by default, and progressively adds server-side rendering (SSR), signal-backed fine-grained reactivity, client-side hydration, and single-page application (SPA) routing when a page needs interactivity or dynamic data.

## Key Features

* **Static HTML by Default**: Components without client logic emit pure static HTML and scoped CSS at build time with zero browser JavaScript overhead. A "zero-JS" component still ships its module for imperative hydration, but no `client()` lifecycle runs.
* **Native Web Components via Named Exports**: Author components and pages in `.html` files using standard ES module exports (`export const`, `export function`) instead of class boilerplate. `definePage` remains for legacy compatibility only.
* **Signal-Backed Reactivity**: Fine-grained signals drive state updates. Getters can be synchronous or `async`, while `observe()`, `updateComplete`, and the global `store` cover side effects, DOM synchronization, and app-wide state.
* **Light DOM Scoped CSS**: Compiler-generated instance identifiers and CSS `@layer` scope styles without Shadow DOM. Declarative `style` exports add reactive inline CSS and CSS custom properties.
* **Isomorphic Server Execution**: Fetch data or compute state at build/SSR time in `server()`. Initial state serializes to the client while server code is stripped from the browser bundle.
* **Opt-Out Hydration**: Mark components or regions with `no-hydration` to render markup statically and bypass client runtime hydration entirely.
* **Declarative Templates & Pure Getters**: Templates read flat tokens (`{{ token }}`) while derived state lives in pure getter functions. Computed `slots` transform projected content isomorphically across SSR and client updates.
* **Built-in Plugins**: `refs`, metadata, static assets, testing, and virtualized lists ship with the framework. The SPA router is opt-in and preserves state outside the outlet across navigation.
* **Unified CLI & Static Auditing**: One `coralite` binary covers `dev`, `build`, `test`, `check`, `fix`, `diagnostics`, and granular validators. `coralite check` includes a Volar-bridged TypeScript pass by default; `--no-types` skips it.
* **Single Opt-Out Directive**: `coralite-ignore` keeps code samples, third-party widgets, slots, scripts, and templates literal while skipping token interpolation, compilation, hydration, and validation.
* **Async Race-Condition Protection**: Version locks prevent stale asynchronous responses, including superseded async getters, from overwriting newer state.

---

## Monorepo Package Structure

This repository is a monorepo managed with `pnpm`:

### Core Framework
* [`coralite`](./packages/coralite) - The framework runtime, HTML module compiler, unified CLI, built-in plugins (`refs`, `metadata`, static assets, testing, lists, and the opt-in router), validators, and Volar type checker.
* [`create-coralite`](./packages/create-coralite) - Scaffolding tool for new Coralite applications and plugins (`--template css|scss|plugin`). `--agent` injects AI assistant rules into an existing directory.

### Tooling & Release
* [`coralite-release`](./packages/coralite-release) - Internal monorepo release, changelog, and publishing tooling.

### Additional Workspaces
* [`website`](./website) - The official `coralite.dev` documentation and marketing site, itself built with Coralite.
* [`benchmarks`](./benchmarks) - Internal regression suites and external harness adapters.

---

## Getting Started

Scaffold a new Coralite project:

```bash
npm create coralite@latest my-app
cd my-app
npm run dev
```

Other package managers work the same way (`pnpm create coralite`, `yarn create coralite`). `create-coralite` also accepts `-t, --template <css|scss|plugin>`, `--agent` to inject AI assistant rules, and `--no-agent` to skip them.

### Prerequisites
* **Node.js**: >=22.22.2 (ESM native)
* **pnpm**: v12+ (recommended for monorepo development)

---

## Monorepo Development

If you want to contribute to Coralite or build it from source, follow the steps below.

### 1. Setup & Installation

Clone the repository and install all dependencies. pnpm will automatically link the local packages together:

```bash
git clone git@github.com:tjdav/coralite.git
cd coralite
pnpm install
```

### 2. Common Development Scripts

Run the following workspace-wide scripts from the root directory:

* **Build the core package**:
  ```bash
  pnpm run build
  ```
  Builds the `coralite` library and generates TypeScript declarations.
* **Format & Lint**:
  ```bash
  pnpm run format   # Auto-fixes all source files using ESLint
  pnpm run lint     # Runs ESLint checks
  ```
* **Run Unit Tests**:
  ```bash
  pnpm run test:unit
  ```
  Runs the unit test suites across all packages.
* **Run Component Coverage Checks**:
  ```bash
  pnpm run test:component:coverage
  ```
* **Run E2E Tests**:
  ```bash
  pnpm run test:e2e
  ```
  Builds the core package and runs the Playwright suites for `coralite` and `create-coralite`.
* **Run Internal Benchmarks**:
  ```bash
  pnpm run bench:internal --task-id <task-id> --phase <before|after> --save
  ```
  Fast local regression checks. Results are written to `benchmarks/results/`.
* **Run External Benchmarks**:
  ```bash
  pnpm run bench:external
  ```
  Runs the canonical external harnesses described in [`benchmarks/README.md`](./benchmarks/README.md).
* **Release & Changelog**:
  ```bash
  pnpm run release
  pnpm run changelog
  ```
* **Work on the Official Website**:
  ```bash
  pnpm run website:dev         # Development server
  pnpm run website:build       # Static build into website/dist
  pnpm run website:check       # Validate components, pages, and plugins
  pnpm run website:test        # Redirect audit and Playwright visual suite
  pnpm run website:lint:css    # Stylelint over website/src/css
  pnpm run website:a11y:full   # Full accessibility audit
  pnpm run website:perf        # Lighthouse performance run
  pnpm run website:perf:assert # Performance assertions
  ```

### 3. Verification Before a Pull Request

Run the ordered verification workflow from `packages/coralite`:

```bash
cd packages/coralite
pnpm lint:format
pnpm lint
pnpm build
pnpm build:html:dev
pnpm test:smoke
```

All commands must exit clean.

---

## CLI at a Glance

The single `coralite` binary covers development, builds, and static analysis:

| Command | Purpose |
| :--- | :--- |
| `coralite dev` | Development server with incremental rebuilds |
| `coralite build` | Production build into `dist/` |
| `coralite test` | Deterministic build served for E2E tests |
| `coralite check` | Unified validation across components, pages, and plugins |
| `coralite fix` | Apply safe AST auto-fixes (preview with `--dry-run`) |
| `coralite diagnostics` | List every diagnostic code with metadata |
| `coralite init-agent` | Scaffold `AGENTS.md` and AI IDE config aliases |
| `coralite validate-components` | Audit component templates, refs, CSS, and scripts |
| `coralite validate-pages` | Validate pages against component schemas |
| `coralite validate-plugins` | Validate plugin contracts and lifecycle hooks |

`dev`, `build`, and `test` share `--clean`, `--verbose`, `--no-incremental`, and `--assets`. See the [CLI reference](https://coralite.dev/reference/cli/) for filters, exit codes, and the full diagnostic catalogue.

---

## Documentation

For guides, concept deep dives, and full API references, start at the [official documentation](https://coralite.dev/docs/guide/getting-started/). The export-level API lives in the [reference](https://coralite.dev/reference/).

Coralite also ships `llms.txt` and `llms-full.txt` in the published package for AI coding assistants that discover project conventions automatically.

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](./LICENSE) file for details.

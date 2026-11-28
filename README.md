# 🪸 Coralite

Coralite compiles HTML modules into static HTML at build time, then adds interactivity only where a page needs it. Components are real Web Components authored with named ES exports; the output is Light DOM, scoped CSS and standard HTML — no proprietary template language.

## Why Coralite

* **Deterministic and fail-fast.** Validation runs before output is written, builds fail on the first error by default, and diagnostics are stable, machine-readable and auto-fixable where safe. The same input produces the same output.
* **Native-first.** Real `customElements`, Light DOM, CSS `@layer` and standard ES modules. Templates use flat `{{ token }}` placeholders; all logic lives in named exports.
* **Optimized for humans and AI assistants.** Flat templates, named exports, explicit serialization boundaries and `AGENTS.md` conventions are easy to read and to generate correctly. `coralite init-agent` scaffolds agent rules; published packages include `llms.txt` and `llms-full.txt`.
* **Rapid development.** A single CLI covers `dev`, `build`, `test`, `check`, `fix` and `diagnostics`. File watching with SSE reload, incremental builds and deterministic fixers keep the loop short.
* **Performance by default.** Static components ship no client lifecycle code, hydration is opt-out per element, and incremental builds reuse unchanged output. In a 2,000-page benchmark a warm build fell from 425 ms to 110 ms once unchanged pages could skip SSR work ([results](./benchmarks/results/bench-01-build-performance-after.json)).

Start with the [package README](./packages/coralite) for the authoring model, or the [official documentation](https://coralite.dev/docs/guide/getting-started/).

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

Run the ordered verification workflow from the repository root:

```bash
pnpm format
pnpm lint
pnpm build
pnpm --filter coralite build:html:dev
pnpm --filter coralite test:smoke
```

All commands must exit clean.

---

## CLI at a Glance

The single `coralite` binary covers development, builds, and static analysis:

| Command | Purpose |
| :--- | :--- |
| `coralite dev` | Development server with incremental rebuilds |
| `coralite build` | Production build into the configured `output` directory (`dist/` in scaffolds) |
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

Coralite also ships `llms.txt` and `llms-full.txt` in the published package for AI coding assistants that discover project conventions automatically. In this repository their sources live in `website/public/` and are copied into the package at publish time.

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](./LICENSE) file for details.

# Coralite Package Agent Rules

## 1. Scope

The core Coralite framework engine providing build-time page and component rendering, hydration, validation, and plugin runtime support across `packages/coralite/`.

## 2. Package-specific patterns

Directory boundary responsibilities under `lib/`:
- `lib/server/`: SSG pipeline, server-side component/page rendering, collection handling, script manager, and server plugin runner. Node.js target only.
- `lib/client/`: Web Components custom element base class, browser hydration runtime, reactive state updates, and client plugin runner. Zero Node.js dependencies allowed in client bundle.
- `lib/shared/`: Isomorphic utilities, AST helpers, schema definitions, and token parsers shared between server and client runtimes.
- `lib/validator/`: Build-time validation passes, diagnostic emitters, and code fixers for template, script, and config verification.
- `lib/cli/`: CLI commands, runner scripts, and dev server orchestration.

## 3. Authoring invariants

- Do not guard destructured context keys or check browser globals in deterministic functions (`client()`, `server()`, `getters`, `style`, `slots`). Context keys are guaranteed by the framework.

## 4. Package-scoped commands

Run commands scoped to `coralite`:
- `pnpm --filter coralite lint:format`
- `pnpm --filter coralite lint`
- `pnpm --filter coralite build`
- `pnpm --filter coralite test:smoke`

## 5. Reserved names

Reserved diagnostic and error code ranges for Coralite core:
- `CORALITE-E*`: Core error diagnostics.
- `CORALITE-W*`: Warning diagnostics.
- `CORALITE-A*`: Asset and asset pipeline diagnostics.
- `CORALITE-P*`: Plugin system errors and warnings.
- `CORALITE-PAGE-*`: Page-level diagnostics.

## 6. What belongs elsewhere

- Project scaffolding templates and template generation logic belong in `packages/create-coralite/`.
- Release tooling and version bump scripts belong in `packages/coralite-release/`.

## 7. Benchmark results

Benchmark result files are stored at `benchmarks/results/` at the repository root. Performance tasks must run `pnpm bench:internal --task-id <task-id> --phase <phase> --save` and commit the generated result files.

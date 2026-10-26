# Coralite Benchmarks

Coralite has two benchmark tracks: **internal** (fast local regression checks) and **external** (canonical harness runs used for release validation).

## Internal — `pnpm bench:internal`

Fast local checks (~30–60s) for regressions during development. Runs the surviving suites in `packages/coralite/benchmarks/`:

- **`02-bundle-hydration`** — bundle size (raw + gzipped) and client hydration time
- **`04-internal`** — micro-benchmarks via mitata (AST interpolation, Lazy Proxy, AST DOM creation)
- **`05-stress-lifecycle`** — selective hydration island scaling, state streaming, mount/unmount lifecycle

Used per Phase 3 tasks (see `AGENTS.md`). Writes results to `benchmarks/results/<task-id>.json` when run with `--task-id` and `--save`.

### Suites removed in rc.6

Two suites were removed because their coverage is now provided by external harnesses:

- ~~`01-dom-reactivity`~~ — replaced by `benchmarks/js-framework-benchmark/` (external harness)
- ~~`03-ssr-throughput`~~ — partially covered by `benchmarks/lumeland-benchmark/` (external harness)

Historical results for these suites remain in `benchmarks/results/` (see [Historical results](#historical-results)).

## External — `pnpm bench:external`

Canonical harness runs against external benchmark repos. Clones each harness into `.bench-cache/` (gitignored) on first run, then caches across subsequent runs.

```sh
pnpm bench:external              # run all registered adapters
pnpm bench:external jfb          # run only js-framework-benchmark
pnpm bench:external lumeland     # run only lumeland-benchmark
pnpm bench:external --clean      # wipe .bench-cache/ and re-clone
pnpm bench:external --save       # write results to benchmarks/results/external/
```

**First run is slow** (clone + install ~2–5 min). Subsequent runs are ~1 min (cache hit). `.bench-cache/` is gitignored — not committed.

### Registered adapters

- **`jfb`** — js-framework-benchmark. Runs the canonical js-framework-benchmark harness in `krausest/js-framework-benchmark`.
- **`lumeland`** — lumeland-benchmark. Runs the Deno-based SSG build-time harness in `lumeland/benchmark`.

### jsbenchmarks submission status

`jsbenchmarks` is not registered as an external adapter in `benchmarks/external/runner.js`. A submission-ready copy exists at `benchmarks/jsbenchmarks/coralite/` for manual testing or submission to `jsbenchmarks.com`.

## Coverage matrix

Which internal suite is covered by which external harness:

#### Registered External Adapters
- **js-framework-benchmark** (`jfb`) — DOM reactivity comparison using Playwright.
- **lumeland-benchmark** (`lumeland`) — SSG build-time comparison against other static site generators. Runs Deno harness. Requires Deno installed. CI cost: 1–5 min.
- **jsbenchmarks.com** (`jsbenchmarks`) — Submission-prep validator only. Validates structure of local submission copy at `benchmarks/jsbenchmarks/coralite/` and outputs submission instructions; does not run an external harness directly.

**Bundle size, hydration time, micro-benchmark cost, and lifecycle memory** are only measurable via `pnpm bench:internal`. The external harnesses measure DOM reactivity and SSG build time, not these.

## Historical results

**`benchmarks/results/`** — task-scoped results per the Phase 3 protocol in `AGENTS.md`. Contains `baseline.json` (canonical reference) and `p3-04` through `p3-07` before/after result files from the rc.6 development cycle.

**`benchmarks/results/external/`** — external harness runs. Files named `<adapter>-<YYYY-MM-DD>.json`. Produced by `pnpm bench:external --save`.

## Submission copies

The following directories contain submission-ready copies for external benchmark repos. They are structured to be dropped into the external harness's expected paths.

- **`js-framework-benchmark/coralite/`** — drop into `frameworks/keyed/coralite/` in `krausest/js-framework-benchmark`
- **`js-framework-benchmark/coralite-opt/`** — drop into `frameworks/keyed/coralite-opt/`
- **`lumeland-benchmark/coralite/`** — drop into `ssg/coralite/` in `lumeland/benchmark`
- **`jsbenchmarks/coralite/`** — drop into `benchmarks/coralite/` for `jsbenchmarks.com`

See each copy's `README.md` (if present) or the adapter's `submissionInstructions` for the full submission flow.

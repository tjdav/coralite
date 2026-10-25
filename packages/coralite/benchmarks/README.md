# Coralite Performance Benchmarks

This directory contains the comparative and micro-benchmark suite for the Coralite framework.

## Overview

The benchmark suite measures key performance characteristics of Coralite:
1. **02-bundle-hydration**: Production JS bundle payload size (raw & gzipped), client hydration duration, and Time to Interactive (TTI) compared against React 19, Vue 3, and Svelte 5.
2. **04-internal**: High-precision internal engine micro-benchmarks powered by `mitata`.
3. **05-stress-lifecycle**: Real-world stress, high-frequency streaming, selective hydration island scaling, and mount/unmount memory leak lifecycle benchmarks.

---

## Prerequisites & Hardware Requirements

- **Node.js**: `>= 20.19.0` (Node 22+ recommended)
- **pnpm**: `v11.22.0+`
- **Playwright Chromium**: Automatically installed via `pnpm exec playwright install chromium`

---

## How to Run Benchmarks

To run all benchmark suites in sequence:

```bash
pnpm bench:internal
# or
pnpm --filter coralite run bench:internal
```

### Running Specific Suites

You can run individual suites using the `--suite` flag:

```bash
# Run Bundle size & Hydration suite
node --expose-gc --experimental-vm-modules ./packages/coralite/benchmarks/runner.js --suite=bundle-hydration

# Run Internal Engine Micro-benchmarks
node --expose-gc --experimental-vm-modules ./packages/coralite/benchmarks/runner.js --suite=internal

# Run Stress, Streaming & Lifecycle suite
node --expose-gc --experimental-vm-modules ./packages/coralite/benchmarks/runner.js --suite=stress
```

### CLI Flags

| Flag | Shorthand | Description | Default |
| --- | --- | --- | --- |
| `--help` | `-h` | Display CLI options and usage | `false` |
| `--suite=<name>` | `-s <name>` | Select benchmark suite (`bundle-hydration`, `internal`, `stress`, or `all`) | `all` |
| `--json` | - | Write results JSON to `packages/coralite/benchmarks/results/latest.json` | `true` on `all` |
| `--check-regression` | - | Check current run against baseline (`baselines/baseline.json`) and exit code 1 on breach | `false` |
| `--warn-only` | - | Print performance regression warnings without exiting with code 1 | `false` |
| `--save-baseline` | - | Overwrite `baselines/baseline.json` with current run results | `false` |
| `--iterations=<n>` | `-i <n>` | Iteration count per browser test | `9` |

---

## CI Regression Gates & Baseline Management

Coralite includes an automated regression checking system that protects against performance degradation.

### Running Fast CI Regression Suite

```bash
pnpm bench:ci
# or
pnpm --filter coralite run bench:ci
```

### Baseline Management

To generate or update the stored canonical performance baseline:

```bash
pnpm bench:save-baseline
# or
pnpm --filter coralite run bench:save-baseline
```

### Strict Regression Thresholds

- **DOM Reactivity & Latency Metrics:** Warning at $>10\%$, Hard failure (`exit code 1`) at $>15\%$.
- **Client Gzipped Bundle Size:** Hard failure (`exit code 1`) at $>5\%$.

---

## Methodology & Suite Details

### Suite 2: Bundle Size & Hydration (`02-bundle-hydration`)
- **Environment**: Production esbuild bundling (`format: 'esm'`, `minify: true`, `target: 'esnext'`) and Playwright Chromium.
- **Metrics**:
  - `rawKB`: Raw JavaScript bundle size in KB.
  - `gzipKB`: Gzip-compressed bundle size in KB.
  - `hydrationMS`: In-browser hydration execution time measured via Performance API markers.
  - `ttiMS`: Time to Interactive after button click confirmation.
- **Targets**: `coraliteDynamic`, `coraliteStatic` (`no-hydration`), `react`, `vue`, and `svelte`.

### Suite 4: Internal Engine Micro-benchmarks (`04-internal`)
- **Engine**: Powered by [`mitata`](https://github.com/evanwashere/mitata).
- **Benchmarks**: AST token interpolation, Lazy Deep Proxy vs flat objects, and AST DOM element creation.

### Suite 5: Stress, Streaming & Lifecycle (`05-stress-lifecycle`)
- **Workloads**:
  1. **Selective Hydration & Island Scaling**: 50-component matrix comparing `coralite-selective` (48 static + 2 dynamic) against `coralite-dynamic`, `react`, `vue`, and `svelte`.
  2. **High-Frequency State Streaming**: 3-second stream at 100 updates/sec measuring batch microtask latency and dropped frames.
  3. **Mount/Unmount Memory Lifecycle**: 50 consecutive cycles mounting and unmounting 1,000 components with CDP GC assertions for $<0.5\text{ MB}$ net retention.

---

## Output Artifacts

1. `packages/coralite/benchmarks/results/latest.json`: Raw JSON results data containing environment metadata and suite statistics.
2. `packages/coralite/benchmarks/baselines/baseline.json`: Stored canonical performance baseline.
3. `packages/coralite/benchmarks/BENCHMARKS.md`: Formatted Markdown tables and system reproduction instructions.

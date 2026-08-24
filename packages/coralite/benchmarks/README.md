# Coralite Performance Benchmarks

This directory contains the comparative and micro-benchmark suite for the Coralite framework.

## Overview

The benchmark suite measures key performance characteristics of Coralite:
1. **01-dom-reactivity**: DOM manipulation & reactivity performance (create, replace, update, swap, clear rows, heap memory) compared against React 19, Vue 3, and Vanilla JS in Playwright Chromium.
2. **02-bundle-hydration**: Production JS bundle payload size (raw & gzipped), client hydration duration, and Time to Interactive (TTI) compared against React 19 and Vue 3.
3. **03-ssr-throughput**: Server-side compilation and rendering throughput across 100, 1,000, and 10,000 page workloads containing dynamic nested components.
4. **04-internal**: High-precision internal engine micro-benchmarks powered by `mitata`.

---

## Prerequisites & Hardware Requirements

- **Node.js**: `>= 20.19.0` (Node 22+ recommended)
- **pnpm**: `v11.22.0+`
- **Playwright Chromium**: Automatically installed via `pnpm exec playwright install chromium`

---

## How to Run Benchmarks

To run all benchmark suites in sequence:

```bash
pnpm bench
# or
pnpm --filter coralite run bench
```

> **Note on Baseline Comparison Methodology**:
> Vanilla JS represents handwritten, highly optimized surgical DOM manipulation without abstraction overhead, establishing the theoretical upper performance bound (optimal baseline). Component frameworks (Coralite, React 19, Vue 3) manage rendering declaratively through reactive state bindings and component lifecycles.

### Running Specific Suites

You can run individual suites using the `--suite` flag:

```bash
# Run DOM reactivity suite
node --expose-gc --experimental-vm-modules ./packages/coralite/benchmarks/runner.js --suite=dom-reactivity

# Run Bundle size & Hydration suite
node --expose-gc --experimental-vm-modules ./packages/coralite/benchmarks/runner.js --suite=bundle-hydration

# Run SSR Throughput suite
node --expose-gc --experimental-vm-modules ./packages/coralite/benchmarks/runner.js --suite=ssr-throughput

# Run Internal Engine Micro-benchmarks
node --expose-gc --experimental-vm-modules ./packages/coralite/benchmarks/runner.js --suite=internal
```

### CLI Flags

| Flag | Shorthand | Description | Default |
| --- | --- | --- | --- |
| `--help` | `-h` | Display CLI options and usage | `false` |
| `--suite=<name>` | `-s <name>` | Select benchmark suite (`dom-reactivity`, `bundle-hydration`, `ssr-throughput`, `internal`, or `all`) | `all` |
| `--json` | - | Write results JSON to `packages/coralite/benchmarks/results/latest.json` | `true` on `all` |
| `--iterations=<n>` | `-i <n>` | Iteration count per browser test | `5` |
| `--rows=<n>` | `-r <n>` | Row count for DOM reactivity suite | `1000` |

---

## Methodology & Suite Details

### Suite 1: DOM Reactivity (`01-dom-reactivity`)
- **Environment**: Playwright headless Chromium with CDP memory profiling.
- **Workloads**:
  - `create1k`: Create 1,000 table rows.
  - `replace1k`: Replace 1,000 table rows.
  - `update10th`: Update every 10th row.
  - `swapRows`: Swap 2 rows in a 1,000-row table.
  - `clear`: Clear all rows.
  - `heapMB`: JS heap memory consumed after garbage collection.
- **Frameworks**: Coralite vs React 19 vs Vue 3 vs Vanilla JS.

### Suite 2: Bundle Size & Hydration (`02-bundle-hydration`)
- **Environment**: Production esbuild bundling (`format: 'esm'`, `minify: true`, `target: 'esnext'`) and Playwright Chromium.
- **Metrics**:
  - `rawKB`: Raw JavaScript bundle size in KB.
  - `gzipKB`: Gzip-compressed bundle size in KB.
  - `hydrationMS`: In-browser hydration execution time measured via Performance API markers.
  - `ttiMS`: Time to Interactive after button click confirmation.
- **Targets**: `coraliteDynamic`, `coraliteStatic` (`no-hydration`), `react`, and `vue`.

### Suite 3: SSR Throughput (`03-ssr-throughput`)
- **Environment**: Node.js in-memory page/component generation.
- **Workloads**:
  - `100_pages`: 100 pages with nested `user-profile` and `nested-card` components.
  - `1000_pages`: 1,000 pages with nested components.
  - `10000_pages`: 10,000 pages with nested components.
- **Metrics**:
  - `totalPages`: Total page count.
  - `totalDurationMS`: Total compilation and rendering wall-clock time in ms.
  - `pagesPerSec`: SSR rendering throughput in pages/sec.
  - `avgLatencyMS`: Average latency per page in ms.
  - `heapUsedMB`: Peak JS heap memory used during compilation and rendering in MB.

### Suite 4: Internal Engine Micro-benchmarks (`04-internal`)
- **Engine**: Powered by [`mitata`](https://github.com/evanwashere/mitata).
- **Benchmarks**:
  - `token-interpolation.js`: Compares Coralite AST token replacement (`replaceToken`) against native RegExp replacement.
  - `lazy-proxy.js`: Compares Coralite Lazy Deep Proxy (`createReadOnlyProxy`) read/write property access vs standard flat JS objects and eager recursive proxies.
  - `ast-dom-creation.js`: Measures optimized `Object.setPrototypeOf` AST element creation throughput (`createCoraliteElement` / `createCoraliteTextNode`) vs legacy `Object.defineProperties`.

---

## Output Artifacts

When benchmarks are executed, two report artifacts are automatically written/updated:
1. `packages/coralite/benchmarks/results/latest.json`: Raw JSON results data containing environment metadata and suite statistics.
2. `packages/coralite/benchmarks/BENCHMARKS.md`: Formatted Markdown tables and system reproduction instructions.

# Coralite Benchmark Infrastructure

This directory contains committed benchmark result files, external benchmark runner infrastructure, and baselines for Coralite performance tracking.

## Two Benchmark Tracks

Coralite maintains two complementary benchmark tracks:

1. **Internal Track** (`pnpm bench:internal`)
   - **Location:** `packages/coralite/benchmarks/`
   - **Execution Time:** ~30 seconds
   - **Scope:** Fast local regression checks covering bundle hydration, internal micro-benchmarks, and stress lifecycle operations.
   - **Usage:** Executed before and after performance tasks (Phase 3 tasks). Results saved to `benchmarks/results/<task-id>.json`.

2. **External Track** (`pnpm bench:external`)
   - **Location:** `benchmarks/external/`
   - **Execution Time:** ~5–15 minutes
   - **Scope:** Canonical external harness validation comparing Coralite against industry benchmarks.
   - **Caching:** Clones external repositories into `.bench-cache/` (gitignored, cached across runs). First run includes clone & install (~2–5 min); subsequent warm runs take ~1 min.
   - **Usage:** Executed prior to major releases. Results saved to `benchmarks/results/external/<adapter>-<YYYY-MM-DD>.json` when invoked with `--save`.

---

## Suite Coverage Comparison

| Internal Suite | External Benchmark Equivalent | Description |
| :--- | :--- | :--- |
| `02-bundle-hydration` | *No direct external equivalent* | Measures bundle JS byte size (raw/gzip) and hydration timing. |
| `04-internal` | `js-framework-benchmark` (`jfb`) | DOM reactivity metrics (create, replace, update, swap, clear, memory). |
| `05-stress-lifecycle` | `lumeland-benchmark` (`lumeland`) | SSG build throughput and static site generation scale tests. |

---

## Internal Results File Schema

All internal task results and reference baselines are saved in `benchmarks/results/`:

- `benchmarks/results/baseline.json` — Reference performance baseline from main commit.
- `benchmarks/results/<task-id>.json` — Task-specific benchmark results (e.g. `p3-04.json`).

```json
{
  "taskId": "p3-04",
  "phase": "before",
  "commit": "abc1234",
  "runAt": "2026-10-14T12:00:00.000Z",
  "machine": {
    "cpu": "Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz",
    "cores": 8,
    "os": "Linux 6.8.0",
    "nodeVersion": "v22.22.2"
  },
  "results": {
    "dom-reactivity": {
      "create1k": 28.4,
      "replace1k": 34.3,
      "update10th": 7.9,
      "swapRows": 2.9,
      "clear": 3.0,
      "heapMB": 1.56
    },
    "bundle-hydration": {
      "rawJsKb": 64.9,
      "gzipJsKb": 17.2,
      "hydrationMs": 2.3,
      "ttiMs": 61.88
    },
    "ssrThroughput": {
      "100": { "durationMs": 106.5, "throughputPagesPerSec": 939 },
      "1000": { "durationMs": 683.3, "throughputPagesPerSec": 1463.5 },
      "10000": { "durationMs": 5465.7, "throughputPagesPerSec": 1829.6 }
    }
  }
}
```

---

## Invocation & Workflow

### Running Internal Benchmarks

```bash
# Record baseline before changes
pnpm bench:internal --task-id <task-id> --phase before --save

# Record measurements after changes
pnpm bench:internal --task-id <task-id> --phase after --save

# Inspect without saving
pnpm bench:internal --task-id <task-id> --phase after
```

### Running External Benchmarks

```bash
# Run all registered external adapters (or specific adapter e.g. jfb, lumeland)
pnpm bench:external lumeland

# Wipe cached clones and re-clone external repos
pnpm bench:external lumeland --clean

# Run and save results JSON to benchmarks/results/external/
pnpm bench:external lumeland --save
```

#### Registered External Adapters
- **js-framework-benchmark** (`jfb`) — DOM reactivity comparison using Playwright.
- **lumeland-benchmark** (`lumeland`) — SSG build-time comparison against other static site generators. Runs Deno harness. Requires Deno installed. CI cost: 1–5 min.
- **jsbenchmarks.com** (`jsbenchmarks`) — Submission-prep validator only. Validates structure of local submission copy at `benchmarks/jsbenchmarks/coralite/` and outputs submission instructions; does not run an external harness directly.

---

## Interpretation Caveat

> **Important:** Benchmark measurements are highly dependent on machine hardware, CPU frequency scaling, operating system, and Node runtime version. Results are only directly comparable when captured on the **same physical or virtual machine**. Always perform before and after runs on the same environment.

---

## Reference Baseline Management

- Canonical Baseline Location: `benchmarks/results/baseline.json`
- Updating Baseline:

```bash
pnpm bench:internal --task-id baseline --phase baseline --save
```

The baseline file is updated only when maintainers explicitly establish a new global reference point, not during individual task runs.

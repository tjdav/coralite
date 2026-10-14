# Coralite Benchmark Results Infrastructure

This directory contains committed benchmark result files for Coralite performance tasks and reference baselines.

## Location & File Naming

All performance task results and baselines are saved in `benchmarks/results/`:

- `benchmarks/results/baseline.json` — Reference performance baseline from main commit.
- `benchmarks/results/<task-id>.json` — Task-specific benchmark results (e.g. `p3-04.json`).

---

## Result File Schema

Each result file follows this JSON structure:

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

Performance tasks execute benchmark runs before and after changes and commit their result files.

### 1. Before Changes

Before making code modifications, record the baseline state for the task:

```bash
pnpm bench --task-id <task-id> --phase before --save
```

This writes or updates `benchmarks/results/<task-id>.json` with `phase: "before"`.

### 2. After Changes

After applying performance optimizations, record the new measurements:

```bash
pnpm bench --task-id <task-id> --phase after --save
```

This writes `benchmarks/results/<task-id>.json` with `phase: "after"`.

### 3. Printing Results to stdout

To inspect benchmark results without modifying saved files, omit the `--save` flag:

```bash
pnpm bench --task-id <task-id> --phase after
```

---

## Interpretation Caveat

> **Important:** Benchmark measurements are highly dependent on machine hardware, CPU frequency scaling, operating system, and Node runtime version. Results are only directly comparable when captured on the **same physical or virtual machine**. Always perform before and after runs on the same environment.

---

## Reference Baseline Management

- Canonical Baseline Location: `benchmarks/results/baseline.json`
- Updating Baseline:

```bash
pnpm bench --task-id baseline --phase baseline --save
```

The baseline file is updated only when maintainers explicitly establish a new global reference point, not during individual task runs.

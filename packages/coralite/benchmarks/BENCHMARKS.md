# Coralite Performance Benchmarks

Last updated: 2026-09-17T08:28:55.056Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 31 | 40.9 | 9.3 | 2.7 | 3.1 | 1.56 |
| svelte | 36.1 | 42.8 | 10.7 | 3.3 | 3.5 | 3.72 |
| react | 34.7 | 44.3 | 12.6 | 35.9 | 7.3 | 3.6 |
| vue | 37 | 39.9 | 10.6 | 4.7 | 4.1 | 3.12 |
| vanilla | 35.8 | 31.8 | 8.5 | 2 | 2.8 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 63.9 | 17 | 2.2 | 61.02 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 78.72 |
| vue | 76.7 | 30.7 | 3.7 | 76.56 |
| svelte | 48.1 | 18.2 | 1.8 | 73.64 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 106.1 | 942.5 | 1.06 | 3.3 |
| 1000_pages | 1000 | 705.9 | 1416.6 | 0.71 | 16.3 |
| 10000_pages | 10000 | 5859 | 1706.8 | 0.59 | 154.2 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6594081 | 151.7 | 1 |
| Native String.prototype.replace (regex) | 11719941 | 85.3 | 1.78 |
| Coralite Token Replace (attribute) | 10103917 | 99 | 1.53 |
| Coralite Read-Only Proxy (Deep Read) | 4052618 | 246.8 | 1 |
| Standard Flat Object Read (Deep Read) | 2285187230 | 0.4 | 563.88 |
| Eager Recursive Proxy (Deep Read) | 5581561 | 179.2 | 1.38 |
| Optimized Object.setPrototypeOf AST Element Creation | 1071327 | 933.4 | 1 |
| Legacy Object.defineProperties AST Element Creation | 943564 | 1059.8 | 0.88 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 63.2 | 16.7 | 0 |
| coralite-dynamic | 63.2 | 16.7 | 0 |
| react | 189.5 | 59.1 | 0.8 |
| vue | 76 | 30.4 | 4.9 |
| svelte | 49.6 | 18.7 | 2.5 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.039 | 103 | 3036.8 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.08 | 1.36 | 0.28 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

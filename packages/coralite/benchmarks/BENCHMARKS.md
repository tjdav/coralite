# Coralite Performance Benchmarks

Last updated: 2026-10-23T17:10:10.673Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 29.4 | 33 | 8.9 | 2 | 3.1 | 1.6 |
| svelte | 35.5 | 39.7 | 9.9 | 3 | 2.9 | 3.72 |
| react | 35.5 | 45.1 | 12.9 | 35.9 | 7.9 | 3.6 |
| vue | 36.6 | 37.1 | 11.2 | 4.2 | 3.9 | 3.12 |
| vanilla | 34.1 | 30.8 | 9 | 2 | 2.5 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 78.1 | 21.1 | 2.5 | 61.41 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 78.79 |
| vue | 76.7 | 30.7 | 3.6 | 61.82 |
| svelte | 48.1 | 18.2 | 1.8 | 61.68 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 98.6 | 1014.2 | 0.99 | 5.5 |
| 1000_pages | 1000 | 612.6 | 1632.4 | 0.61 | 22.4 |
| 10000_pages | 10000 | 4989.2 | 2004.3 | 0.5 | 215.6 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 15636651 | 64 | 1 |
| Native String.prototype.replace (regex) | 11123740 | 89.9 | 0.71 |
| Coralite Token Replace (attribute) | 13882078 | 72 | 0.89 |
| Coralite Read-Only Proxy (Deep Read) | 4863689 | 205.6 | 1 |
| Standard Flat Object Read (Deep Read) | 2315777711 | 0.4 | 476.14 |
| Eager Recursive Proxy (Deep Read) | 5689084 | 175.8 | 1.17 |
| Optimized Object.setPrototypeOf AST Element Creation | 1688517 | 592.2 | 1 |
| Legacy Object.defineProperties AST Element Creation | 1029808 | 971.1 | 0.61 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 77.4 | 20.8 | 0.1 |
| coralite-dynamic | 77.4 | 20.8 | 0 |
| react | 189.5 | 59.1 | 0.7 |
| vue | 76 | 30.4 | 4.8 |
| svelte | 49.6 | 18.7 | 2.3 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.026 | 141 | 3027.5 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.09 | 1.4 | 0.31 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

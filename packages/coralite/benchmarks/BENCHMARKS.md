# Coralite Performance Benchmarks

Last updated: 2026-09-17T09:10:01.341Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 28.7 | 34.9 | 8.5 | 2.9 | 3 | 1.56 |
| svelte | 37.8 | 46.3 | 12.4 | 4.4 | 3.9 | 3.72 |
| react | 35.1 | 44 | 14.4 | 36.4 | 8.7 | 3.6 |
| vue | 38.9 | 42 | 11.4 | 4.8 | 4.1 | 3.12 |
| vanilla | 37.5 | 33.9 | 8.7 | 2 | 2.5 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 64.4 | 17.1 | 2.2 | 61.07 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 79.89 |
| vue | 76.7 | 30.7 | 3.7 | 60.96 |
| svelte | 48.1 | 18.2 | 1.8 | 61.73 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 153.4 | 651.9 | 1.53 | 5.6 |
| 1000_pages | 1000 | 645.1 | 1550.1 | 0.65 | 14 |
| 10000_pages | 10000 | 5792.6 | 1726.3 | 0.58 | 154.1 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6704814 | 149.1 | 1 |
| Native String.prototype.replace (regex) | 11754574 | 85.1 | 1.75 |
| Coralite Token Replace (attribute) | 10400156 | 96.2 | 1.55 |
| Coralite Read-Only Proxy (Deep Read) | 3980712 | 251.2 | 1 |
| Standard Flat Object Read (Deep Read) | 2236442450 | 0.4 | 561.82 |
| Eager Recursive Proxy (Deep Read) | 5675544 | 176.2 | 1.43 |
| Optimized Object.setPrototypeOf AST Element Creation | 1054348 | 948.5 | 1 |
| Legacy Object.defineProperties AST Element Creation | 1003568 | 996.4 | 0.95 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 63.7 | 16.8 | 0 |
| coralite-dynamic | 63.7 | 16.8 | 0 |
| react | 189.5 | 59.1 | 0.7 |
| vue | 76 | 30.4 | 4.7 |
| svelte | 49.6 | 18.7 | 2.2 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.042 | 115 | 3037.3 |


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

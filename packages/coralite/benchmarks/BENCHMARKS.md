# Coralite Performance Benchmarks

Last updated: 2026-08-30T19:19:39.704Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 54.2 | 41.7 | 24 | 5.5 | 12.2 | 1.45 |
| react | 50.5 | 53.3 | 25.4 | 42.5 | 10.9 | 3.59 |
| vue | 55.6 | 63.2 | 20.1 | 15.1 | 11.2 | 3.11 |
| vanilla | 57.6 | 43.6 | 24.1 | 5.2 | 11.6 | 1.35 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 36.8 | 10.1 | 1.8 | 60.35 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 93.37 |
| vue | 76.7 | 30.7 | 3.8 | 76.41 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 94.8 | 1054.9 | 0.95 | 3.4 |
| 1000_pages | 1000 | 659.9 | 1515.4 | 0.66 | 16.7 |
| 10000_pages | 10000 | 5500.6 | 1818 | 0.55 | 157.3 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6623358 | 151 | 1 |
| Native String.prototype.replace (regex) | 11460448 | 87.3 | 1.73 |
| Coralite Token Replace (attribute) | 16941905 | 59 | 2.56 |
| Coralite Read-Only Proxy (Deep Read) | 3221354 | 310.4 | 1 |
| Standard Flat Object Read (Deep Read) | 2262450825 | 0.4 | 702.33 |
| Eager Recursive Proxy (Deep Read) | 5666164 | 176.5 | 1.76 |
| Optimized Object.setPrototypeOf AST Element Creation | 1072362 | 932.5 | 1 |
| Legacy Object.defineProperties AST Element Creation | 1025420 | 975.2 | 0.96 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 36.1 | 9.8 | 0 |
| coralite-dynamic | 36.1 | 9.8 | 0.1 |
| react | 189.5 | 59.1 | 0.9 |
| vue | 76 | 30.4 | 4.7 |
| svelte | 49.6 | 18.7 | 2.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.023 | 154 | 3031.2 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.07 | 1.29 | 0.22 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

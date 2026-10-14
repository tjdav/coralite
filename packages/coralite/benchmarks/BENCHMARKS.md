# Coralite Performance Benchmarks

Last updated: 2026-10-14T15:45:27.475Z

**Environment:** Node v22.22.1 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 65.4 | 78.6 | 18.4 | 5.8 | 7.1 | 1.58 |
| svelte | 75.2 | 85.6 | 23 | 8.5 | 7.9 | 3.73 |
| react | 75.8 | 90.3 | 35.3 | 76.7 | 13.2 | 3.6 |
| vue | 77.8 | 85.5 | 24.6 | 10.5 | 9 | 3.12 |
| vanilla | 80.1 | 67.1 | 18.5 | 5.4 | 6.4 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 72 | 19.1 | 4.9 | 148.9 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1.8 | 200.8 |
| vue | 76.7 | 30.7 | 12 | 222.1 |
| svelte | 48.1 | 18.2 | 3.7 | 150.48 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 534.3 | 187.2 | 5.34 | 2.6 |
| 1000_pages | 1000 | 2993.6 | 334 | 2.99 | 19.3 |
| 10000_pages | 10000 | 37870.5 | 264.1 | 3.79 | 178.8 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 2558085 | 390.9 | 1 |
| Native String.prototype.replace (regex) | 4595110 | 217.6 | 1.8 |
| Coralite Token Replace (attribute) | 4512852 | 221.6 | 1.76 |
| Coralite Read-Only Proxy (Deep Read) | 1532162 | 652.7 | 1 |
| Standard Flat Object Read (Deep Read) | 815608493 | 1.2 | 532.33 |
| Eager Recursive Proxy (Deep Read) | 2332151 | 428.8 | 1.52 |
| Optimized Object.setPrototypeOf AST Element Creation | 341898 | 2924.9 | 1 |
| Legacy Object.defineProperties AST Element Creation | 419137 | 2385.9 | 1.23 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 71.3 | 18.8 | 0.1 |
| coralite-dynamic | 71.3 | 18.8 | 0.1 |
| react | 189.5 | 59.1 | 1.5 |
| vue | 76 | 30.4 | 9.5 |
| svelte | 49.6 | 18.7 | 4.9 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.1 | 134 | 3110.9 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.08 | 1.38 | 0.3 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

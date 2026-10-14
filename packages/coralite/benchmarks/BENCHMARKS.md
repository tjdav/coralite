# Coralite Performance Benchmarks

Last updated: 2026-10-14T17:04:32.726Z

**Environment:** Node v22.22.1 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 59.4 | 76.7 | 18.5 | 8.1 | 6.3 | 1.58 |
| svelte | 71 | 81.8 | 21.1 | 7.6 | 7 | 3.72 |
| react | 69.5 | 93.2 | 28 | 72.9 | 13.3 | 3.6 |
| vue | 74.2 | 74.6 | 22.4 | 9.7 | 7.6 | 3.12 |
| vanilla | 74.7 | 65.1 | 17.4 | 4.7 | 5.9 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 72 | 19.1 | 4.6 | 147.12 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1.6 | 172.28 |
| vue | 76.7 | 30.7 | 7.9 | 160.83 |
| svelte | 48.1 | 18.2 | 3.7 | 145.82 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 377.2 | 265.1 | 3.77 | 3.8 |
| 1000_pages | 1000 | 2938.6 | 340.3 | 2.94 | 19.3 |
| 10000_pages | 10000 | 33880 | 295.2 | 3.39 | 177.4 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 2637012 | 379.2 | 1 |
| Native String.prototype.replace (regex) | 4850192 | 206.2 | 1.84 |
| Coralite Token Replace (attribute) | 4349838 | 229.9 | 1.65 |
| Coralite Read-Only Proxy (Deep Read) | 1534483 | 651.7 | 1 |
| Standard Flat Object Read (Deep Read) | 753841326 | 1.3 | 491.27 |
| Eager Recursive Proxy (Deep Read) | 2363840 | 423 | 1.54 |
| Optimized Object.setPrototypeOf AST Element Creation | 336534 | 2971.5 | 1 |
| Legacy Object.defineProperties AST Element Creation | 446657 | 2238.9 | 1.33 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 71.3 | 18.8 | 0 |
| coralite-dynamic | 71.3 | 18.8 | 0 |
| react | 189.5 | 59.1 | 1.6 |
| vue | 76 | 30.4 | 9.2 |
| svelte | 49.6 | 18.7 | 4.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.07 | 113 | 3092.7 |


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

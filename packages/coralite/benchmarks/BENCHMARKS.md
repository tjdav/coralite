# Coralite Performance Benchmarks

Last updated: 2026-10-14T18:49:08.455Z

**Environment:** Node v22.22.1 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 60.8 | 71.6 | 16.2 | 5.3 | 6.1 | 1.58 |
| svelte | 72.9 | 80.8 | 20.8 | 7.6 | 7 | 3.72 |
| react | 72.5 | 87.2 | 27.4 | 73.9 | 16 | 3.6 |
| vue | 75.5 | 76.4 | 22.9 | 10 | 7.9 | 3.12 |
| vanilla | 74.9 | 64.4 | 16.6 | 4.7 | 6 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 72.7 | 19.3 | 4.6 | 139.1 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1.7 | 173.7 |
| vue | 76.7 | 30.7 | 7.2 | 140.32 |
| svelte | 48.1 | 18.2 | 3.5 | 124.78 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 458.3 | 218.2 | 4.58 | 2.6 |
| 1000_pages | 1000 | 2760 | 362.3 | 2.76 | 19.3 |
| 10000_pages | 10000 | 30875.3 | 323.9 | 3.09 | 178.8 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 2450923 | 408 | 1 |
| Native String.prototype.replace (regex) | 4940345 | 202.4 | 2.02 |
| Coralite Token Replace (attribute) | 4565943 | 219 | 1.86 |
| Coralite Read-Only Proxy (Deep Read) | 1558520 | 641.6 | 1 |
| Standard Flat Object Read (Deep Read) | 835632008 | 1.2 | 536.17 |
| Eager Recursive Proxy (Deep Read) | 2373749 | 421.3 | 1.52 |
| Optimized Object.setPrototypeOf AST Element Creation | 348077 | 2872.9 | 1 |
| Legacy Object.defineProperties AST Element Creation | 437505 | 2285.7 | 1.26 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 72 | 19 | 0 |
| coralite-dynamic | 72 | 19 | 0.1 |
| react | 189.5 | 59.1 | 1.7 |
| vue | 76 | 30.4 | 9 |
| svelte | 49.6 | 18.7 | 4.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.061 | 113 | 3077.9 |


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

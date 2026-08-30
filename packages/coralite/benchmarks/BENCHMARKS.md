# Coralite Performance Benchmarks

Last updated: 2026-08-30T20:06:41.479Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 54.4 | 49.5 | 25.1 | 19.9 | 10.1 | 1.45 |
| react | 51.6 | 60.1 | 22.9 | 47.6 | 12.9 | 3.57 |
| vue | 52.7 | 54.5 | 23.3 | 8.7 | 9.5 | 3.11 |
| vanilla | 53.7 | 42.1 | 24.1 | 4.6 | 12.3 | 1.35 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 37 | 10.2 | 1.9 | 60.68 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 93.98 |
| vue | 76.7 | 30.7 | 3.8 | 77.45 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 96.9 | 1032 | 0.97 | 3.4 |
| 1000_pages | 1000 | 701.5 | 1425.5 | 0.7 | 16.7 |
| 10000_pages | 10000 | 5357.2 | 1866.6 | 0.54 | 157.3 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6512996 | 153.5 | 1 |
| Native String.prototype.replace (regex) | 10435199 | 95.8 | 1.6 |
| Coralite Token Replace (attribute) | 17639331 | 56.7 | 2.71 |
| Coralite Read-Only Proxy (Deep Read) | 3066264 | 326.1 | 1 |
| Standard Flat Object Read (Deep Read) | 2233541363 | 0.4 | 728.42 |
| Eager Recursive Proxy (Deep Read) | 5775406 | 173.1 | 1.88 |
| Optimized Object.setPrototypeOf AST Element Creation | 1097295 | 911.3 | 1 |
| Legacy Object.defineProperties AST Element Creation | 993660 | 1006.4 | 0.91 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 36.4 | 9.9 | 0 |
| coralite-dynamic | 36.4 | 9.9 | 0 |
| react | 189.5 | 59.1 | 0.7 |
| vue | 76 | 30.4 | 4.9 |
| svelte | 49.6 | 18.7 | 2.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.02 | 162 | 3027.1 |


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

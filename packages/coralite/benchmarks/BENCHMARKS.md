# Coralite Performance Benchmarks

Last updated: 2026-09-16T22:25:23.325Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 49.3 | 44.3 | 16.85 | 6.3 | 7.4 | 1.55 |
| react | 49.65 | 50.85 | 22.3 | 43.55 | 13.25 | 3.59 |
| vue | 46.35 | 41.05 | 17.65 | 6.5 | 12.85 | 3.12 |
| vanilla | 52.6 | 41 | 14.8 | 6.1 | 12.95 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 59.6 | 15.9 | 2.2 | 60.9 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 84.5 |
| vue | 76.7 | 30.7 | 3.6 | 61.38 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 95 | 1052.6 | 0.95 | 3.5 |
| 1000_pages | 1000 | 674.5 | 1482.6 | 0.67 | 16.3 |
| 10000_pages | 10000 | 5563.3 | 1797.5 | 0.56 | 154.3 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6520903 | 153.4 | 1 |
| Native String.prototype.replace (regex) | 11246331 | 88.9 | 1.72 |
| Coralite Token Replace (attribute) | 9898260 | 101 | 1.52 |
| Coralite Read-Only Proxy (Deep Read) | 3154191 | 317 | 1 |
| Standard Flat Object Read (Deep Read) | 2276237234 | 0.4 | 721.65 |
| Eager Recursive Proxy (Deep Read) | 5571764 | 179.5 | 1.77 |
| Optimized Object.setPrototypeOf AST Element Creation | 1058218 | 945 | 1 |
| Legacy Object.defineProperties AST Element Creation | 989783 | 1010.3 | 0.94 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 58.9 | 15.6 | 0 |
| coralite-dynamic | 58.9 | 15.6 | 0 |
| react | 189.5 | 59.1 | 0.7 |
| vue | 76 | 30.4 | 4.9 |
| svelte | 49.6 | 18.7 | 10.3 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.044 | 160 | 3034.1 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.08 | 5.48 | 4.4 | ❌ Failed (>=0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

# Coralite Performance Benchmarks

Last updated: 2026-08-30T19:39:24.814Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 53.9 | 45.5 | 27.4 | 5 | 11 | 1.45 |
| react | 48.3 | 65.3 | 22 | 44.5 | 8.4 | 3.58 |
| vue | 52 | 60.4 | 22.5 | 7.4 | 9.3 | 3.11 |
| vanilla | 57.9 | 45.4 | 21.5 | 18 | 10.6 | 1.35 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 36.8 | 10.1 | 1.8 | 60.54 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 93.21 |
| vue | 76.7 | 30.7 | 3.8 | 76.68 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 155.9 | 641.4 | 1.56 | 5.7 |
| 1000_pages | 1000 | 676.2 | 1478.9 | 0.68 | 14.5 |
| 10000_pages | 10000 | 5753.8 | 1738 | 0.58 | 159.6 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6279915 | 159.2 | 1 |
| Native String.prototype.replace (regex) | 10751973 | 93 | 1.71 |
| Coralite Token Replace (attribute) | 16620220 | 60.2 | 2.65 |
| Coralite Read-Only Proxy (Deep Read) | 3075469 | 325.2 | 1 |
| Standard Flat Object Read (Deep Read) | 2260777963 | 0.4 | 735.1 |
| Eager Recursive Proxy (Deep Read) | 5569778 | 179.5 | 1.81 |
| Optimized Object.setPrototypeOf AST Element Creation | 1017876 | 982.4 | 1 |
| Legacy Object.defineProperties AST Element Creation | 980960 | 1019.4 | 0.96 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 36.1 | 9.9 | 0.1 |
| coralite-dynamic | 36.1 | 9.9 | 0 |
| react | 189.5 | 59.1 | 0.7 |
| vue | 76 | 30.4 | 4.7 |
| svelte | 49.6 | 18.7 | 2.3 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.018 | 168 | 3026.8 |


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

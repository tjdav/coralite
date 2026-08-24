# Coralite Performance Benchmarks

Last updated: 2026-08-24T20:44:07.937Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 15.7 | 16.1 | 16 | 15.9 | 15.6 | 1.33 |
| react | 54.9 | 62.5 | 25.9 | 51.2 | 12.6 | 3.58 |
| vue | 59.2 | 69 | 23.4 | 16 | 10.5 | 3.11 |
| vanilla | 58.5 | 48.4 | 21.2 | 18.1 | 10.7 | 1.37 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 34.1 | 9.5 | 1.8 | 60.34 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 93.51 |
| vue | 76.7 | 30.7 | 3.9 | 76.66 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 197 | 507.6 | 1.97 | 6 |
| 1000_pages | 1000 | 867.8 | 1152.3 | 0.87 | 17.5 |
| 10000_pages | 10000 | 7695.6 | 1299.4 | 0.77 | 188.6 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6574068 | 152.1 | 1 |
| Native String.prototype.replace (regex) | 11546557 | 86.6 | 1.76 |
| Coralite Token Replace (attribute) | 16637451 | 60.1 | 2.53 |
| Coralite Read-Only Proxy (Deep Read) | 3119269 | 320.6 | 1 |
| Standard Flat Object Read (Deep Read) | 2257222600 | 0.4 | 723.64 |
| Eager Recursive Proxy (Deep Read) | 5514691 | 181.3 | 1.77 |
| Optimized Object.setPrototypeOf AST Element Creation | 997097 | 1002.9 | 1 |
| Legacy Object.defineProperties AST Element Creation | 962579 | 1038.9 | 0.97 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 33.4 | 9.2 | 0 |
| coralite-dynamic | 33.4 | 9.2 | 0 |
| react | 189.5 | 59.1 | 0.8 |
| vue | 76 | 30.4 | 4.8 |
| svelte | 49.6 | 18.7 | 2.2 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.05 | 150 | 3044.4 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.07 | 3.17 | 2.1 | ❌ Failed (>=0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

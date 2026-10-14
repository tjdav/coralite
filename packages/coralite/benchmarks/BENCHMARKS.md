# Coralite Performance Benchmarks

Last updated: 2026-10-14T17:47:09.400Z

**Environment:** Node v22.22.1 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 65.1 | 77.3 | 18.5 | 6 | 6.8 | 1.58 |
| svelte | 78.9 | 87.5 | 23.5 | 8.9 | 8.2 | 3.72 |
| react | 75.9 | 89.9 | 29.3 | 77.8 | 15.8 | 3.6 |
| vue | 78.3 | 80.2 | 25 | 10.6 | 9 | 3.12 |
| vanilla | 79.7 | 68 | 19 | 5.5 | 6.5 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 72.7 | 19.3 | 4.7 | 139.36 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1.7 | 186.46 |
| vue | 76.7 | 30.7 | 7.5 | 150.11 |
| svelte | 48.1 | 18.2 | 3.6 | 140.26 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 422.6 | 236.6 | 4.23 | 2.6 |
| 1000_pages | 1000 | 2769 | 361.1 | 2.77 | 11.2 |
| 10000_pages | 10000 | 31478.8 | 317.7 | 3.15 | 186.6 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 2584579 | 386.9 | 1 |
| Native String.prototype.replace (regex) | 4798539 | 208.4 | 1.86 |
| Coralite Token Replace (attribute) | 4341642 | 230.3 | 1.68 |
| Coralite Read-Only Proxy (Deep Read) | 1530206 | 653.5 | 1 |
| Standard Flat Object Read (Deep Read) | 663486912 | 1.5 | 433.59 |
| Eager Recursive Proxy (Deep Read) | 2327931 | 429.6 | 1.52 |
| Optimized Object.setPrototypeOf AST Element Creation | 313895 | 3185.8 | 1 |
| Legacy Object.defineProperties AST Element Creation | 431001 | 2320.2 | 1.37 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 72 | 19 | 0.1 |
| coralite-dynamic | 72 | 19 | 0.1 |
| react | 189.5 | 59.1 | 1.7 |
| vue | 76 | 30.4 | 10.3 |
| svelte | 49.6 | 18.7 | 5.6 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.116 | 146 | 3127 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.08 | 1.39 | 0.31 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

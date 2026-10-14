# Coralite Performance Benchmarks

Last updated: 2026-10-14T10:38:39.742Z

**Environment:** Node v22.22.1 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 58.9 | 71.6 | 16.9 | 4.7 | 5.8 | 1.57 |
| svelte | 76.6 | 81.8 | 20.9 | 7.7 | 7.2 | 3.72 |
| react | 71 | 85.8 | 27.2 | 71.7 | 13.8 | 3.6 |
| vue | 73.7 | 75.4 | 21.1 | 9.3 | 7.7 | 3.12 |
| vanilla | 73.6 | 64.7 | 16.3 | 4.3 | 5.5 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 71 | 18.9 | 4.5 | 138.18 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1.6 | 175.93 |
| vue | 76.7 | 30.7 | 7.8 | 140.76 |
| svelte | 48.1 | 18.2 | 3.5 | 137.2 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 475.5 | 210.3 | 4.75 | 3.7 |
| 1000_pages | 1000 | 2548.6 | 392.4 | 2.55 | 19.3 |
| 10000_pages | 10000 | 30650.4 | 326.3 | 3.07 | 177.4 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 2596743 | 385.1 | 1 |
| Native String.prototype.replace (regex) | 4829488 | 207.1 | 1.86 |
| Coralite Token Replace (attribute) | 4629537 | 216 | 1.78 |
| Coralite Read-Only Proxy (Deep Read) | 1561576 | 640.4 | 1 |
| Standard Flat Object Read (Deep Read) | 828617775 | 1.2 | 530.63 |
| Eager Recursive Proxy (Deep Read) | 2375027 | 421 | 1.52 |
| Optimized Object.setPrototypeOf AST Element Creation | 339070 | 2949.2 | 1 |
| Legacy Object.defineProperties AST Element Creation | 423404 | 2361.8 | 1.25 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 70.3 | 18.7 | 0.1 |
| coralite-dynamic | 70.3 | 18.7 | 0 |
| react | 189.5 | 59.1 | 1.6 |
| vue | 76 | 30.4 | 10.2 |
| svelte | 49.6 | 18.7 | 4.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.063 | 126 | 3079 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.08 | 1.37 | 0.29 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

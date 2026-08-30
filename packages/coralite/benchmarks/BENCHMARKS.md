# Coralite Performance Benchmarks

Last updated: 2026-08-30T21:01:17.281Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 59.8 | 45.2 | 22.15 | 18.65 | 10.85 | 1.45 |
| react | 52 | 52 | 23.55 | 45.95 | 10.1 | 3.6 |
| vue | 53.9 | 52.7 | 20.85 | 16.25 | 10.75 | 3.12 |
| vanilla | 57.25 | 45.25 | 22.05 | 5.4 | 10.95 | 1.36 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 37 | 10.2 | 2.05 | 67.52 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 92.56 |
| vue | 76.7 | 30.7 | 3.9 | 76.19 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 99 | 1010.1 | 0.99 | 3.5 |
| 1000_pages | 1000 | 722.2 | 1384.7 | 0.72 | 16.7 |
| 10000_pages | 10000 | 5559.2 | 1798.8 | 0.56 | 149.8 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6641878 | 150.6 | 1 |
| Native String.prototype.replace (regex) | 12823806 | 78 | 1.93 |
| Coralite Token Replace (attribute) | 16739424 | 59.7 | 2.52 |
| Coralite Read-Only Proxy (Deep Read) | 2778275 | 359.9 | 1 |
| Standard Flat Object Read (Deep Read) | 2300750383 | 0.4 | 828.12 |
| Eager Recursive Proxy (Deep Read) | 5678994 | 176.1 | 2.04 |
| Optimized Object.setPrototypeOf AST Element Creation | 1060324 | 943.1 | 1 |
| Legacy Object.defineProperties AST Element Creation | 985415 | 1014.8 | 0.93 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 36.4 | 9.9 | 0.1 |
| coralite-dynamic | 36.4 | 9.9 | 0 |
| react | 189.5 | 59.1 | 0.9 |
| vue | 76 | 30.4 | 4.7 |
| svelte | 49.6 | 18.7 | 2.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.034 | 153 | 3034.4 |


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

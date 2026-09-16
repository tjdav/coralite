# Coralite Performance Benchmarks

Last updated: 2026-09-16T23:04:22.580Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 32.1 | 40 | 10.1 | 2.7 | 3.1 | 1.55 |
| svelte | 35.7 | 48 | 10.6 | 3.3 | 3.1 | 3.72 |
| react | 34.4 | 41.6 | 13.4 | 34.1 | 6.7 | 3.6 |
| vue | 40.5 | 39.8 | 11.9 | 4.8 | 4.4 | 3.12 |
| vanilla | 38.6 | 35.3 | 9.4 | 2.2 | 2.6 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 59.6 | 15.9 | 2.3 | 61.02 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.9 | 92.8 |
| vue | 76.7 | 30.7 | 3.6 | 76.21 |
| svelte | 48.1 | 18.2 | 1.9 | 74.95 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 104.3 | 958.8 | 1.04 | 3.3 |
| 1000_pages | 1000 | 650 | 1538.5 | 0.65 | 16.3 |
| 10000_pages | 10000 | 5820 | 1718.2 | 0.58 | 154.9 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 7064015 | 141.6 | 1 |
| Native String.prototype.replace (regex) | 12063494 | 82.9 | 1.71 |
| Coralite Token Replace (attribute) | 10152264 | 98.5 | 1.44 |
| Coralite Read-Only Proxy (Deep Read) | 3135428 | 318.9 | 1 |
| Standard Flat Object Read (Deep Read) | 2293672569 | 0.4 | 731.53 |
| Eager Recursive Proxy (Deep Read) | 5656512 | 176.8 | 1.8 |
| Optimized Object.setPrototypeOf AST Element Creation | 1052908 | 949.8 | 1 |
| Legacy Object.defineProperties AST Element Creation | 999779 | 1000.2 | 0.95 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 58.9 | 15.6 | 0.1 |
| coralite-dynamic | 58.9 | 15.6 | 0 |
| react | 189.5 | 59.1 | 0.9 |
| vue | 76 | 30.4 | 5.3 |
| svelte | 49.6 | 18.7 | 2.4 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.033 | 156 | 3031.8 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.08 | 1.35 | 0.27 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

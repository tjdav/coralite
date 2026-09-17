# Coralite Performance Benchmarks

Last updated: 2026-09-17T08:53:21.233Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 29 | 35.1 | 8.4 | 3 | 3 | 1.56 |
| svelte | 38.1 | 51.3 | 10.8 | 3.2 | 3.1 | 3.72 |
| react | 35.3 | 41 | 12.5 | 35.9 | 7.3 | 3.6 |
| vue | 38.1 | 39 | 11.8 | 4 | 3.6 | 3.12 |
| vanilla | 35.5 | 31.3 | 7.7 | 1.9 | 2.4 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 64.2 | 17.1 | 2.2 | 62.27 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 78.55 |
| vue | 76.7 | 30.7 | 3.6 | 61.99 |
| svelte | 48.1 | 18.2 | 1.8 | 61.63 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 160.9 | 621.5 | 1.61 | 5.5 |
| 1000_pages | 1000 | 624 | 1602.6 | 0.62 | 14 |
| 10000_pages | 10000 | 5868 | 1704.2 | 0.59 | 154.1 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6692722 | 149.4 | 1 |
| Native String.prototype.replace (regex) | 10656436 | 93.8 | 1.59 |
| Coralite Token Replace (attribute) | 9663616 | 103.5 | 1.44 |
| Coralite Read-Only Proxy (Deep Read) | 4023366 | 248.5 | 1 |
| Standard Flat Object Read (Deep Read) | 2315014926 | 0.4 | 575.39 |
| Eager Recursive Proxy (Deep Read) | 5754904 | 173.8 | 1.43 |
| Optimized Object.setPrototypeOf AST Element Creation | 1068704 | 935.7 | 1 |
| Legacy Object.defineProperties AST Element Creation | 980597 | 1019.8 | 0.92 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 63.5 | 16.8 | 0 |
| coralite-dynamic | 63.5 | 16.8 | 0.1 |
| react | 189.5 | 59.1 | 0.8 |
| vue | 76 | 30.4 | 4.6 |
| svelte | 49.6 | 18.7 | 2.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.039 | 109 | 3039.9 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.08 | 1.36 | 0.28 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

# Coralite Performance Benchmarks

Last updated: 2026-09-17T07:14:18.303Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 31.3 | 37.2 | 9.7 | 2.8 | 3.1 | 1.56 |
| svelte | 36.3 | 42.4 | 10.6 | 3.3 | 3.1 | 3.72 |
| react | 33.7 | 43.1 | 11.6 | 34.6 | 8.8 | 3.6 |
| vue | 36.9 | 40.7 | 11.8 | 4.4 | 4 | 3.12 |
| vanilla | 35.1 | 31.9 | 8.3 | 2.2 | 2.8 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 63.6 | 17 | 2.2 | 60.69 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 78.63 |
| vue | 76.7 | 30.7 | 3.7 | 62.39 |
| svelte | 48.1 | 18.2 | 1.8 | 61.22 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 167.6 | 596.7 | 1.68 | 5.5 |
| 1000_pages | 1000 | 656.7 | 1522.8 | 0.66 | 14 |
| 10000_pages | 10000 | 5683 | 1759.6 | 0.57 | 154.3 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6513976 | 153.5 | 1 |
| Native String.prototype.replace (regex) | 13335381 | 75 | 2.05 |
| Coralite Token Replace (attribute) | 10854246 | 92.1 | 1.67 |
| Coralite Read-Only Proxy (Deep Read) | 4273154 | 234 | 1 |
| Standard Flat Object Read (Deep Read) | 2312099115 | 0.4 | 541.08 |
| Eager Recursive Proxy (Deep Read) | 5711660 | 175.1 | 1.34 |
| Optimized Object.setPrototypeOf AST Element Creation | 1060290 | 943.1 | 1 |
| Legacy Object.defineProperties AST Element Creation | 1000011 | 1000 | 0.94 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 62.9 | 16.7 | 0.1 |
| coralite-dynamic | 62.9 | 16.7 | 0 |
| react | 189.5 | 59.1 | 0.8 |
| vue | 76 | 30.4 | 4.8 |
| svelte | 49.6 | 18.7 | 2.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.022 | 145 | 3026.1 |


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

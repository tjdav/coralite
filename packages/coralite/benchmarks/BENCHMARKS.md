# Coralite Performance Benchmarks

Last updated: 2026-08-30T18:43:50.515Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 53.8 | 45.3 | 20.7 | 5.3 | 12.4 | 1.47 |
| react | 50.1 | 55.8 | 25.1 | 52.6 | 14.8 | 3.57 |
| vue | 57.4 | 61.7 | 23.5 | 18 | 10.2 | 3.11 |
| vanilla | 55.7 | 46.8 | 25.3 | 5.8 | 11.7 | 1.35 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 36.3 | 10 | 1.8 | 72.81 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.8 | 93.1 |
| vue | 76.7 | 30.7 | 3.9 | 76.99 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 155.5 | 643.1 | 1.55 | 5.7 |
| 1000_pages | 1000 | 678.4 | 1474.1 | 0.68 | 14.5 |
| 10000_pages | 10000 | 5568.5 | 1795.8 | 0.56 | 159.4 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6876135 | 145.4 | 1 |
| Native String.prototype.replace (regex) | 11712728 | 85.4 | 1.7 |
| Coralite Token Replace (attribute) | 16437657 | 60.8 | 2.39 |
| Coralite Read-Only Proxy (Deep Read) | 3172622 | 315.2 | 1 |
| Standard Flat Object Read (Deep Read) | 2292552032 | 0.4 | 722.6 |
| Eager Recursive Proxy (Deep Read) | 5596181 | 178.7 | 1.76 |
| Optimized Object.setPrototypeOf AST Element Creation | 1043471 | 958.3 | 1 |
| Legacy Object.defineProperties AST Element Creation | 988433 | 1011.7 | 0.95 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 35.6 | 9.7 | 0 |
| coralite-dynamic | 35.6 | 9.7 | 0 |
| react | 189.5 | 59.1 | 0.8 |
| vue | 76 | 30.4 | 5 |
| svelte | 49.6 | 18.7 | 2.2 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.023 | 163 | 3028.4 |


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

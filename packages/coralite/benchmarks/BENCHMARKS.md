# Coralite Performance Benchmarks

Last updated: 2026-10-15T06:02:56.392Z

**Environment:** Node v22.22.1 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 62.4 | 74.4 | 18 | 5.4 | 6.4 | 1.58 |
| svelte | 75.3 | 86.2 | 22.7 | 8.3 | 7.5 | 3.72 |
| react | 73.9 | 88.9 | 28.7 | 72.3 | 17.3 | 3.6 |
| vue | 75.7 | 78.4 | 22.9 | 9.9 | 8.3 | 3.12 |
| vanilla | 76.6 | 65.9 | 18 | 4.9 | 6.5 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 74.6 | 19.9 | 4.8 | 140.01 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1.7 | 172.34 |
| vue | 76.7 | 30.7 | 7.4 | 149.12 |
| svelte | 48.1 | 18.2 | 3.6 | 140.28 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 391.8 | 255.2 | 3.92 | 2.6 |
| 1000_pages | 1000 | 2556 | 391.2 | 2.56 | 11.3 |
| 10000_pages | 10000 | 30407.1 | 328.9 | 3.04 | 187.5 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 2615163 | 382.4 | 1 |
| Native String.prototype.replace (regex) | 4890483 | 204.5 | 1.87 |
| Coralite Token Replace (attribute) | 4577110 | 218.5 | 1.75 |
| Coralite Read-Only Proxy (Deep Read) | 1535328 | 651.3 | 1 |
| Standard Flat Object Read (Deep Read) | 824414927 | 1.2 | 536.96 |
| Eager Recursive Proxy (Deep Read) | 2294413 | 435.8 | 1.49 |
| Optimized Object.setPrototypeOf AST Element Creation | 332657 | 3006.1 | 1 |
| Legacy Object.defineProperties AST Element Creation | 429015 | 2330.9 | 1.29 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 73.9 | 19.7 | 0 |
| coralite-dynamic | 73.9 | 19.7 | 0 |
| react | 189.5 | 59.1 | 1.7 |
| vue | 76 | 30.4 | 9.7 |
| svelte | 49.6 | 18.7 | 4.2 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.08 | 137 | 3091.7 |


### Stress & Lifecycle: Mount/Unmount Memory Retention

| Cycles | Components / Cycle | Initial Heap (MB) | Final Heap (MB) | Net Retention (MB) | Status |
| --- | --- | --- | --- | --- | --- |
| 50 | 1000 | 1.08 | 1.38 | 0.3 | ✅ Passed (<0.5 MB) |

## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

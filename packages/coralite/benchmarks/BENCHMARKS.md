# Coralite Performance Benchmarks

Last updated: 2026-09-19T08:01:58.002Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 28.4 | 34.3 | 7.9 | 2.9 | 3 | 1.56 |
| svelte | 36.9 | 49.8 | 11.4 | 4 | 3.5 | 3.72 |
| react | 35.5 | 45.4 | 16.4 | 38.1 | 8.9 | 3.6 |
| vue | 38.3 | 38.4 | 11.6 | 4.6 | 4.1 | 3.12 |
| vanilla | 34.9 | 30.5 | 8.3 | 1.6 | 2.3 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 64.9 | 17.2 | 2.3 | 61.88 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.9 | 78.05 |
| vue | 76.7 | 30.7 | 3.6 | 61.54 |
| svelte | 48.1 | 18.2 | 1.9 | 61.24 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 106.5 | 939 | 1.06 | 3.3 |
| 1000_pages | 1000 | 683.3 | 1463.5 | 0.68 | 15.8 |
| 10000_pages | 10000 | 5465.7 | 1829.6 | 0.55 | 148.2 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 7007375 | 142.7 | 1 |
| Native String.prototype.replace (regex) | 10083937 | 99.2 | 1.44 |
| Coralite Token Replace (attribute) | 9673175 | 103.4 | 1.38 |
| Coralite Read-Only Proxy (Deep Read) | 4157829 | 240.5 | 1 |
| Standard Flat Object Read (Deep Read) | 2301657942 | 0.4 | 553.57 |
| Eager Recursive Proxy (Deep Read) | 5722922 | 174.7 | 1.38 |
| Optimized Object.setPrototypeOf AST Element Creation | 1060498 | 943 | 1 |
| Legacy Object.defineProperties AST Element Creation | 1037626 | 963.7 | 0.98 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 64.2 | 17 | 0 |
| coralite-dynamic | 64.2 | 17 | 0 |
| react | 189.5 | 59.1 | 0.9 |
| vue | 76 | 30.4 | 4.7 |
| svelte | 49.6 | 18.7 | 2.1 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.021 | 160 | 3029.4 |


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

# Coralite Performance Benchmarks

Last updated: 2026-10-14T16:09:34.157Z

**Environment:** Node v22.22.1 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 62.7 | 75.9 | 18.2 | 8.4 | 6.4 | 1.58 |
| svelte | 76.7 | 85.1 | 22 | 8.6 | 7.7 | 3.72 |
| react | 73.4 | 88.7 | 28.2 | 75.1 | 12.6 | 3.6 |
| vue | 78.7 | 81.5 | 24.1 | 10.3 | 8.5 | 3.12 |
| vanilla | 78.5 | 70.1 | 17.9 | 5.1 | 6.1 | 1.38 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 72 | 19.1 | 4.7 | 151.85 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1.7 | 174.35 |
| vue | 76.7 | 30.7 | 7.4 | 140.69 |
| svelte | 48.1 | 18.2 | 3.6 | 139.83 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 425.8 | 234.9 | 4.26 | 2.5 |
| 1000_pages | 1000 | 2691.1 | 371.6 | 2.69 | 11.2 |
| 10000_pages | 10000 | 34541.1 | 289.5 | 3.45 | 186.8 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 2579481 | 387.7 | 1 |
| Native String.prototype.replace (regex) | 4919905 | 203.3 | 1.91 |
| Coralite Token Replace (attribute) | 4460626 | 224.2 | 1.73 |
| Coralite Read-Only Proxy (Deep Read) | 1539736 | 649.5 | 1 |
| Standard Flat Object Read (Deep Read) | 822275285 | 1.2 | 534.04 |
| Eager Recursive Proxy (Deep Read) | 2334802 | 428.3 | 1.52 |
| Optimized Object.setPrototypeOf AST Element Creation | 345612 | 2893.4 | 1 |
| Legacy Object.defineProperties AST Element Creation | 429402 | 2328.8 | 1.24 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 71.3 | 18.8 | 0.1 |
| coralite-dynamic | 71.3 | 18.8 | 0.1 |
| react | 189.5 | 59.1 | 2 |
| vue | 76 | 30.4 | 15.9 |
| svelte | 49.6 | 18.7 | 4.3 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.095 | 109 | 3106.8 |


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

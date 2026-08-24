# Coralite Performance Benchmarks

Last updated: 2026-08-24T21:16:36.434Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 16 | 16.1 | 15.8 | 15.9 | 15.6 | 1.33 |
| react | 48.4 | 53.4 | 26.8 | 58.6 | 11.1 | 3.58 |
| vue | 62.8 | 57.2 | 22.7 | 10.9 | 9.1 | 3.11 |
| vanilla | 52.5 | 48.4 | 26.1 | 19.6 | 10.8 | 1.37 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 34.1 | 9.5 | 2 | 76.83 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.9 | 91.69 |
| vue | 76.7 | 30.7 | 3.8 | 75.1 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 127.7 | 783.1 | 1.28 | 3.7 |
| 1000_pages | 1000 | 890.3 | 1123.2 | 0.89 | 19.7 |
| 10000_pages | 10000 | 7733.3 | 1293.1 | 0.77 | 186.1 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6311532 | 158.4 | 1 |
| Native String.prototype.replace (regex) | 11245239 | 88.9 | 1.78 |
| Coralite Token Replace (attribute) | 15029774 | 66.5 | 2.38 |
| Coralite Read-Only Proxy (Deep Read) | 3094680 | 323.1 | 1 |
| Standard Flat Object Read (Deep Read) | 2246374589 | 0.4 | 725.88 |
| Eager Recursive Proxy (Deep Read) | 5593550 | 178.8 | 1.81 |
| Optimized Object.setPrototypeOf AST Element Creation | 1055249 | 947.6 | 1 |
| Legacy Object.defineProperties AST Element Creation | 920204 | 1086.7 | 0.87 |


### Stress & Lifecycle: Selective Hydration & Island Scaling

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) |
| --- | --- | --- | --- |
| coralite-selective | 33.4 | 9.2 | 0 |
| coralite-dynamic | 33.4 | 9.2 | 0 |
| react | 189.5 | 59.1 | 0.8 |
| vue | 76 | 30.4 | 5.1 |
| svelte | 49.6 | 18.7 | 2.2 |


### Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)

| Total Updates | Avg Batch Latency (ms) | Dropped Frames | Peak CPU Time (ms) |
| --- | --- | --- | --- |
| 300 | 0.043 | 136 | 3040.8 |


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

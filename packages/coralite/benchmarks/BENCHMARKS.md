# Coralite Performance Benchmarks

Last updated: 2026-08-24T15:16:34.429Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 15.8 | 15.9 | 15.6 | 15.2 | 15.9 | 9.54 |
| react | 72.8 | 66.1 | 27.3 | 57.8 | 13.9 | 9.54 |
| vue | 63.1 | 63.5 | 27.8 | 16.2 | 9.2 | 9.54 |
| vanilla | 58.9 | 47.2 | 25.4 | 16.9 | 9.9 | 9.54 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 34.1 | 9.5 | 1.9 | 76.66 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 0.9 | 93.23 |
| vue | 76.7 | 30.7 | 3.9 | 74.01 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 131.2 | 762.2 | 1.31 | 3.8 |
| 1000_pages | 1000 | 1068.6 | 935.8 | 1.07 | 19.7 |
| 10000_pages | 10000 | 8165.3 | 1224.7 | 0.82 | 179.7 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6834237 | 146.3 | 1 |
| Native String.prototype.replace (regex) | 11505931 | 86.9 | 1.68 |
| Coralite Token Replace (attribute) | 18076218 | 55.3 | 2.64 |
| Coralite Read-Only Proxy (Deep Read) | 3220383 | 310.5 | 0.47 |
| Standard Flat Object Read (Deep Read) | 14081037983 | 0.1 | 2060.37 |
| Eager Recursive Proxy (Deep Read) | 5533261 | 180.7 | 0.81 |
| Optimized Object.setPrototypeOf AST Element Creation | 1005463 | 994.6 | 0.15 |
| Legacy Object.defineProperties AST Element Creation | 953648 | 1048.6 | 0.14 |


## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

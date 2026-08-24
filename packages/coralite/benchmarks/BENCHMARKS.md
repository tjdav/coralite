# Coralite Performance Benchmarks

Last updated: 2026-08-24T16:01:31.441Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 15.9 | 15.6 | 16.1 | 15.6 | 15.8 | 1.33 |
| react | 54.9 | 56.9 | 25.8 | 53.7 | 11.6 | 3.59 |
| vue | 57.7 | 69.8 | 24.9 | 15.4 | 9.2 | 3.11 |
| vanilla | 60.3 | 50 | 23.7 | 17.5 | 10.4 | 1.37 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 34.1 | 9.5 | 1.9 | 75.65 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1 | 91.72 |
| vue | 76.7 | 30.7 | 3.9 | 71.7 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 199.4 | 501.5 | 1.99 | 6 |
| 1000_pages | 1000 | 893.4 | 1119.3 | 0.89 | 17.5 |
| 10000_pages | 10000 | 7840.3 | 1275.5 | 0.78 | 185.6 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6155877 | 162.4 | 1 |
| Native String.prototype.replace (regex) | 12069953 | 82.9 | 1.96 |
| Coralite Token Replace (attribute) | 16149660 | 61.9 | 2.62 |
| Coralite Read-Only Proxy (Deep Read) | 3132366 | 319.2 | 1 |
| Standard Flat Object Read (Deep Read) | 2220533766 | 0.5 | 708.9 |
| Eager Recursive Proxy (Deep Read) | 5490467 | 182.1 | 1.75 |
| Optimized Object.setPrototypeOf AST Element Creation | 939340 | 1064.6 | 1 |
| Legacy Object.defineProperties AST Element Creation | 883852 | 1131.4 | 0.94 |


## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

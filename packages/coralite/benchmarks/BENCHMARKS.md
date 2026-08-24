# Coralite Performance Benchmarks

Last updated: 2026-08-24T20:12:06.126Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 15.7 | 15.8 | 16 | 15.9 | 16.3 | 1.33 |
| react | 56.4 | 58.7 | 22.5 | 55.8 | 12.1 | 3.58 |
| vue | 59.6 | 66.7 | 30.5 | 17.5 | 9.4 | 3.11 |
| vanilla | 56.4 | 44.3 | 27.8 | 18.4 | 10 | 1.37 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 34.1 | 9.5 | 1.8 | 61.15 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1 | 93.6 |
| vue | 76.7 | 30.7 | 4 | 76.89 |


### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 123.6 | 809.1 | 1.24 | 3.7 |
| 1000_pages | 1000 | 885.6 | 1129.2 | 0.89 | 19.7 |
| 10000_pages | 10000 | 7763 | 1288.2 | 0.78 | 187.2 |


### internal

| Benchmark | Ops/Sec | Avg Latency (ns) | Speedup |
| --- | --- | --- | --- |
| Coralite Token Replace (textNode) | 6189360 | 161.6 | 1 |
| Native String.prototype.replace (regex) | 11810024 | 84.7 | 1.91 |
| Coralite Token Replace (attribute) | 16471921 | 60.7 | 2.66 |
| Coralite Read-Only Proxy (Deep Read) | 3135068 | 319 | 1 |
| Standard Flat Object Read (Deep Read) | 2224312643 | 0.4 | 709.49 |
| Eager Recursive Proxy (Deep Read) | 5646068 | 177.1 | 1.8 |
| Optimized Object.setPrototypeOf AST Element Creation | 1023712 | 976.8 | 1 |
| Legacy Object.defineProperties AST Element Creation | 968263 | 1032.8 | 0.95 |


### stress-lifecycle

| Framework | coralite-selective | coralite-dynamic | react | vue | svelte |
| --- | --- | --- | --- | --- | --- |
| islandScaling | [object Object] | [object Object] | [object Object] | [object Object] | [object Object] |
| streaming |  |  |  |  |  |
| lifecycle |  |  |  |  |  |


## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

# Coralite Performance Benchmarks

Last updated: 2026-08-28T21:04:16.635Z

**Environment:** Node v22.22.1 (linux x64)

### ssrThroughput

| Workload | Total Pages | Duration (ms) | Throughput (pages/sec) | Avg Latency (ms) | Peak Heap (MB) |
| --- | --- | --- | --- | --- | --- |
| 100_pages | 100 | 390 | 256.4 | 3.9 | 7 |
| 1000_pages | 1000 | 3468.4 | 288.3 | 3.47 | 77.4 |
| 10000_pages | 10000 | 27775.8 | 360 | 2.78 | 276.7 |


## Reproduction Instructions

To reproduce these benchmarks on your machine:

```bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
```

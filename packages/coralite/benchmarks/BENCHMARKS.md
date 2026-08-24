# Coralite Performance Benchmarks

Last updated: 2026-08-24T14:48:29.583Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 15.8 | 16.3 | 15.6 | 15.9 | 15.5 | 9.54 |
| react | 53.3 | 74.7 | 26 | 63.9 | 9.4 | 9.54 |
| vue | 56 | 70.1 | 26.2 | 19.7 | 9.6 | 9.54 |
| vanilla | 58.6 | 49.2 | 23.4 | 15.5 | 11.3 | 9.54 |


### bundle-hydration

| Framework | Raw JS (KB) | Gzip JS (KB) | Hydration (ms) | TTI (ms) |
| --- | --- | --- | --- | --- |
| coraliteDynamic | 34.1 | 9.5 | 1.9 | 75.65 |
| coraliteStatic | 0 | 0 | 0 | 0 |
| react | 190.3 | 59.4 | 1 | 92.4 |
| vue | 76.7 | 30.7 | 3.8 | 72.73 |


### internal

| Framework | initialMemoryMB |
| --- | --- |
| coralite | 67.52 |



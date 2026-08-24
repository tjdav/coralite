# Coralite Performance Benchmarks

Last updated: 2026-08-24T14:18:25.155Z

**Environment:** Node v24.16.0 (linux x64)

### dom-reactivity

| Framework | create1k | replace1k | update10th | swapRows | clear | heapMB |
| --- | --- | --- | --- | --- | --- | --- |
| coralite | 15.6 | 15.7 | 15.9 | 15.6 | 16.1 | 9.54 |
| react | 53 | 59.6 | 24.3 | 48.8 | 11.6 | 9.54 |
| vue | 62 | 65 | 26.9 | 10.3 | 8.8 | 9.54 |
| vanilla | 62.5 | 53 | 30.5 | 21.4 | 9.1 | 9.54 |


### internal

| Framework | initialMemoryMB |
| --- | --- |
| coralite | 70.39 |



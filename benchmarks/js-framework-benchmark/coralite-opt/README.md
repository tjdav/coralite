# js-framework-benchmark — Coralite (Optimized)

This is the optimized implementation for the `js-framework-benchmark`. It deviates from standard Coralite authoring patterns by using direct DOM manipulation for the "Update" and "Swap" operations, and by bypassing the reactive store for those specific hot paths. The canonical implementation (`coralite/`) should be used as the baseline for idiomatic performance.

## Specific Optimizations
1. `reconcile: 'minimal'` configuration enabled in `coralite.config.js`.
2. `compilerOptimizations: 'all'` configuration enabled in `coralite.config.js`.
3. Bypassed `store.update()` in favor of direct DOM element query and text update for "Update every 10th row".
4. Bypassed `store.swap()` / `store.set()` in favor of direct DOM node swapping for "Swap rows".

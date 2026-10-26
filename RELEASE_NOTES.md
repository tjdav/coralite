# Coralite Release Notes

## 1.0.0-rc.7

**⚠️ Supersedes 1.0.0-rc.6 — required upgrade.**

`coralite@1.0.0-rc.6` shipped without `plugins/router/outlet.html` in the npm tarball, causing every fresh `npx create-coralite@latest` project to fail on `npm run dev` with:

```
Error: ENOENT: no such file or directory, open '.../node_modules/coralite/dist/lib/router/outlet.html'
```

rc.7 fixes this by inlining the router-outlet component — no filesystem dependency, no possibility of the file being missing from the tarball. It also:

- Enhances the smoke test to exercise the packed artifact end-to-end (`npm pack` → `npm install` → `createCoralite()`), preventing this class of bug
- Fixes the scaffold's "Done" message (`npm run dev` instead of `npm run start`)
- Adds positional-argument support to `create-coralite` (`npx create-coralite@latest my-project`)

**Upgrade if you installed 1.0.0-rc.6:** run `npm install coralite@1.0.0-rc.7` in your project. No source changes required.

**Deprecation:** `coralite@1.0.0-rc.6` and `create-coralite@1.0.0-rc.6` are deprecated on npm with a message pointing to rc.7.

## 1.0.0-rc.6

This release candidate marks a massive architectural shift for Coralite, moving from a Proxy-based reactivity model to a signal-based model, and consolidating the developer experience into a single `coralite` package.

## Highlights

- **Signal-Based Reactivity:** Replaced Proxy-based state with signals. Component state is now faster, and async getters are supported.
- **Core Plugins Auto-Registered:** The `router` and `lists` plugins are now built into the framework and automatically available via context.
- **Unified CLI:** `coralite-scripts` is deprecated. `coralite` now owns `dev`, `build`, `test`, `check`, and `fix`. Experimental Node flags are encapsulated internally.
- **Global Store:** Added a reactive `store` config key for application-wide state.
- **Lists Plugin:** Built-in support for virtualized lists, masonry grids, and chat timelines with infinite scroll.
- **SPA Router:** An opt-in router for persistent client state across navigation, featuring View Transitions and route guards.
- **Type Checking:** `coralite check --types` now runs the Volar-bridged TypeScript checker on inline scripts.

## Benchmarks

Local `js-framework-benchmark` results comparing `coralite@1.0.0-rc.6` against `react@19.2.0` on the same machine show Coralite dominating across the board.

### Performance

| Metric / Operation | Coralite (v1.0.0-rc.6) | React (v19.2.0) | Notes |
| :--- | :--- | :--- | :--- |
| Create 1k rows | 35.7 ms | 132.8 ms | Coralite ~3.7x faster |
| Replace all rows | 32.8 ms | 123.6 ms | Coralite ~3.8x faster |
| Partial update (every 10th) | 88.2 ms | 106.8 ms | Coralite ~1.2x faster |
| Select row | 13.5 ms | 19.8 ms | Coralite ~1.5x faster |
| **Swap rows** | **17.8 ms** | **415.8 ms** | **Coralite ~23.3x faster** |
| Remove row | 16.1 ms | 26.4 ms | Coralite ~1.6x faster |
| Create 10k rows | 328.7 ms | 1,254.2 ms | Coralite ~3.8x faster |
| Append 1k rows | 39.5 ms | 139.1 ms | Coralite ~3.5x faster |
| Clear rows | 57.3 ms | 123.1 ms | Coralite ~2.1x faster |

### Memory & Bundle Size

| Benchmark | Coralite | React |
| :--- | :--- | :--- |
| Ready Memory | **0.83 MB** | 1.18 MB |
| Run Memory (after 1k rows) | **2.24 MB** | 4.45 MB |
| Run/Clear Memory (5 cycles) | **1.02 MB** | 1.94 MB |
| Uncompressed Bundle Size | **129.1 KB** | 190.3 KB |
| Compressed Bundle Size | **32.4 KB** | 51.4 KB |

## Migration (from rc.5)

If you are upgrading from `rc.5`:
1. Replace `coralite-scripts` with `coralite` in your `package.json` scripts.
2. Remove `cross-env` and `NODE_OPTIONS` from your scripts.
3. Update `urlStyle` to `cleanUrls` in your config.
4. If you wrote custom plugins, update the `server.config`/`client.config` to the unified `config` block.

See the documentation for details.

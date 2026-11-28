# Build workers (`build.workers`) — design spike

Status: **blocked as proposed**. This document records why a `p-limit`-to-worker-pool swap is not a viable change for Coralite 1.5.0, and what would be required instead. It is the resolution artifact for Issue 2 of the build-performance report.

## The proposal

Add `build.workers` to `defineConfig`, thread it through `lib/cli/commands/build.js`, `lib/server/create.js` and `CoraliteBuildOptions`, and replace the single-process limiter at `packages/coralite/lib/server/renderer.js:4183-4190` with a `worker_threads` pool. Acceptance: on a 24-core machine a cold build of thousands of pages is faster than `build.concurrency: 24`, with identical output bytes.

Facts that still hold:

- `renderer.js:4183-4188` resolves `maxConcurrent` from `buildOptions.maxConcurrent` (which `onBeforeBuild` can override via `renderer.js:3571`) or `normalizedOptions.concurrency`, default `min(availableParallelism(), 8)`.
- `renderer.js:4190` creates one `pLimit(maxConcurrent)`; every task calls `_renderSinglePage` inside it at `:4202-4221`.
- No `worker_threads`, `Worker` or `MessageChannel` exists in the build path. The only child process is the CLI VM-flag reexec (`packages/coralite/bin/coralite.js:31-61`), which only fixes flags in the parent.

## Finding 1 — a page render is not a pure function

`_renderSinglePage` depends on values that cannot be structured-cloned:

- the `evaluate` closure injected from `create.js:467-475`, whose production path compiles page and component source with esbuild and executes it via `new Function` (`lib/server/compiler.js:644-660`, `:764-778`);
- the plugin-binding Proxy from `lib/server/hooks.js:124-192`, whose Phase-2 resolvers are functions created fresh per evaluation and close over `app`, config proxies and server contexts (`lib/server/plugin-setup.js:257-268`);
- `app` itself (`CoraliteCollection` instances, `trackOutputFile`, dependency graph) and reactive stores (`lib/utils/store.js:10-40`, `:155-164`);
- symbol-keyed `provide` entries and context-frame maps (`renderer.js:2445-2461`).

Functions can be regenerated from source, but only after rebuilding the injected `app`/`source`/`hooks`/`session`/`scriptManager` context — that is a worker-side reimplementation of `createRenderer`, not a serialization step.

## Finding 2 — shared mutable state

Render tasks mutate state shared across pages: `outputFiles` (`:2950-2954`, `:3111-3115`), `sriDigestCache` (`:2806-2821`), `inFlightCss` (`:292-299`), `scriptManager.sharedFunctions` (`lib/server/script-manager.js:646-660`, `:752-769`), `pageItem.content` (`:1575`, `:3280`), module-scope AST caches (`lib/server/utils/server.js:23-24`) and stylesheet caches (`lib/server/utils/dependency-stylesheets.js:76`). Worker-local copies would need explicit reconciliation; otherwise output bytes and incremental metadata diverge.

## Finding 3 — hooks are parent-affine

- `onBeforeBuild` (`:3551-3571`) mutates `app.options`, late-binds plugin client config (`:3573-3585`) and adds virtual pages to the render queue before it is sealed (`:3613`). Its return value replaces build options.
- `onPageSet` and `onBeforePageRender` run *inside* `_renderSinglePage` (`:1596-1626`, `:1688-1704`) and merge their results back into `component`, `session`, `state` and `page`, so they directly affect output.
- Component hooks run per instance inside the page task (`:843-856`, `:1365-1379`; fragment path `lib/server/utils/fragment.js:524-537`).
- `onAfterPageRender` (`:4301-4305`) receives mutable `result` and `session` by reference. `buildCallback` (`:4340-4347`) can replace `results[q]`. `onAfterBuild` (`:4435-4446`) needs `app` and the complete results array.
- Hook wrappers use `Object.create(ctx)` and sequential merge semantics (`lib/server/hooks.js:41-113`, `plugin-setup.js:340-348`), so running them in a worker changes observable ordering and state.

Every one of these must stay in the process that calls `build()`.

## Finding 4 — what is actually cloneable

Plain data: normalized config (`server.config`, `_valuesByBlock`, `_normalizedSchemas`, testing mocks), page/component source strings and parsed ASTs, route tables, manifest data, `variables`. AbortSignal is not cloneable. The rest of the render context is function-based.

## Finding 5 — why a runtime-only split fails

Selecting a prebuilt chunk inside `initPlugins` (as was considered for Issue 4) does not move CPU work off the event loop. The synchronous cost is `parseHTML`, `replaceTokensInAST`, component evaluation, PostCSS transforms, serialization and hashing — all inside `_renderSinglePage`. Unless that code runs in another process, `p-limit` only interleaves I/O.

## Options considered

1. **Worker pool around `_renderSinglePage`** — rejected. Requires re-creating the framework context in every worker, marshalling every per-page hook back to the parent, replaying `trackOutputFile`/`registerComponent` side effects, and merging results deterministically. Effectively a rewrite of the renderer with a high risk of byte drift.
2. **Pure leaf work in workers** — `formatComponentCss` (`lib/server/utils/style.js:509-562`), `transformNode` (`lib/server/parser/html.js:21-27`), `generateClientRuntime` and hashing are pure and cloneable, but they are already cached or too small to matter. No meaningful wall-clock reduction.
3. **Process sharding via `dynamicPaths`** — viable but bounded: use `buildOptions.dynamicPaths` (filter at `renderer.js:3839-3881`) to split enumerated outputs across separate full builds in child processes, with aggregate hooks run only in the parent and a deterministic parent-side merge of `dist/` and manifest entries. Each child calls `createCoralite()` afresh, so no live context crosses the process boundary. Static pages are built unconditionally by every child, so this only helps dynamic-route-heavy sites. Risks: plugins that aggregate across pages in `onAfterBuild` see partial results, plugin contexts with external handles must be recreated per worker, and merge order must be fixed to keep output bytes identical. This is a separate project, not a config flag.

## Recommendation

Do not implement `build.workers` as a config flag. The performance work already in place mainly helps *incremental* builds:

- `perf(renderer): skip SSR work for unchanged cached pages` — pages that declare `shouldSkipRender` avoid `server()` on warm builds.
- `perf(manifest): add sharded incremental manifest storage` — the compact single-file default is the measured win; sharded writes are opt-in and slower in current benchmarks.
- `perf(plugin): partition locale config into hashed chunks` — edits to `client.config.locales` rebuild only the matching locale.

None of these improve *cold* builds. Before revisiting process-level parallelism, re-measure the cold-build bottleneck. The result files under `benchmarks/results/` now record a suite fingerprint and dirty-tree state, and each pair was captured from a clean checkout (`fb0d5c39` before, `c660bd67` after) with identical harness code. Treat them as the baseline for that decision.

If a prototype is attempted, start with an internal `shard: { index, total, paths }` build option, enumerate dynamic params once in the orchestrator, spawn children with disjoint `dynamicPaths`, use a per-shard `cacheDir`, and merge outputs, manifest entries and results deterministically in the parent. Validate with full-dist byte equality, not just in-memory `content`.

Any attempt must be gated by:

- `tests/unit/lib/concurrent-build.spec.js:60-91` — byte-identical output at different concurrency levels (extend to dynamic pages and full dist trees);
- `tests/unit/lib/concurrent-build.spec.js:93-160` and `:209-298` — hook order, state isolation and session lifetime;
- `tests/unit/lib/coralite.spec.js:75-108`, `:276-347` — `onBeforeBuild` option handling and `onAfterBuild` results.

## Conclusion

The *worker-pool-around-`_renderSinglePage`* design is blocked by architecture. Issue 2 itself should be reopened as a bounded process-sharding prototype. No framework code was changed for it.

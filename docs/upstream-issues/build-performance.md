# Upstream issue drafts — build performance

These are drafts for separate issues on `https://github.com/tjdav/coralite/issues`. They replace the original draft set. Do not file until the numbers below are re-checked against the target upstream branch; the euroloom-specific figures in the original report were **not** refreshed, so none of them are quoted here.

All measurements come from clean checkouts with identical harness code and committed provenance:

- before: `fb0d5c39`, after: `c660bd67`, suite fingerprint `78f8a7744afa`, `dirty: false`, 5 samples per metric;
- identical-fixture cold comparison: before `c0afa2de`, after `b8e154d9`;
- result files: `benchmarks/results/bench-01-*.json`, `bench-01b-cold-legacy-*.json`, `bench-03-*.json`, `bench-04-*.json`.

Suggested labels: `performance`, `build`, `needs-design` where noted.

---

## Issue 1 — Skip SSR work for unchanged pages before running `server()`

**Problem.** Incremental builds still resolve the post-server cache key inside `_renderSinglePage`, so every cache-eligible page calls `server()` on a warm build even when every output is ultimately skipped. On a data-driven site with tens of thousands of dynamic outputs this is the dominant warm-build cost.

**Proposal.** Add two optional page exports with distinct responsibilities:

```js
export function contentKey({ route, state }) { ... }        // identity of rendered output, after server()
export function shouldSkipRender({ route, page, previousContentKey }) { ... } // boolean, before server()
```

`shouldSkipRender` runs in the invalidation pre-pass, before `server()`, HTML parsing, plugin binding, getters and component rendering. `true` reuses the cached output; `false` falls through to the normal path. `previousContentKey` is the key recorded by the last successful build. `cacheKey({ route, state })` remains a supported deprecated alias for `contentKey`.

**Acceptance criteria.**
- A warm build of N unchanged pages that declare `shouldSkipRender` makes zero `server()` calls for those pages.
- Pages using only `cacheKey({ route, state })` continue to build and invalidate exactly as before. They still call `server()` on warm builds — this issue does not change that without a hook.
- Manifest metadata (`runtimeChunk`, `pageScript`, assets, cache key) is carried forward on skipped pages exactly as it is for existing skips.
- No change to plugin hook behaviour: skipped pages continue to bypass `onAfterPageRender`, as they do today. If we want hooks to fire for skipped pages, that is a separate API decision.

**Evidence.** 2,000 dynamic pages, 5 samples: warm 425.2 ms (spread 63.7) → 109.8 ms (spread 13.2); `server()` calls 2,000 → 0. One-record change rebuilds 1 page. Cold build with an identical fixture: 494.4 ms (spread 144.6) before vs 511.5 ms (spread 154.0) after — no demonstrated regression.

**Caveat to document.** `shouldSkipRender` cannot see server state. Authors must hash every output-affecting input in both hooks; a stale `true` serves old HTML.

---

## Issue 2 — Cold-build parallelism: process sharding, not a `build.workers` pool

**Problem.** `p-limit` only interleaves async I/O; SSR, HTML parsing and AST work are synchronous on one event loop. A cold build of thousands of pages does not get faster with higher `build.concurrency`.

**Why not a worker pool around page rendering.** `_renderSinglePage` depends on non-cloneable framework context (compiled functions from `evaluateProduction`, plugin-binding proxies, `app`, stores, symbol-keyed contexts), mutates shared registries (`outputFiles`, AST/CSS caches, `scriptManager.sharedFunctions`, `pageItem.content`), and invokes parent-affine hooks (`onBeforeBuild`, `onBeforePageRender`, `onAfterPageRender`, `buildCallback`, `onAfterBuild`). Moving it into workers requires reimplementing `createRenderer` plus hook marshalling in each worker. Full analysis: `docs/build-workers-design-spike.md` in the repository.

**Proposal (needs design spike).** Do not add a public `build.workers` flag yet. Prototype an internal shard option using the existing `dynamicPaths` filter (`renderer.js:3839-3881`): enumerate dynamic params once in the orchestrator, spawn N child processes that each call `createCoralite()` and build a disjoint shard with a per-shard `cacheDir`, then merge `dist` files, manifest entries and results deterministically in the parent. Aggregate hooks run only in the parent.

**Acceptance criteria.**
- Cold build of thousands of dynamic pages is faster than `build.concurrency: 24` on a 24-core machine.
- Output bytes are identical to a serial build: full `dist` tree and manifest, not just in-memory page content.
- Hook counts and ordering are unchanged; plugins that aggregate across pages are documented as requiring parent-side handling.
- Static pages are built once in the parent; children only shard dynamic outputs.

**Status:** not implemented. Reopen if cold builds remain a bottleneck after Issue 1 is adopted.

---

## Issue 3 — Compact manifest by default; sharding is not justified

**Problem.** The original report described an 85 MB pretty-printed `manifest.json` parsed and rewritten on every build. That size is largely formatting.

**Proposal.** Write the manifest compactly. Keep the manifest behind a store abstraction so a sharded implementation can be tested, but do not propose sharding as the fix: in a 45,000-entry synthetic benchmark, sharded storage was slower to load than both compact and legacy single-file, saved no bytes versus compact, and added correctness surface (e.g. stale shards when shard counts change).

**Acceptance criteria.**
- The manifest no longer uses pretty-printed JSON; its size and write time drop materially.
- Incremental correctness is unchanged: cache keys, dependency graph, skipped-page carry-forward and version handling behave identically.
- Any alternate store is opt-in and has tests for migration, partial data and shard-count changes.

**Evidence.** 45,000 entries, 5 samples: legacy 117.8 ms load / 153.6 ms save / 30,264,242 bytes; compact 104.5 / 104.5 / 20,762,140; sharded 127.9 / 105.7 / 20,762,738. The compact default is the win.

---

## Issue 4 — Locale-partitioned client config chunks (narrow scope)

**Problem.** Plugin config is baked into one hashed `coralite-runtime` chunk. Any edit to it changes that hash and rebuilds every page with a non-null `runtimeChunk`, regardless of its cache key.

**Proposal (implemented, narrow).** Add opt-in `i18n: { locales, defaultLocale }`. Extract a `locales` field from a plugin's `client.config` into small hashed per-locale chunks, select the chunk from `route.params.lang` / `locale` (falling back to `defaultLocale`), and merge its values into the `config` passed to that plugin's browser `init()`. Track the chunk per page so only pages of the edited locale rebuild.

**Acceptance criteria.**
- Editing one locale's `client.config` override rebuilds only pages of that locale.
- The shared runtime chunk filename is unchanged after a single-locale edit.
- Sites that do not enable `i18n` produce byte-identical output.

**Evidence.** 2-page two-locale benchmark, 5 samples: rendered pages on edit 2 → 1, skipped 0 → 1, runtime chunk stable, other locale's chunk stable.

**Known gap — file separately.** This does **not** partition dictionaries authored in a plugin's top-level `context` closure or in page state; those still invalidate every locale. The canonical i18n guide recommends `messages.json` imported in `server()` and exposed through state, which is already per-page and unaffected.

---

## Issue 5 (new) — Locale-scoped invalidation for context/state dictionaries

**Problem.** The documented `$t` plugin pattern puts the dictionary directly in a plugin's top-level `context` function. That function is serialized into the shared runtime chunk, so a single translation edit invalidates every locale. Issue 4 does not address this pattern.

**Proposal.** Define a locale-aware context API whose source is split per locale at build time, or make locale dictionaries a first-class build input with per-locale hashed chunks. Must preserve getter isomorphism: dictionaries needed by getters must come from ubiquitous context or state, never `server.context`.

**Acceptance criteria.** Editing one locale's dictionary rebuilds only that locale's pages for both `context`-based and state-based authoring patterns, with byte-identical output for other locales.

---

## Documentation request

`llms-full.txt` §20 covers browser runtime performance only. Document, with links to the reference pages:

- `contentKey()` / `shouldSkipRender()` semantics and the correctness contract;
- `build.concurrency` and the absence of a `build.workers` flag, with a link to the spike;
- incremental invalidation rules: source hash, content key, runtime chunk, locale chunk, component hashes;
- how to benchmark a build (`bench:internal --suite=build-performance|manifest-store|locale-chunks`, provenance fields, `--iterations`, task-id/phase conventions).

Also document that `build.manifestShards` is experimental and currently slower than the compact single-file default.

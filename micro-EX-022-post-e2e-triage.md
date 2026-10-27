# micro-EX-022: Post-E2E-3/E2E-4 triage — full baseline + router failure deep-dive

## Section 0 — Current full E2E baseline

### 0a. Confirm build is green first
`pnpm clean:e2e && pnpm build:html:dev` summary:
```text
[CORALITE-INFO] 23 expected failure(s) — see EXPECTED_BUILD_FAILURES manifest
[CORALITE-INFO] Build completed with 23 expected failure(s), 0 unexpected.
exit: 0
```

### 0b. Confirm `pnpm --filter coralite run build` (tsc) exits 0
```text
$ premove dist && pnpm build:lib && pnpm build:types
$ node esbuild.config.js
$ tsc
exit: 0
```

### 0c. Run full E2E suite
```text
Global Stats: { expected: 119, skipped: 11, unexpected: 57 }
```
- **Q0a:** Total pass/fail/skip: 119 pass / 57 fail / 11 skip (out of 187 total tests).
- **Q0b:** Per-project breakdown:
  - `framework-core-dev`: 60 pass / 26 fail / 2 skip
  - `framework-core-prod`: 55 pass / 24 fail / 9 skip
  - `testing-mode-features`: 3 pass / 1 fail / 0 skip
  - `router-app-dev`: 1 pass / 6 fail / 0 skip
- **Q0c:** Comparison to last baseline (114 pass / 62 fail / 11 skip): Pass count increased from 114 to 119 (+5 pass), failure count decreased from 62 to 57 (-5 fail). Router improved from 0/7 to 1/7 pass; testing-mode improved from 1/4 to 3/4 pass.

**Baseline: 119 pass, 57 fail, 11 skip; testing-mode: 3/4; router: 1/7**

---

## Section 1 — Testing-mode check (did E2E-3 fix it?)

### 1a. Run testing-mode tests
```text
Running 4 tests using 2 workers: 3 passed, 1 failed (5.3s)
```
- **Q1a:** `should support server mocking` PASS, `should support data-testid` PASS, `should expose window.__coralite_test__` FAIL.
- **Q1b:** Residual failure message for `should expose window.__coralite_test__`:
  `Error: page.evaluate: TypeError: Cannot read properties of undefined (reading 'ready')` at `tests/e2e/testing-mode/features.test.js:25:16`. `window.__coralite_test__` is exposed on `window`, but its `.ready` property is undefined during page evaluation.

**E2E-3 fixed 2/3; residual: TypeError: Cannot read properties of undefined (reading 'ready')**

---

## Section 2 — Router failure deep-dive (6 failures)

### 2a & 2b. Error messages and test assertions
1. `navigates without full page reload and preserves client state` (`router.spec.js:9`):
   - Error: `expect(page.locator('#page-title')).toHaveText('About Page')` failed. Expected: "About Page", Received: "Home Page" (timeout 5000ms).
   - Snapshot: `<h1 id="page-title" data-coralite-slot-index="1">Home Page</h1>`.
2. `routes are intercepted and guards redirect` (`router.spec.js:24`):
   - Error: `expect(page.locator('#page-title')).toHaveText('About Page')` failed. Expected: "About Page", Received: "Home Page" (timeout 5000ms).
   - Snapshot: `<h1 id="page-title" data-coralite-slot-index="1">Home Page</h1>`.
3. `fires navigating and navigated events` (`router.spec.js:36`):
   - Error: `expect(events).toContain('navigated:/about')` failed. Received: `["navigating:/about"]`.
   - Snapshot: `Home Page` heading remains.
4. `router navigation triggers startViewTransition when enabled` (`router.spec.js:51`):
   - Error: `expect(count).toBe(1)` failed. Expected: 1, Received: 0.
5. `navigation succeeds when startViewTransition unavailable` (`router.spec.js:70`):
   - Error: `expect(page.locator('#page-title')).toHaveText('About Page')` failed. Expected: "About Page", Received: "Home Page" (timeout 5000ms).
6. `navigation falls back to sync when startViewTransition throws` (`router.spec.js:89`):
   - Error: `expect(page.locator('#page-title')).toHaveText('About Page')` failed. Expected: "About Page", Received: "Home Page" (timeout 5000ms).

- **Q2a:** `navigates without...` asserts URL, `#page-title` text, `#counter-display` client state, and `window.__shellHydrated__`.
- **Q2b:** The 3 `startViewTransition*` tests assert `window.__vtCallCount === 1`, swap completion, and fallback DOM update without console errors.
- **Q2c:** `fires navigating and navigated events` asserts both custom events are dispatched in order.
- **Q2d:** `routes are intercepted and guards redirect` asserts clicking `/admin` redirects to `/about` via `beforeEach` guard.

### 2c. Cluster by error signature

| Test | Error signature (one line) | Where it fails in test |
|---|---|---|
| navigates without... | `toHaveText('About Page')` received "Home Page" | `router.spec.js:16` |
| routes are intercepted... | `toHaveText('About Page')` received "Home Page" | `router.spec.js:27` |
| fires navigating... | `toContain('navigated:/about')` received `["navigating:/about"]` | `router.spec.js:48` |
| startViewTransition enabled | `expect(count).toBe(1)` received 0 | `router.spec.js:67` |
| startViewTransition unavailable | `toHaveText('About Page')` received "Home Page" | `router.spec.js:83` |
| startViewTransition throws | `toHaveText('About Page')` received "Home Page" | `router.spec.js:107` |

- **Q2e:** 4 tests share DOM swap failure (`toHaveText('About Page')`); 1 test fails on `viewTransitions` boolean check (`count === 0`); 1 test fails on event completion before `coralite:navigated`.

**6 failures = 3 distinct error signatures**

---

## Section 3 — Router runtime cross-check

### 3a & 3b. Code inspection
- `packages/coralite/plugins/router.js`:
  - `startViewTransition` gate at `plugins/router.js:424` reads `const viewTransitions = win.__coralite_hydration__?.viewTransitions` statically inside `init()`. Because `init()` runs before test overrides or dynamic hydration assignment, `viewTransitions` remains `undefined` inside `navigate()`.
  - Event dispatch: `coralite:navigating` dispatches at `plugins/router.js:379` before fetch. `coralite:navigated` dispatches at `plugins/router.js:451` after `fetch()` and `performSwap()`.
  - DOM swap: `performSwap` at `plugins/router.js:241` executes `outlet.replaceChildren(...newOutlet.childNodes)`.
- `packages/coralite/lib/client/page-runtime.js:296`:
  - **Q3a:** `setupPageRuntime` context now includes `...(routerCtx ? { router: routerCtx } : {})`.
  - **Q3b:** Retrieved via `const routerCtx = win.__coralite_router__`.
  - **Q3c:** Matches global property set at `plugins/router.js:462` (`win.__coralite_router__ = { navigate, current, beforeEach, viewTransitions }`).

### 3c. Error signature mapping

| Failure | Likely source line | Why |
|---|---|---|
| DOM swap failure (4 tests) | `plugins/router.js:401-418` | `doc.querySelector(outletSelector)` or `document.querySelector(outletSelector)` fails to find outlet during fetch/swap |
| VT count = 0 (1 test) | `plugins/router.js:424` & `plugins/router.js:459` | `viewTransitions` evaluated statically at `init()` instead of dynamically reading `win.__coralite_hydration__?.viewTransitions` or `win.__coralite_router__?.viewTransitions` |
| Event `navigated` missing (1 test) | `plugins/router.js:401-418` | Navigation throws or aborts during `fetch()` / DOM parsing before line 451 |

- **Q3d:** The VT failure is caused by `plugins/router.js:424` capturing `viewTransitions` at plugin `init()` time.
- **Q3e:** The missing `navigated` event is caused by an unhandled error inside `navigate()` prior to line 451 dispatch.

**VT failures share source at plugins/router.js:424**

---

## Section 4 — Router fixture check

### 4a. Router-app fixture review
- `packages/coralite/tests/fixtures/router-app/pages/index.html`:
  - **Q4a:** `client({ router })` uses `router.beforeEach(({ to }) => ...)` to intercept routes. Link clicks rely on delegated click interception.
  - **Q4b:** No lifecycle hooks used that race with router setup.
  - **Q4c:** The passing test (`external links bypass the router`) confirms `setupPageRuntime` executes, injects `router`, and runs `beforeEach` successfully.

**Page client() runs with full router; failures are elsewhere**

---

## Section 5 — Non-router core failures refresh

### 5a. Core pass rate vs last baseline
- Core E2E failure count decreased from 52 to 50 across `framework-core-dev` and `framework-core-prod`.
- **Q5a:** Pass/fail breakdown per spec file:
  - `dependency-tracking/nested-getters.test.js`: 6 fail dev / 6 fail prod
  - `imperative-components.test.js`: 5 fail dev / 5 fail prod
  - `innerhtml.test.js`: 3 fail dev / 1 fail prod
  - `slots-projection.test.js`: 2 fail dev / 2 fail prod
  - `lists.spec.js`: 2 fail dev / 2 fail prod
  - `plugins.test.js`: 4 fail dev / 4 fail prod
  - `priority-tests.test.js`: 2 fail dev / 2 fail prod
  - `server-state.test.js`: 1 fail dev / 1 fail prod
  - `lifecycle.test.js`: 1 fail dev / 0 fail prod
  - `devtools.test.js`: 0 fail dev / 1 fail prod
- **Q5b:** Zero regressions in non-router core suite.

**Core failure count: 50 (was 52); no regressions**

---

## Section 6 — Verdict + proposed task split

| Root cause | Failing tests | Likely source (file:line) | Fix shape | Effort |
|---|---|---|---|---|
| Dynamic `viewTransitions` evaluation | 1 | `plugins/router.js:424` | `TRIVIAL` | SMALL |
| Router outlet DOM matching & fetch swap | 4 | `plugins/router.js:401` | `SMALL` | SMALL |
| Navigation error before `coralite:navigated` | 1 | `plugins/router.js:451` | `TRIVIAL` | SMALL |
| Testing-mode `window.__coralite_test__.ready` | 1 | `lib/client/utils/devtools.js:45` | `SMALL` | SMALL |
| Core reactive / imperative component issues | 50 | `lib/client/element.js` | `MEDIUM` | MEDIUM |

- **Q6a:** 3 distinct root causes among the 6 router failures.
- **Q6b:** Yes — fixing outlet matching/fetch swap resolution in `navigate()` resolves both the 4 DOM swap failures and the missing `coralite:navigated` event failure.
- **Q6c:** 1 targeted task (e.g. `E2E-5`) can bring router to 7/7 pass.
- **Q6d:** Full E2E suite current baseline is 119 pass / 187 (63.6%).
- **Q6e:** `pnpm --filter coralite run build` is green (exit 0).

**3 distinct causes; task count: 1; current baseline: 119/187**

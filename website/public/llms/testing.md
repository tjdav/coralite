# Coralite Automated Testing & E2E Reference

> End-to-end testing guidelines, Playwright locator patterns, and deterministic assertions.

## 1. Playwright Locator Chaining

Target the host element first, then chain into internal template elements:

```javascript
import { test, expect } from '@playwright/test'

test('counter increments when clicked', async ({ page }) => {
  await page.goto('/')

  // Target host custom element
  const counter = page.locator('my-counter').first()

  // Scope actions and assertions to the component instance
  await counter.getByRole('button', { name: '+1' }).click()

  // Wait on reactive settlement
  await expect(counter.locator('.count')).toHaveText('1')
})
```

## 2. Deterministic Reactive Settlement

Coralite components expose a live `updateComplete` promise on their DOM instance. When running tests directly in browser contexts:

```javascript
await element.updateComplete
```

`updateComplete` resolves when the microtask update cycle finishes flushing reactive DOM changes.

In `mode: 'testing'`, Coralite also exposes `window.__coralite__.test` and `window.__coralite__.lifecycle`:
- `await window.__coralite__.test.ready` (or `await window.__coralite__.lifecycle.hydrated`): Awaits full initial hydration readiness.
- `await window.__coralite__.test.flush()`: Awaits pending `updateComplete` cycles across all hydrated component instances.
- `await window.__coralite__.test.reset()`: Clears `localStorage`, `sessionStorage`, IndexedDB, and service workers.
- `window.__coralite__.test.getComponent(element)`: Inspects a component's testing harness (`{ instanceId, componentId, state, getters, refs }`).
- `window.__coralite__.test.getInstances(tagName?)`: Lists hydrated custom element instances.
- `window.__coralite__.test.getEvents()`: Returns dispatched component `CustomEvent` telemetry records.
- `window.__coralite__.test.getHydratedCount()`: Returns the count of hydrated component instances.

## 3. Test IDs Policy

1. **Static Test IDs**: Write static plain-text test IDs (e.g. `<button data-testid="submit-btn">`). Never attempt dynamic bindings (`data-testid="{{ dynamicId }}"`).
2. **Preservation**: Authored `data-testid` attributes are preserved verbatim in development, testing, and production E2E test builds.
3. **No Schema Pollution**: Never add test IDs to the `attributes` declaration (e.g. `testId: String`).

## 4. Test Fixtures Policy

1. **Isolation**: Author test fixture pages under `tests/fixtures/pages` and test fixture components (mock helpers, harnesses) under `tests/fixtures/components`. Configure `fixtures: 'tests/fixtures'` (or `{ pages, components, prefix }`) in `coralite.config.js`.
2. **No Source Directory Pollution**: Never place test fixtures or test files inside `src/pages/` or `src/components/` (e.g. `__test__`, `*.test.html`, `*.fixture.html`).
3. **Routing & Component Registration**: In `coralite dev` and `coralite test`, fixture pages are accessed via `/__fixtures__/<name>`, and fixture components are automatically registered into `app.components`.
4. **Build Guarantee**: Test fixtures and test files (`DEFAULT_TEST_EXCLUSIONS`: `__test__`, `__tests__`, `*.test.html`, `*.spec.html`, `*.fixture.html`) are never emitted to `dist/` or registered in production component bundles.

## 5. Plugin Context Mocking

### E2E builds (`testing.mocks.plugins`)

In `mode: 'testing'`, override resolved plugin context methods:

```javascript
testing: {
  mocks: {
    plugins: {
      analytics: {
        server: { context: { track: () => 'mocked' } },
        client: { context: { track: () => 'mocked-client' } }
      }
    }
  }
}
```

- Mocks are shallow-merged over the real Phase 2 context; unmocked methods remain real.
- The real Phase 1 and Phase 2 functions still run. Use a stub plugin in `plugins: [...]` when the real plugin performs external I/O or side effects during setup.
- Mock keys must match `plugin.name` (or `server.name` / `client.name`).
- Built-in mocks target `server.context` and `client.context`. Use a stub plugin for top-level isomorphic `context`.

### Unit tests (`options.context`)

```javascript
import { loadPage } from 'coralite/testing'

const page = await loadPage('src/pages/index.html', {
  context: {
    analytics: {
      track: event => `mocked:${event}`
    }
  }
})
```

`loadComponent` and `loadPage` inject context into `server()`/`client()` wrappers and bypass plugin setup entirely. For getters, style, slots, or top-level context, use a stub plugin with `createCoralite`.

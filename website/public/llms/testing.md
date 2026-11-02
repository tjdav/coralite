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

## 3. Test IDs Policy

1. **Static Test IDs**: Write static plain-text test IDs (e.g. `<button data-testid="submit-btn">`). Never attempt dynamic bindings (`data-testid="{{ dynamicId }}"`).
2. **Preservation**: Authored `data-testid` attributes are preserved verbatim in development, testing, and production E2E test builds.
3. **No Schema Pollution**: Never add test IDs to the `attributes` declaration (e.g. `testId: String`).

## 4. Test Fixtures Policy

1. **Isolation**: Author test fixture pages under `tests/fixtures/` and configure `fixtures: 'tests/fixtures'` in `coralite.config.js`.
2. **No Pages Pollution**: Never place test fixtures or test files inside `src/pages/` (e.g. `src/pages/__test__`).
3. **Routing**: In `coralite dev` and `coralite test`, fixtures are accessed via `/__fixtures__/<name>`.
4. **Build Guarantee**: Test fixtures and test files (`__test__`, `__tests__`, `*.test.html`, `*.spec.html`, `*.fixture.html`) are never emitted to `dist/`.

/**
 * Dedicated ports for Playwright e2e servers.
 *
 * Kept separate from the manual `server:*` scripts (3000–3003) so a developer's
 * running application cannot be silently reused as the e2e target.
 */
export const E2E_PORTS = {
  dev: 3100,
  prod: 3101,
  testing: 3102,
  router: 3103
}

export const E2E_BASE_URLS = {
  dev: `http://localhost:${E2E_PORTS.dev}`,
  prod: `http://localhost:${E2E_PORTS.prod}`,
  testing: `http://localhost:${E2E_PORTS.testing}`,
  router: `http://localhost:${E2E_PORTS.router}`
}

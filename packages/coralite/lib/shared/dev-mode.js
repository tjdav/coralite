/**
 * Resolves whether the Coralite client runtime should behave in development mode.
 *
 * Precedence:
 * 1. The live runtime mode (`window.__coralite__.mode`) injected by the SSR readiness
 *    script / generated client runtime (`production` | `development` | `testing`).
 *    This keeps production pages silent even when a bundle is served without
 *    `NODE_ENV=production`, and lets tests toggle dev diagnostics per instance.
 * 2. The build-time `process.env.NODE_ENV` signal used by bundlers and Node tooling.
 *
 * @returns {boolean} True when dev/test-only diagnostics should be emitted.
 */
export function isDevRuntime () {
  if (typeof window !== 'undefined') {
    /** @type {any} */
    const runtime = window['__coralite__']
    if (runtime && typeof runtime.mode === 'string' && runtime.mode) {
      return runtime.mode !== 'production'
    }
  }

  return process.env.NODE_ENV !== 'production'
}

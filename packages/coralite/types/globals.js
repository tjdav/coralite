/**
 * Route object provided by the router to page and component contexts.
 *
 * @typedef {Object} CoraliteRoute
 * @property {string} path
 * @property {string} pattern
 * @property {Record<string, string>} params
 * @property {boolean} dynamic
 */

/**
 * Hydration payload set by the SSR bootstrap script.
 * Shape matches what `generateClientRuntime` in `lib/client/utils/runtime.js` emits.
 *
 * @typedef {Object.<string, any>} CoraliteHydration
 * @property {CoraliteRoute} [__route__]
 * @property {boolean} [viewTransitions]
 * @property {Record<string, any>} [__store__]
 * @property {any} [__pageConfig__]
 */

/**
 * Runtime object attached to `window.__coralite__`.
 * Contains core framework helpers; extended with devtools APIs in dev/testing modes.
 *
 * @typedef {Object} CoraliteRuntime
 * @property {any} [reconcile]
 * @property {any} [hydrationStore]
 * @property {(tag: string) => Promise<any>} [loadComponent]
 * @property {(el: Element) => Promise<void>} [upgrade]
 * @property {any} [store]
 * @property {any} [lifecycle]
 */

/**
 * Router plugin API attached to `window.__coralite_router__`.
 *
 * @typedef {Object} CoraliteRouter
 * @property {(path: string, options?: { replace?: boolean, force?: boolean }) => Promise<void>} navigate
 * @property {() => CoraliteRoute} current
 * @property {(guard: (ctx: { to: CoraliteRoute, from: CoraliteRoute, signal: AbortSignal }) => any) => () => void} beforeEach
 * @property {boolean} viewTransitions
 */

/**
 * Testing-mode API attached to `window.__coralite_test__`.
 * Only present when the build was created with mode: 'testing'.
 *
 * @typedef {Object} CoraliteTestAPI
 * @property {Promise<boolean>} ready
 * @property {() => Promise<void>} reset
 * @property {() => Promise<void>} flush
 * @property {(tag: string) => any} [getComponent]
 * @property {() => number} [getHydratedCount]
 * @property {() => any[]} [getInstances]
 */

/**
 * Window globals that Coralite sets for cross-module communication.
 * Access these via `win.__coralite_hydration__` etc. — the type
 * covers every key Coralite guarantees exists at runtime.
 *
 * @typedef {Object} CoraliteGlobals
 * @property {CoraliteHydration} [__coralite_hydration__]
 * @property {CoraliteRouter} [__coralite_router__]
 * @property {Record<string, number>} [__coralite_instanceCounters]
 * @property {Record<string, any>} [__coralite_page_config__]
 * @property {CoraliteRuntime} [__coralite__]
 * @property {Set<string>} [__coralite_styles_loaded__]
 * @property {CoraliteTestAPI} [__coralite_test__]
 */

/**
 * `window` augmented with Coralite's runtime globals.
 * Use this in JSDoc casts instead of `@type {any}` on window accesses.
 *
 * Phantom globals (e.g. `__coralite_plugin_contexts__`) will fail `tsc`
 * with TS2339, preventing the class of bug that broke the first E2E-4
 * attempt.
 *
 * @typedef {typeof globalThis & CoraliteGlobals} CoraliteGlobalThis
 */

export {}

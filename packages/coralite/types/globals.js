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
 * Hydration payload mapping component instance IDs to their serialized SSR state.
 *
 * @typedef {Record<string, Record<string, any>>} CoraliteHydration
 */

/**
 * Router plugin API attached to `window.__coralite__.plugins.router`.
 *
 * @typedef {Object} CoraliteRouter
 * @property {(path: string, options?: { replace?: boolean, force?: boolean, depth?: number }) => Promise<void>} navigate
 * @property {() => ({ path: string } & Partial<CoraliteRoute>)} current
 * @property {(guard: (ctx: { to: { path: string } & Partial<CoraliteRoute>, from: { path: string } & Partial<CoraliteRoute>, signal: AbortSignal }) => any) => () => void} beforeEach
 * @property {boolean} [viewTransitions]
 */

/**
 * Configuration sub-namespace attached to `window.__coralite__.config`.
 *
 * @typedef {Object} CoraliteConfigRuntime
 * @property {any} [listStrategy]
 * @property {boolean} [viewTransitions]
 * @property {Record<string, any> | null} [page]
 */

/**
 * Mutable state sub-namespace attached to `window.__coralite__.state`.
 *
 * @typedef {Object} CoraliteStateRuntime
 * @property {any} [store]
 * @property {CoraliteHydration} [hydration]
 * @property {CoraliteRoute} [route]
 * @property {Record<string, number>} [counters]
 * @property {Set<string>} [stylesLoaded]
 * @property {() => CoraliteHydration} [getHydration]
 * @property {(next: Record<string, any>) => void} [mergeHydration]
 * @property {(next: Record<string, any>) => void} [replaceHydration]
 */

/**
 * DOM and asset management sub-namespace attached to `window.__coralite__.dom`.
 *
 * @typedef {Object} CoraliteDomRuntime
 * @property {(tag: string) => Promise<any>} [loadComponent]
 * @property {(el: Element) => Promise<void>} [upgrade]
 * @property {import('./core.js').CoraliteImportCSS} [importCSS]
 * @property {(tag: string, options?: Object) => HTMLElement} [createElement]
 * @property {(html: string, instanceId?: string) => string} [processHTML]
 */

/**
 * Plugins sub-namespace attached to `window.__coralite__.plugins`.
 *
 * @typedef {Object} CoralitePluginsRuntime
 * @property {Record<string, Function>} [isomorphic]
 * @property {(instanceContext: any) => Promise<any>} [getClientContext]
 * @property {CoraliteRouter} [router]
 */

/**
 * DevTools introspection and diagnostics API attached to `window.__coralite__.devtools`.
 * Only present when the build was created in development or testing mode.
 *
 * @typedef {Object} CoraliteDevToolsAPI
 * @property {(element: Element) => any} getComponent
 * @property {() => string[]} getRegisteredComponents
 * @property {() => number} getHydratedCount
 * @property {(tagName?: string) => Element[]} getInstances
 * @property {() => any[]} getEvents
 * @property {string[]} stylesLoaded
 * @property {(error: Error, title?: string) => void} [showError]
 * @property {(event: any) => void} [recordEvent]
 */

/**
 * Testing-mode API attached to `window.__coralite__.test`.
 * Only present when the build was created with mode: 'testing'.
 *
 * @typedef {Object} CoraliteTestAPI
 * @property {Promise<void>} ready
 * @property {() => Promise<void>} reset
 * @property {() => Promise<void>} flush
 * @property {(element: Element) => any} [getComponent]
 * @property {() => number} [getHydratedCount]
 * @property {() => any[]} [getEvents]
 * @property {(tagName?: string) => Element[]} [getInstances]
 */

/**
 * Runtime object attached to `window.__coralite__`.
 * Single global namespace for Coralite framework state, DOM operations, plugins, and dev/test tools.
 *
 * @typedef {Object} CoraliteRuntime
 * @property {string} [version]
 * @property {string} [mode]
 * @property {CoraliteConfigRuntime} [config]
 * @property {CoraliteStateRuntime} [state]
 * @property {CoraliteDomRuntime} [dom]
 * @property {CoralitePluginsRuntime} [plugins]
 * @property {any} [lifecycle]
 * @property {CoraliteDevToolsAPI} [devtools]
 * @property {CoraliteTestAPI} [test]
 */

/**
 * Window global namespace that Coralite sets for cross-module communication.
 *
 * @typedef {Object} CoraliteGlobals
 * @property {CoraliteRuntime} [__coralite__]
 */

/**
 * `window` augmented with Coralite's runtime namespace.
 * Use this in JSDoc casts instead of `@type {any}` on window accesses.
 *
 * @typedef {typeof globalThis & CoraliteGlobals} CoraliteGlobalThis
 */

export {}

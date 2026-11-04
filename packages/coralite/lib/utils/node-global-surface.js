import globals from 'globals'

/**
 * Memoized runtime Node global surface. Captured once from the live Node
 * process so the surface is always version-proof: globals added by newer
 * Node releases are included without a code change.
 *
 * @type {Set<string>|null}
 */
let nodeGlobalSurface = null

/**
 * Memoized browser global surface. Anything in this set is legitimate to
 * reference from client() code, which executes in the browser, and must
 * never be flagged as a Node-only leak (CORALITE-E304). Combined from
 * three sources:
 *
 *  - globals.browser: the Web platform surface from the `globals` package
 *    (the dataset ESLint uses), so new browser APIs are picked up with a
 *    routine dependency update instead of a code change
 *  - ECMASCRIPT_BUILTINS: language built-ins, which exist in every JS
 *    environment; safe to hardcode because new ones are rare
 *  - EXTRA_SHARED_GLOBALS: shared Web APIs the `globals` snapshot has
 *    historically lagged on
 *
 * Browser-only names (window, document, localStorage, ...) never match
 * the Node runtime surface, so including them is harmless.
 *
 * @type {Set<string>|null}
 */
let browserGlobalSurface = null

/**
 * ECMAScript language built-ins. These exist in Node and in browsers, so
 * referencing them from client() is always legitimate. Kept as a frozen
 * list because the language surface changes slowly; `undefined` and
 * `unescape` are included because the `globals` dataset omits them.
 *
 * @type {Set<string>}
 */
const ECMASCRIPT_BUILTINS = new Set([
  'AggregateError',
  'Array',
  'ArrayBuffer',
  'Atomics',
  'BigInt',
  'BigInt64Array',
  'BigUint64Array',
  'Boolean',
  'DataView',
  'Date',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'Error',
  'escape',
  'eval',
  'EvalError',
  'FinalizationRegistry',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'Function',
  'Infinity',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Intl',
  'isFinite',
  'isNaN',
  'Iterator',
  'JSON',
  'Map',
  'Math',
  'NaN',
  'Number',
  'Object',
  'parseFloat',
  'parseInt',
  'Promise',
  'Proxy',
  'RangeError',
  'ReferenceError',
  'Reflect',
  'RegExp',
  'Set',
  'SharedArrayBuffer',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'undefined',
  'unescape',
  'URIError',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array',
  'WeakMap',
  'WeakRef',
  'WeakSet',
  'WebAssembly'
])

/**
 * Web APIs that exist both in Node and in browsers that the `globals`
 * snapshot may not list yet (TransformStream is missing from its browser
 * data as of v15). All of them are genuine browser globals, so listing
 * them here can never mask a real Node-only leak.
 *
 * @type {Set<string>}
 */
const EXTRA_SHARED_GLOBALS = new Set([
  'ByteLengthQueuingStrategy',
  'CompressionStream',
  'CountQueuingStrategy',
  'DecompressionStream',
  'globalThis',
  'ReadableStream',
  'TextDecoderStream',
  'TextEncoderStream',
  'TransformStream',
  'WritableStream'
])

/**
 * Returns the complete set of identifiers available as globals in the Node
 * runtime that runs Coralite builds and validators.
 *
 * @returns {Set<string>} Identifiers resolvable in the Node runtime surface
 */
export function getNodeGlobalSurface () {
  if (nodeGlobalSurface === null) {
    nodeGlobalSurface = new Set(Object.getOwnPropertyNames(globalThis))
  }
  return nodeGlobalSurface
}

/**
 * Returns the complete set of identifiers that are globals in the browser
 * and therefore safe to reference from client() code.
 *
 * @returns {Set<string>} Identifiers resolvable in the browser runtime surface
 */
export function getBrowserGlobalSurface () {
  if (browserGlobalSurface === null) {
    browserGlobalSurface = new Set([
      ...Object.keys(globals.browser ?? {}),
      ...ECMASCRIPT_BUILTINS,
      ...EXTRA_SHARED_GLOBALS
    ])
  }
  return browserGlobalSurface
}

/**
 * Checks whether an identifier is part of the Node runtime global surface.
 *
 * @param {string} name - Identifier name
 * @returns {boolean} True when the identifier resolvable without imports in the Node runtime
 */
export function isNodeGlobal (name) {
  return getNodeGlobalSurface().has(name)
}

/**
 * Checks whether an identifier is a Node runtime global that is NOT also a
 * browser (Web platform) global. Only these names are unsafe to reference
 * from client() code, which executes in the browser.
 *
 * @param {string} name - Identifier name
 * @returns {boolean} True when the identifier exists in Node but not in the browser
 */
export function isNodeOnlyGlobal (name) {
  return isNodeGlobal(name) && !getBrowserGlobalSurface().has(name)
}

/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { setupDevTools } from '../../../../lib/client/utils/devtools.js'

describe('window.__coralite_test__ API surface', () => {
  let origWindowCoralite
  let origWindowCoraliteTest

  beforeEach(() => {
    origWindowCoralite = globalThis.window.__coralite__
    origWindowCoraliteTest = globalThis.window.__coralite_test__
    delete globalThis.window.__coralite__
    delete globalThis.window.__coralite_test__
  })

  afterEach(() => {
    if (origWindowCoralite) {
      globalThis.window.__coralite__ = origWindowCoralite
    } else {
      delete globalThis.window.__coralite__
    }

    if (origWindowCoraliteTest) {
      globalThis.window.__coralite_test__ = origWindowCoraliteTest
    } else {
      delete globalThis.window.__coralite_test__
    }

    if (document.documentElement.hasAttribute('data-coralite-ready')) {
      document.documentElement.removeAttribute('data-coralite-ready')
    }
  })

  it('should create window.__coralite_test__ when mode is "testing"', () => {
    globalThis.window.__coralite__ = { mode: 'testing' }
    setupDevTools()

    assert.notStrictEqual(globalThis.window.__coralite_test__, undefined)
    assert.strictEqual(typeof globalThis.window.__coralite_test__.ready, 'object')
    assert.strictEqual(typeof globalThis.window.__coralite_test__.reset, 'function')
    assert.strictEqual(typeof globalThis.window.__coralite_test__.flush, 'function')
    assert.strictEqual(typeof globalThis.window.__coralite_test__.getComponent, 'function')
    assert.strictEqual(typeof globalThis.window.__coralite_test__.getHydratedCount, 'function')
    assert.strictEqual(typeof globalThis.window.__coralite_test__.getEvents, 'function')
    assert.strictEqual(typeof globalThis.window.__coralite_test__.getInstances, 'function')
  })

  it('should not create window.__coralite_test__ when mode is "development" or "production"', () => {
    globalThis.window.__coralite__ = { mode: 'development' }
    setupDevTools()
    assert.strictEqual(globalThis.window.__coralite_test__, undefined)

    delete globalThis.window.__coralite__
    globalThis.window.__coralite__ = { mode: 'production' }
    setupDevTools()
    assert.strictEqual(globalThis.window.__coralite_test__, undefined)
  })

  it('should resolve ready promise when document is ready and lifecycle is hydrated', async () => {
    let resolveHydrated
    const hydratedPromise = new Promise(resolve => {
      resolveHydrated = resolve
    })

    globalThis.window.__coralite__ = {
      mode: 'testing',
      lifecycle: {
        hydrated: hydratedPromise,
        _hc: 2
      }
    }

    setupDevTools()
    const testAPI = globalThis.window.__coralite_test__

    let resolved = false
    const readyP = testAPI.ready.then(() => {
      resolved = true
    })

    assert.strictEqual(resolved, false)
    document.documentElement.setAttribute('data-coralite-ready', 'true')
    resolveHydrated()

    await readyP
    assert.strictEqual(resolved, true)

    // Reading ready after settling returns an already-resolved promise
    const readyP2 = testAPI.ready
    let resolved2 = false
    await readyP2.then(() => {
      resolved2 = true
    })
    assert.strictEqual(resolved2, true)
  })

  it('should execute reset() clearing localStorage, sessionStorage, IndexedDB, and serviceWorkers without reloading page', async () => {
    globalThis.window.__coralite__ = { mode: 'testing' }
    setupDevTools()
    const testAPI = globalThis.window.__coralite_test__

    let localStorageCleared = false
    let sessionStorageCleared = false
    let dbDeleted = null
    let swUnregistered = false

    globalThis.localStorage = {
      clear: () => {
        localStorageCleared = true
      }
    }
    globalThis.sessionStorage = {
      clear: () => {
        sessionStorageCleared = true
      }
    }
    globalThis.indexedDB = {
      databases: async () => [{ name: 'test-db' }],
      deleteDatabase: (name) => {
        dbDeleted = name
        return {
          onsuccess: null,
          onerror: null,
          onblocked: null
        }
      }
    }

    // Trigger onsuccess asynchronously when deleteDatabase is called
    const origDeleteDB = globalThis.indexedDB.deleteDatabase
    globalThis.indexedDB.deleteDatabase = (name) => {
      const req = origDeleteDB(name)
      setTimeout(() => {
        if (req.onsuccess) {
          req.onsuccess()
        }
      }, 5)
      return req
    }

    globalThis.navigator.serviceWorker = {
      getRegistrations: async () => [
        {
          unregister: async () => {
            swUnregistered = true
            return true
          }
        }
      ]
    }

    await testAPI.reset()

    assert.strictEqual(localStorageCleared, true)
    assert.strictEqual(sessionStorageCleared, true)
    assert.strictEqual(dbDeleted, 'test-db')
    assert.strictEqual(swUnregistered, true)
  })

  it('should execute flush() resolving after updateComplete on instances', async () => {
    let updateCompleted = false
    const updateCompletePromise = new Promise(resolve => {
      setTimeout(() => {
        updateCompleted = true
        resolve(true)
      }, 10)
    })

    const mockElement = {
      updateComplete: updateCompletePromise,
      _isUpdatePending: false
    }

    globalThis.window.__coralite__ = { mode: 'testing' }
    setupDevTools()
    const testAPI = globalThis.window.__coralite_test__

    // Override getInstances on DevTools API for testing
    globalThis.window.__coralite__.getInstances = () => [mockElement]

    await testAPI.flush()
    assert.strictEqual(updateCompleted, true)
  })

  it('should delegate getComponent, getHydratedCount, getEvents, and getInstances', () => {
    const mockComponentContext = { instanceId: 'comp-1' }
    const mockEvents = [{ type: 'render' }]

    globalThis.window.__coralite__ = {
      mode: 'testing',
      lifecycle: { _hc: 5 }
    }
    setupDevTools()

    const testAPI = globalThis.window.__coralite_test__

    // Inject mock implementations onto window.__coralite__
    globalThis.window.__coralite__.getComponent = (el) => (el === 'mockEl' ? mockComponentContext : null)
    globalThis.window.__coralite__.getHydratedCount = () => 5
    globalThis.window.__coralite__.getEvents = () => mockEvents
    globalThis.window.__coralite__.getInstances = (tag) => (tag === 'x-btn' ? ['btn1'] : ['btn1', 'card1'])

    assert.strictEqual(testAPI.getComponent('mockEl'), mockComponentContext)
    assert.strictEqual(testAPI.getComponent('other'), null)
    assert.strictEqual(testAPI.getHydratedCount(), 5)
    assert.deepStrictEqual(testAPI.getEvents(), mockEvents)
    assert.deepStrictEqual(testAPI.getInstances('x-btn'), ['btn1'])
    assert.deepStrictEqual(testAPI.getInstances(), ['btn1', 'card1'])
  })
})

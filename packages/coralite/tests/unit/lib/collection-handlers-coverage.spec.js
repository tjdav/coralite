import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createPageHandlers } from '../../../lib/collection-handlers.js'

describe('collection-handlers.js Coverage Gaps', () => {
  const mockApp = {
    options: {
      path: {
        pages: '/pages',
        components: '/components'
      },
      ignoreByAttribute: [],
      skipRenderByAttribute: [],
      mode: 'development'
    },
    _dependencyGraph: {
      directPageComponents: {},
      pageCustomElements: {}
    },
    _refreshDependencyGraph: () => {
    },
    components: {
      getItem: () => null
    },
    source: {
      utils: {
        getHtmlFile: async () => 'content'
      }
    }
  }

  const triggerHook = async (name, context) => context
  const handleError = () => {
  }

  it('onPageSet should handle missing content', async () => {
    const handlers = createPageHandlers({
      app: mockApp,
      triggerHook,
      handleError
    })
    const data = {
      type: 'page',
      path: {
        pathname: '/pages/index.html',
        dirname: '/pages',
        filename: 'index.html'
      },
      content: undefined,
      state: {}
    }
    const result = await handlers.onPageSet(data)
    assert.strictEqual(result.value.path.filename, 'index.html')
  })

  it('onPageUpdate should return result directly in production', async () => {
    const prodApp = {
      ...mockApp,
      options: {
        ...mockApp.options,
        mode: 'production'
      }
    }
    const handlers = createPageHandlers({
      app: prodApp,
      triggerHook,
      handleError
    })
    const newValue = { result: 'new' }
    const result = await handlers.onPageUpdate(newValue, {})
    assert.strictEqual(result, 'new')
  })

  it('onPageDelete should successfully remove the page from the side-car registry', async () => {
    const handlers = createPageHandlers({
      app: mockApp,
      triggerHook,
      handleError
    })
    mockApp._dependencyGraph.directPageComponents['/p'] = ['comp-a']
    await handlers.onPageDelete({ path: { pathname: '/p' } })
    assert.strictEqual(mockApp._dependencyGraph.directPageComponents['/p'], undefined)
  })

  it('onComponentSet should return nothing if not a template', async () => {
    const handlers = createPageHandlers({
      app: mockApp,
      triggerHook,
      handleError
    })
    const result = await handlers.onComponentSet({
      content: 'no template',
      path: { pathname: '/c.html' }
    })
    assert.strictEqual(result, undefined)
  })

  it('onComponentUpdate should return nothing if not a template', async () => {
    const handlers = createPageHandlers({
      app: mockApp,
      triggerHook,
      handleError
    })
    const result = await handlers.onComponentUpdate({
      content: 'no template',
      path: { pathname: '/c.html' }
    })
    assert.strictEqual(result, undefined)
  })
})

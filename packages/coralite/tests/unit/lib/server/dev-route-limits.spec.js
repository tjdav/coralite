import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { createTestProject } from '../../utils/project.js'
import { applyDevRouteLimits } from '../../../../lib/server/route.js'

const PATHS = [
  { id: 'one' },
  { id: 'two' },
  { id: 'three' },
  { id: 'four' },
  { id: 'five' }
]

function dynamicPage () {
  return `<!DOCTYPE html>
<html><body><h1>{{ id }}</h1></body></html>
<script type="module">
  export function paths () {
    return ${JSON.stringify(PATHS)}
  }
  export function server ({ route }) {
    return { id: route.params.id }
  }
</script>`
}

describe('Development route limits', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
    await mkdir(join(project.pagesDir, 'posts'), { recursive: true })
    await project.writePage('posts/[id].html', dynamicPage())
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('caps enumerated paths globally across collections', () => {
    const first = {
      result: {
        page: {
          enumeratedPaths: [{ id: 'a' }, { id: 'b' }]
        }
      }
    }
    const second = {
      result: {
        page: {
          enumeratedPaths: [{ id: 'c' }, { id: 'd' }]
        }
      }
    }

    applyDevRouteLimits([{ list: [first, second] }], { maxPages: 3 })

    assert.deepEqual(first.result.page.enumeratedPaths, [{ id: 'a' }, { id: 'b' }])
    assert.deepEqual(second.result.page.enumeratedPaths, [{ id: 'c' }])
  })

  it('applies maxPages in development and ignores it in production', async () => {
    const dev = await project.createCoralite({
      mode: 'development',
      dev: { maxPages: 2 }
    })
    const devPage = dev.pages.list[0].result.page
    assert.equal(devPage.enumeratedPaths.length, 2)
    await dev.clearCache(true)

    const prod = await project.createCoralite({
      mode: 'production',
      dev: { maxPages: 2 }
    })
    const prodPage = prod.pages.list[0].result.page
    assert.equal(prodPage.enumeratedPaths.length, PATHS.length)
  })

  it('supports the limit alias', async () => {
    const app = await project.createCoralite({
      mode: 'development',
      dev: { limit: 1 }
    })

    assert.equal(app.pages.list[0].result.page.enumeratedPaths.length, 1)
  })

  it('filters before applying the cap', async () => {
    const app = await project.createCoralite({
      mode: 'development',
      dev: {
        maxPages: 1,
        routeFilter: ({ params }) => params.id !== 'one'
      }
    })

    assert.deepEqual(app.pages.list[0].result.page.enumeratedPaths.map(params => params.id), ['two'])
  })

  it('reapplies limits without shrinking already-filtered pages', async () => {
    const app = await project.createCoralite({
      mode: 'development',
      dev: { maxPages: 3 }
    })
    const page = app.pages.list[0].result.page
    assert.equal(page.enumeratedPaths.length, 3)

    applyDevRouteLimits([app.pages], {
      maxPages: 3,
      app
    })
    assert.equal(page.enumeratedPaths.length, 3)
  })
})

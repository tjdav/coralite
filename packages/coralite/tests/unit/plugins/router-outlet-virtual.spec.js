import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'node:fs/promises'
import { createCoralite } from '../../../lib/server/create.js'

describe('router outlet virtual component (REL-001a)', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'coralite-router-test-'))
  })

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('router plugin registers outlet without file read', async () => {
    const originalReadFile = fs.readFile
    let calledWithOutlet = false

    fs.readFile = async function (...args) {
      const pathStr = String(args[0] || '')
      if (pathStr.includes('outlet.html')) {
        calledWithOutlet = true
      }
      return originalReadFile.apply(this, args)
    }

    try {
      const componentsDir = join(tempDir, 'components')
      const pagesDir = join(tempDir, 'pages')
      await fs.mkdir(componentsDir, { recursive: true })
      await fs.mkdir(pagesDir, { recursive: true })

      await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        mode: 'testing'
      })

      assert.strictEqual(calledWithOutlet, false, 'fs.readFile should not be called with outlet.html')
    } finally {
      fs.readFile = originalReadFile
    }
  })

  it('router-outlet element resolves from virtual content', async () => {
    const componentsDir = join(tempDir, 'components')
    const pagesDir = join(tempDir, 'pages')
    await fs.mkdir(componentsDir, { recursive: true })
    await fs.mkdir(pagesDir, { recursive: true })

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      mode: 'testing'
    })

    const outletItem = app.components.getItem('router-outlet')
    assert.ok(outletItem, 'router-outlet component should be registered in app.components')
    assert.ok(outletItem.result, 'outlet component should have parsed result')
    assert.strictEqual(outletItem.result.id, 'router-outlet')
  })

  it('router plugin still auto-registers as a core plugin', async () => {
    const componentsDir = join(tempDir, 'components')
    const pagesDir = join(tempDir, 'pages')
    await fs.mkdir(componentsDir, { recursive: true })
    await fs.mkdir(pagesDir, { recursive: true })

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      plugins: [],
      mode: 'testing'
    })

    assert.strictEqual(app._explicitPluginNames.has('router'), false, 'router plugin should not be in explicitPluginNames when not explicitly passed')
    const outletItem = app.components.getItem('router-outlet')
    assert.ok(outletItem, 'router-outlet component should still be registered via core plugin auto-registration')
  })
})

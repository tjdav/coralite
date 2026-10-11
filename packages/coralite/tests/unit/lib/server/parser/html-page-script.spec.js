import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractPageScript } from '../../../../../lib/server/parser/html.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('html.js (extractPageScript)', () => {
  it('should return static page defaults when page has no script block', () => {
    const html = '<h1>Hello Static Page</h1>'
    const result = extractPageScript(html)
    assert.deepStrictEqual(result, {
      hasDefinePage: false,
      blocks: null,
      script: null
    })
  })

  it('should recognize definePage and extract all accepted blocks', () => {
    const html = `
      <script type="module">
        import { definePage } from 'coralite'

        export default definePage({
          paths () { return [] },
          server () { return { msg: 'hi' } },
          getters: { title: ({ state }) => state.msg },
          style: { '--color': 'red' },
          provide: { key: 'val' },
          client () {},
          onError () {}
        })
      </script>
      <h1>Dynamic Page</h1>
    `

    const result = extractPageScript(html)
    assert.strictEqual(result.hasDefinePage, true)
    assert.ok(result.blocks)
    assert.ok('paths' in result.blocks)
    assert.ok('server' in result.blocks)
    assert.ok('getters' in result.blocks)
    assert.ok('style' in result.blocks)
    assert.ok('provide' in result.blocks)
    assert.ok('client' in result.blocks)
    assert.ok('onError' in result.blocks)
  })

  it('should reject attributes block with CORALITE-E107 and alternative message', () => {
    const html = `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({ attributes: {} })
      </script>
    `

    assert.throws(
      () => extractPageScript(html),
      (err) => {
        return (
          err.code === 'CORALITE-E107' &&
          err.message.includes('definePage does not support "attributes". Use "server" to fetch page data.')
        )
      }
    )
  })

  it('should reject slots block with CORALITE-E107', () => {
    const html = `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({ slots: {} })
      </script>
    `

    assert.throws(
      () => extractPageScript(html),
      (err) => {
        return (
          err.code === 'CORALITE-E107' &&
          err.message.includes('definePage does not support "slots". Pages are the outermost layer.')
        )
      }
    )
  })

  it('should reject consume block with CORALITE-E107', () => {
    const html = `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({ consume: {} })
      </script>
    `

    assert.throws(
      () => extractPageScript(html),
      (err) => {
        return (
          err.code === 'CORALITE-E107' &&
          err.message.includes('definePage does not support "consume". Pages are the root provider — use "provide".')
        )
      }
    )
  })

  it('should reject formAssociated block with CORALITE-E107', () => {
    const html = `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({ formAssociated: true })
      </script>
    `

    assert.throws(
      () => extractPageScript(html),
      (err) => {
        return (
          err.code === 'CORALITE-E107' &&
          err.message.includes('definePage does not support "formAssociated". Use a form-associated component instead.')
        )
      }
    )
  })

  it('should reject unknown block with CORALITE-E107 listing valid blocks', () => {
    const html = `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({ unknownBlock: {} })
      </script>
    `

    assert.throws(
      () => extractPageScript(html),
      (err) => {
        return (
          err.code === 'CORALITE-E107' &&
          err.message.includes('Unknown block "unknownBlock" in definePage. Valid blocks are: paths, server, getters, style, provide, client, onError.')
        )
      }
    )
  })

  it('should throw CORALITE-E108 when bare exports are used without definePage', () => {
    const html = `
      <script type="module">
        export const paths = () => []
        export const server = () => ({})
      </script>
    `

    assert.throws(
      () => extractPageScript(html),
      (err) => {
        return (
          err.code === 'CORALITE-E108' &&
          err.message.includes('Page uses the deprecated bare-export shape. Use export default definePage({ ... }) instead.')
        )
      }
    )
  })

  it('should process created page fixtures from disk correctly', async () => {
    const fixturesDir = resolve(__dirname, '../../../../fixtures/pages')

    const withDefinePageContent = await readFile(resolve(fixturesDir, 'with-define-page.html'), 'utf8')
    const withDefinePageResult = extractPageScript(withDefinePageContent)
    assert.strictEqual(withDefinePageResult.hasDefinePage, true)
    assert.ok(withDefinePageResult.blocks.paths)
    assert.ok(withDefinePageResult.blocks.server)

    const staticContent = await readFile(resolve(fixturesDir, 'static.html'), 'utf8')
    const staticResult = extractPageScript(staticContent)
    assert.strictEqual(staticResult.hasDefinePage, false)
    assert.strictEqual(staticResult.blocks, null)

    const bareExportsContent = await readFile(resolve(fixturesDir, 'bare-exports.html'), 'utf8')
    assert.throws(
      () => extractPageScript(bareExportsContent),
      (err) => err.code === 'CORALITE-E108'
    )

    const rejectedBlockContent = await readFile(resolve(fixturesDir, 'rejected-block.html'), 'utf8')
    assert.throws(
      () => extractPageScript(rejectedBlockContent),
      (err) => err.code === 'CORALITE-E107'
    )
  })
})

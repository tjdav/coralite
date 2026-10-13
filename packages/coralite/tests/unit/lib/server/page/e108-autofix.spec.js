import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fixCommand } from '../../../../../../coralite-scripts/libs/commands/fix.js'

describe('CORALITE-E108 Auto-Fix Integration (e108-autofix)', () => {
  it('runs coralite fix on a project page with bare exports and rewrites to definePage', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'coralite-e108-fix-'))
    const pagesDir = join(tmpDir, 'src', 'pages')
    const pagePath = join(pagesDir, 'post.html')

    try {
      await mkdir(pagesDir, { recursive: true })
      await writeFile(
        pagePath,
        `<script type="module">\n  export const paths = () => [{ params: { id: '1' } }]\n  export const server = ({ route }) => ({ title: route.params.id })\n</script>\n<h1>Post</h1>\n`,
        'utf8'
      )

      const fixResult = await fixCommand(null, {
        cwd: tmpDir,
        pages: 'src/pages',
        components: false,
        plugins: false,
        dryRun: false
      })

      assert.strictEqual(fixResult.totalFixesCount, 1)
      assert.strictEqual(fixResult.modifiedFiles.length, 1)

      const rewritten = await readFile(pagePath, 'utf8')
      assert.match(rewritten, /import { definePage } from 'coralite'/)
      assert.match(rewritten, /export default definePage\({/)
      assert.match(rewritten, /paths:/)
      assert.match(rewritten, /server:/)
      assert.doesNotMatch(rewritten, /export const paths/)
      assert.doesNotMatch(rewritten, /export const server/)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })
})

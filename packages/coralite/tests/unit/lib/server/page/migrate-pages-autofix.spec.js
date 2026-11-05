import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fixCommand } from '#lib/cli/commands/fix.js'

const DEFINE_PAGE_SOURCE = `<script type="module">
  import { definePage } from 'coralite'

  export default definePage({
    async server ({ route }) {
      return { title: route.path }
    },
    getters: {
      heading: ({ state }) => state.title
    }
  })
</script>
<h1>{{ heading }}</h1>
`

describe('Page Flat-Export Migration Integration (--migrate-pages)', () => {
  it('rewrites definePage pages to flat named exports when migratePages is enabled', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'coralite-migrate-pages-'))
    const pagesDir = join(tmpDir, 'src', 'pages')
    const pagePath = join(pagesDir, 'post.html')

    try {
      await mkdir(pagesDir, { recursive: true })
      await writeFile(pagePath, DEFINE_PAGE_SOURCE, 'utf8')

      const fixResult = await fixCommand(null, {
        cwd: tmpDir,
        pages: 'src/pages',
        components: false,
        plugins: false,
        migratePages: true,
        dryRun: false
      })

      assert.strictEqual(fixResult.totalFixesCount, 1)
      assert.strictEqual(fixResult.modifiedFiles.length, 1)

      const rewritten = await readFile(pagePath, 'utf8')
      assert.match(rewritten, /export async function server \(/)
      assert.match(rewritten, /export const getters = \{/)
      assert.doesNotMatch(rewritten, /definePage/)
      assert.doesNotMatch(rewritten, /import \{ definePage \}/)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('leaves pages untouched without migratePages', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'coralite-migrate-pages-off-'))
    const pagesDir = join(tmpDir, 'src', 'pages')
    const pagePath = join(pagesDir, 'post.html')

    try {
      await mkdir(pagesDir, { recursive: true })
      await writeFile(pagePath, DEFINE_PAGE_SOURCE, 'utf8')

      const fixResult = await fixCommand(null, {
        cwd: tmpDir,
        pages: 'src/pages',
        components: false,
        plugins: false,
        dryRun: false
      })

      assert.strictEqual(fixResult.totalFixesCount, 0)
      assert.strictEqual(await readFile(pagePath, 'utf8'), DEFINE_PAGE_SOURCE)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('does not write files during a dry run', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'coralite-migrate-pages-dry-'))
    const pagesDir = join(tmpDir, 'src', 'pages')
    const pagePath = join(pagesDir, 'post.html')

    try {
      await mkdir(pagesDir, { recursive: true })
      await writeFile(pagePath, DEFINE_PAGE_SOURCE, 'utf8')

      const fixResult = await fixCommand(null, {
        cwd: tmpDir,
        pages: 'src/pages',
        components: false,
        plugins: false,
        migratePages: true,
        dryRun: true
      })

      assert.ok(fixResult.totalFixesCount >= 1)
      assert.strictEqual(await readFile(pagePath, 'utf8'), DEFINE_PAGE_SOURCE)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { ESLint } from 'eslint'

describe('ESLint Boundary Rule (lib/client -> lib/server)', () => {
  const repoRoot = path.resolve(process.cwd())
  const eslint = new ESLint({ cwd: repoRoot })

  it('rejects lib/client → lib/server (relative, two-up)', async () => {
    const code = "import { _x } from '../../server/plugin/define.js'\n"
    const filePath = 'packages/coralite/lib/client/utils/test.js'
    const results = await eslint.lintText(code, { filePath })

    assert.ok(results[0].messages.length >= 1, 'Expected at least 1 lint error')
    const hasMatch = results[0].messages.some((msg) => /lib\/server/.test(msg.message))
    assert.ok(hasMatch, 'Expected error message to match /lib\\/server/')
  })

  it('rejects lib/client → lib/server (relative, one-up)', async () => {
    const code = "import { _x } from '../server/thing.js'\n"
    const filePath = 'packages/coralite/lib/client/test.js'
    const results = await eslint.lintText(code, { filePath })

    assert.ok(results[0].messages.length >= 1, 'Expected at least 1 lint error')
    const hasMatch = results[0].messages.some((msg) => /lib\/server/.test(msg.message))
    assert.ok(hasMatch, 'Expected error message to match /lib\\/server/')
  })

  it('allows lib/client → lib/shared', async () => {
    const code = "import { _x } from '../../shared/core.js'\n"
    const filePath = 'packages/coralite/lib/client/utils/test.js'
    const results = await eslint.lintText(code, { filePath })

    assert.equal(results[0].messages.length, 0, 'Expected 0 lint errors')
  })

  it('allows lib/server → lib/server (sanity)', async () => {
    const code = "import { _x } from '../server/other.js'\n"
    const filePath = 'packages/coralite/lib/server/test.js'
    const results = await eslint.lintText(code, { filePath })

    assert.equal(results[0].messages.length, 0, 'Expected 0 lint errors')
  })
})

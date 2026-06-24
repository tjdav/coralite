import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { access, unlink, readFile } from 'node:fs/promises'
import { createCLIProject } from '../utils/project.js'

describe('Coralite CLI Build Integration', () => {
  let project

  beforeEach(async () => {
    project = await createCLIProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should perform a full rebuild when the --clean flag is provided', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')

    // First run: standard build
    await project.runBuild(['--verbose'])

    // Second run: passing --clean should NOT skip
    const { stdout } = await project.runBuild(['--clean', '--verbose'])

    assert.ok(!stdout.includes('skipped'), 'Should not skip pages when --clean is provided')
    assert.ok(stdout.includes('index.html'), `Should have built index.html, got: ${stdout}`)
  })

  it('should skip unchanged files during incremental build', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')

    await project.runBuild(['--verbose'])

    const { stdout } = await project.runBuild(['--verbose'])
    // When skipped in verbose mode, it doesn't print the page path.
    // The previous test run showed that it only printed the coralite-runtime.js.
    // So if index.html is NOT in stdout, it means it was skipped.
    assert.ok(!stdout.includes('index.html'), `Should skip unchanged page (index.html should not be in output), got: ${stdout}`)
  })

  it('should delete stale files (Zombie File Trap)', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')
    await project.writePage('about.html', '<h1>About</h1>')

    await project.runBuild(['--verbose'])

    const aboutOutputPath = path.join(project.outputDir, 'about.html')
    await access(aboutOutputPath)

    // Delete source page
    await project.deletePage('about.html')

    // Run incremental build
    await project.runBuild(['--verbose'])

    // Check if stale output is gone
    try {
      await access(aboutOutputPath)
      assert.fail('Stale output file should have been deleted')
    } catch (err) {
      assert.strictEqual(err.code, 'ENOENT', 'File should be missing')
    }

    // index.html should still exist
    await access(path.join(project.outputDir, 'index.html'))
  })

  it('should not delete critical manifest files (Manifest Amnesia)', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')
    await project.runBuild(['--verbose'])

    const manifestPath = path.join(project.testDir, '.coralite', 'manifest.json')
    await access(manifestPath)

    // Trigger incremental build with potential cleanup
    await project.runBuild(['--verbose'])

    // manifest.json should still exist
    await access(manifestPath)
  })

  it('should recover missing output files (Ghost Erasure)', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')
    await project.runBuild(['--verbose'])

    const indexOutputPath = path.join(project.outputDir, 'index.html')
    await access(indexOutputPath)

    // Manually delete output file
    await unlink(indexOutputPath)

    // Run incremental build without source changes
    const { stdout } = await project.runBuild(['--verbose'])

    assert.ok(stdout.includes('index.html'), 'Should not skip missing output file')
    await access(indexOutputPath)
  })

  it('should rebuild dependent pages when a component changes', async () => {
    await project.writePage('index.html', '<my-comp></my-comp>')
    await project.writeComponent('my-comp.html', '<template id="my-comp"><div>Original</div></template>')

    await project.runBuild(['--verbose'])

    // Change component
    await project.writeComponent('my-comp.html', '<template id="my-comp"><div>Updated</div></template>')

    const { stdout } = await project.runBuild(['--verbose'])
    assert.ok(stdout.includes('index.html'), 'Should rebuild page when component changes')

    const content = await readFile(path.join(project.outputDir, 'index.html'), 'utf8')
    assert.ok(content.includes('Updated'), 'Content should be updated')
  })
})

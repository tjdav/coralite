/**
 * jsbenchmarks.com submission-prep validator adapter for Coralite external benchmark runner.
 *
 * jsbenchmarks.com does not expose a local-runnable harness. This adapter
 * validates that the local submission copy is structurally valid, and
 * emits submission instructions. It is not a runner.
 */

import path from 'node:path'
import fs from 'node:fs/promises'

const SUBMISSION_REL_PATH = 'benchmarks/jsbenchmarks/coralite'

const adapter = {
  name: 'jsbenchmarks',
  mode: 'submission-only',

  /**
   * Validates the local jsbenchmarks submission copy structure and files.
   * @param {string} rootDir Repository root directory
   * @param {Function} log Log callback
   * @returns {Promise<{ valid: boolean, checks: Array<{ name: string, pass: boolean, error?: string }> }>} Validation result
   */
  validate: async (rootDir, log) => {
    const targetDir = path.join(rootDir, SUBMISSION_REL_PATH)
    log('jsbenchmarks', `Validating local submission copy at ${SUBMISSION_REL_PATH}...`)

    const checks = []

    // 1. package.json exists and has expected fields
    try {
      const pkgPath = path.join(targetDir, 'package.json')
      const pkgRaw = await fs.readFile(pkgPath, 'utf8')
      const pkg = JSON.parse(pkgRaw)

      const hasJsbenchmarksField = Boolean(
        pkg.jsbenchmarks &&
        typeof pkg.jsbenchmarks.website === 'string' &&
        typeof pkg.jsbenchmarks.package === 'string'
      )

      if (hasJsbenchmarksField) {
        checks.push({ name: 'package.json valid with jsbenchmarks metadata', pass: true })
      } else {
        checks.push({
          name: 'package.json valid with jsbenchmarks metadata',
          pass: false,
          error: 'Missing required "jsbenchmarks" object in package.json (website, package)'
        })
      }
    } catch (err) {
      checks.push({
        name: 'package.json valid with jsbenchmarks metadata',
        pass: false,
        error: `Could not read package.json: ${err.message}`
      })
    }

    // 2. coralite.config.js exists
    try {
      const configPath = path.join(targetDir, 'coralite.config.js')
      await fs.stat(configPath)
      checks.push({ name: 'coralite.config.js exists', pass: true })
    } catch (err) {
      checks.push({
        name: 'coralite.config.js exists',
        pass: false,
        error: `Missing coralite.config.js: ${err.message}`
      })
    }

    // 3. Expected components exist
    const requiredComponents = ['bench-app.html', 'bench-row.html']
    for (const comp of requiredComponents) {
      try {
        const compPath = path.join(targetDir, 'components', comp)
        await fs.stat(compPath)
        checks.push({ name: `component components/${comp} exists`, pass: true })
      } catch (err) {
        checks.push({
          name: `component components/${comp} exists`,
          pass: false,
          error: `Missing component ${comp}: ${err.message}`
        })
      }
    }

    // 4. pages/index.html exists
    try {
      const indexPath = path.join(targetDir, 'pages/index.html')
      await fs.stat(indexPath)
      checks.push({ name: 'page pages/index.html exists', pass: true })
    } catch (err) {
      checks.push({
        name: 'page pages/index.html exists',
        pass: false,
        error: `Missing pages/index.html: ${err.message}`
      })
    }

    // 5. Check for stale Coralite APIs or legacy calls in bench-app.html
    try {
      const appPath = path.join(targetDir, 'components/bench-app.html')
      const content = await fs.readFile(appPath, 'utf8')
      if (content.includes('coralite-scripts') || content.includes('window.coralite')) {
        checks.push({
          name: 'no stale Coralite APIs in bench-app.html',
          pass: false,
          error: 'bench-app.html contains references to deprecated coralite-scripts or window.coralite'
        })
      } else {
        checks.push({ name: 'no stale Coralite APIs in bench-app.html', pass: true })
      }
    } catch (err) {
      checks.push({
        name: 'no stale Coralite APIs in bench-app.html',
        pass: false,
        error: `Could not check bench-app.html: ${err.message}`
      })
    }

    const allValid = checks.every(c => c.pass)
    return { valid: allValid, checks }
  },

  submissionInstructions: `
=== jsbenchmarks.com Submission Instructions ===
1. Clone or fork the external harness repository:
   https://github.com/jsbenchmarks/jsbenchmarks.git

2. Copy the local submission directory:
   benchmarks/jsbenchmarks/coralite/  -->  frameworks/coralite/

3. In frameworks/coralite/package.json, update the 'coralite' dependency from workspace:*
   to the published npm version (or link to local build).

4. Build and serve the benchmark locally:
   cd <jsbenchmarks-repo>
   npm i
   npm run serve

5. In a separate terminal, run the benchmark suite:
   npm run bench -- -f coralite

6. Results JSON files will be generated under results/frameworks/coralite.json.
   Save or copy the result into benchmarks/results/external/jsbenchmarks-<date>.json.
`
}

export default adapter

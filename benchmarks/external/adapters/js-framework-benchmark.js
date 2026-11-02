/**
 * js-framework-benchmark adapter for Coralite external benchmark runner.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import http from 'node:http'
import { spawn, spawnSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Polls http://127.0.0.1:8080/index.html until responsive or timeout.
 * @param {number} timeoutMs Maximum wait time in milliseconds
 * @returns {Promise<boolean>} True if server responds OK, false if timed out
 */
function waitForServer (timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get('http://127.0.0.1:8080/index.html', (res) => {
        if (res.statusCode === 200) {
          resolve(true)
        } else if (Date.now() - start < timeoutMs) {
          setTimeout(check, 500)
        } else {
          resolve(false)
        }
      })
      req.on('error', () => {
        if (Date.now() - start < timeoutMs) {
          setTimeout(check, 500)
        } else {
          resolve(false)
        }
      })
      req.end()
    }
    check()
  })
}

/**
 * Helper to run a command synchronously in a working directory.
 * @param {string} cmd Command
 * @param {string[]} args Command arguments
 * @param {string} cwd Working directory
 * @param {Function} log Log callback
 */
function runCmd (cmd, args, cwd, log) {
  log('jfb', `Running: ${cmd} ${args.join(' ')} (in ${cwd})`)
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${path.join(cwd, 'node_modules/.bin')}:${process.env.PATH}`
    }
  })
  if (res.status !== 0) {
    throw new Error(`Command failed with status ${res.status}: ${cmd} ${args.join(' ')}`)
  }
}

const FRAMEWORK_ALIASES = {
  vanilla: 'keyed/vanillajs',
  vanillajs: 'keyed/vanillajs',
  lit: 'keyed/lit',
  react: 'keyed/react-hooks',
  'react-hooks': 'keyed/react-hooks',
  svelte: 'keyed/svelte',
  vue: 'keyed/vue',
  solid: 'keyed/solid',
  coralite: 'keyed/coralite',
  'coralite-opt': 'keyed/coralite-opt'
}

/**
 * Resolves list of frameworks to run for js-framework-benchmark.
 * @returns {string[]} Framework keys
 */
function getSelectedFrameworks () {
  const baseFrameworks = ['keyed/coralite', 'keyed/coralite-opt']
  const comparePreset = ['keyed/vanillajs', 'keyed/lit', 'keyed/react-hooks', 'keyed/svelte']

  const frameworks = [...baseFrameworks]

  if (process.argv.includes('--compare')) {
    for (const fw of comparePreset) {
      if (!frameworks.includes(fw)) {
        frameworks.push(fw)
      }
    }
  }

  const fwArgIdx = process.argv.indexOf('--frameworks')
  if (fwArgIdx !== -1) {
    const trailing = process.argv.slice(fwArgIdx + 1)
    for (const item of trailing) {
      if (item.startsWith('-')) {
        break
      }
      const items = item.split(',').map(s => s.trim()).filter(Boolean)
      for (const f of items) {
        const mapped = FRAMEWORK_ALIASES[f] || (f.startsWith('keyed/') || f.startsWith('non-keyed/') ? f : `keyed/${f}`)
        if (!frameworks.includes(mapped)) {
          frameworks.push(mapped)
        }
      }
    }
  }

  return frameworks
}

const adapter = {
  name: 'jfb',
  repoUrl: 'https://github.com/krausest/js-framework-benchmark.git',

  /**
   * Returns path to cloned directory inside cache dir.
   * @param {string} cacheDir Cache directory path
   * @returns {string} Clone path
   */
  cloneDir: (cacheDir) => path.join(cacheDir, 'js-framework-benchmark'),

  submissionCopies: [
    {
      from: 'benchmarks/js-framework-benchmark/coralite',
      to: 'frameworks/keyed/coralite'
    },
    {
      from: 'benchmarks/js-framework-benchmark/coralite-opt',
      to: 'frameworks/keyed/coralite-opt'
    }
  ],

  /**
   * Installs harness dependencies and builds Coralite benchmark targets.
   * @param {string} cloneDir Clone directory path
   * @param {Function} log Log callback
   */
  install: async (cloneDir, log) => {
    const checkExists = async (p) => fs.stat(p).then(() => true).catch(() => false)

    await fs.mkdir(path.join(cloneDir, 'frameworks/non-keyed'), { recursive: true })

    if (!(await checkExists(path.join(cloneDir, 'node_modules')))) {
      log('jfb', 'Installing top-level dependencies...')
      runCmd('npm', ['install', '--legacy-peer-deps'], cloneDir, log)
    }

    if (!(await checkExists(path.join(cloneDir, 'server/node_modules')))) {
      log('jfb', 'Installing server dependencies...')
      runCmd('npm', ['install', '--legacy-peer-deps'], path.join(cloneDir, 'server'), log)
    }

    if (!(await checkExists(path.join(cloneDir, 'webdriver-ts/node_modules')))) {
      log('jfb', 'Installing webdriver-ts dependencies...')
      runCmd('npm', ['install', '--legacy-peer-deps'], path.join(cloneDir, 'webdriver-ts'), log)
    }

    log('jfb', 'Compiling webdriver-ts...')
    runCmd('npm', ['run', 'compile'], path.join(cloneDir, 'webdriver-ts'), log)

    if (!(await checkExists(path.join(cloneDir, 'webdriver-ts-results/node_modules')))) {
      log('jfb', 'Installing webdriver-ts-results dependencies...')
      runCmd('npm', ['install', '--legacy-peer-deps'], path.join(cloneDir, 'webdriver-ts-results'), log)
    }

    const frameworks = ['frameworks/keyed/coralite', 'frameworks/keyed/coralite-opt']
    for (const fwRel of frameworks) {
      const fwDir = path.join(cloneDir, fwRel)
      log('jfb', `Setting up ${fwRel}...`)

      const nodeModulesDir = path.join(fwDir, 'node_modules')
      const binDir = path.join(nodeModulesDir, '.bin')
      await fs.mkdir(binDir, { recursive: true })

      const coraliteSymlink = path.join(nodeModulesDir, 'coralite')
      const coraliteBinSymlink = path.join(binDir, 'coralite')
      const targetCoralitePkg = path.join(ROOT, 'packages/coralite')
      const targetCoraliteBin = path.join(ROOT, 'packages/coralite/bin/coralite.js')

      await fs.rm(coraliteSymlink, {
        recursive: true,
        force: true
      })
      await fs.rm(coraliteBinSymlink, {
        recursive: true,
        force: true
      })

      await fs.symlink(targetCoralitePkg, coraliteSymlink, 'dir')
      await fs.symlink(targetCoraliteBin, coraliteBinSymlink, 'file')

      log('jfb', `Building ${fwRel}...`)
      const buildScript = `
        process.chdir('${fwDir}');
        import loadConfig from '${path.join(ROOT, 'packages/coralite/lib/cli/load-config.js')}';
        import { buildCommand } from '${path.join(ROOT, 'packages/coralite/lib/cli/commands/build.js')}';
        const config = await loadConfig();
        await buildCommand(config, { clean: true });
      `
      runCmd('node', ['--experimental-vm-modules', '-e', buildScript], fwDir, log)
    }

    const targetFrameworks = getSelectedFrameworks()
    const competitorFrameworks = targetFrameworks.filter(fw => !fw.startsWith('keyed/coralite'))
    if (competitorFrameworks.length > 0) {
      log('jfb', `Setting up comparator frameworks: ${competitorFrameworks.join(', ')}...`)
      const rebuildScript = `
        import { rebuildFrameworks } from './cli/rebuild-build-single.js';
        const ok = rebuildFrameworks(process.argv.slice(1), true);
        if (!ok) process.exit(1);
      `
      runCmd('node', ['-e', rebuildScript, ...competitorFrameworks], cloneDir, log)
    }
  },

  /**
   * Executes benchmark targets and extracts results.
   * @param {string} cloneDir Clone directory path
   * @param {Function} log Log callback
   * @returns {Promise<object>} Parsed benchmark results
   */
  run: async (cloneDir, log) => {
    log('jfb', 'Starting local server...')
    try {
      execSync('kill $(lsof -t -iTCP:8080 -sTCP:LISTEN) 2>/dev/null || true')
    } catch {
      // Ignore if no process was running
    }

    const serverProc = spawn('npm', ['start'], {
      cwd: cloneDir,
      stdio: 'inherit'
    })

    const ready = await waitForServer(30000)
    if (!ready) {
      serverProc.kill()
      throw new Error('Local web server failed to start on port 8080 within 30 seconds.')
    }
    log('jfb', 'Local server started successfully on port 8080.')

    try {
      const targetFrameworks = getSelectedFrameworks()
      log('jfb', `Running benchmark suite for: ${targetFrameworks.join(', ')}...`)
      const possibleChromePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium'
      ]
      let chromeBinary
      for (const p of possibleChromePaths) {
        if (await fs.stat(p).then(() => true).catch(() => false)) {
          chromeBinary = p
          break
        }
      }

      const runnerArgs = [
        'dist/benchmarkRunner.js',
        '--runner',
        'playwright',
        '--headless',
        'true'
      ]
      if (chromeBinary) {
        runnerArgs.push('--chromeBinary', chromeBinary)
      }
      runnerArgs.push('--framework', ...targetFrameworks)

      if (!process.argv.includes('--full')) {
        runnerArgs.push('--smoketest', 'true')
      }

      const benchArgIdx = process.argv.indexOf('--benchmark')
      if (benchArgIdx !== -1 && process.argv[benchArgIdx + 1]) {
        runnerArgs.push('--benchmark', ...process.argv.slice(benchArgIdx + 1).filter(a => !a.startsWith('--')))
      } else {
        runnerArgs.push('--benchmark', '01_', '02_', '03_', '04_', '05_', '07_', '08_', '09_', '21_')
      }

      runCmd(
        'node',
        runnerArgs,
        path.join(cloneDir, 'webdriver-ts'),
        log
      )

      log('jfb', 'Generating aggregated results JSON...')
      runCmd('npm', ['run', 'results'], path.join(cloneDir, 'webdriver-ts'), log)

      const resultsJsonPath = path.join(cloneDir, 'webdriver-ts/results.json')
      const exists = await fs.stat(resultsJsonPath).then(() => true).catch(() => false)

      let rawResults = []
      if (exists) {
        const content = await fs.readFile(resultsJsonPath, 'utf8')
        rawResults = JSON.parse(content)
      } else {
        log('jfb', 'Warning: results.json not found, reading raw files from webdriver-ts/results/')
        const resultsDir = path.join(cloneDir, 'webdriver-ts/results')
        const files = await fs.readdir(resultsDir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            const fileContent = await fs.readFile(path.join(resultsDir, file), 'utf8')
            rawResults.push(JSON.parse(fileContent))
          }
        }
      }

      return {
        adapter: 'jfb',
        timestamp: new Date().toISOString(),
        frameworks: targetFrameworks,
        results: rawResults
      }
    } finally {
      log('jfb', 'Stopping local server...')
      serverProc.kill()
      try {
        execSync('kill $(lsof -t -iTCP:8080 -sTCP:LISTEN) 2>/dev/null || true')
      } catch {
        // Ignore
      }
    }
  },

  /**
   * Prints formatted summary table of benchmark results.
   * @param {object} results Benchmark run results
   * @param {Function} log Log callback
   */
  printSummary: (results, log) => {
    if (!results || !Array.isArray(results.results) || results.results.length === 0) {
      log('jfb', 'Note: Smoketest completed with no recorded numerical metrics.')
      log('jfb', 'Run with --full to record complete comparative metrics (e.g. pnpm bench:external jfb --compare --full).')
      return
    }

    log('jfb', '\n=== Framework Reactivity Comparison Summary ===\n')

    const benchmarks = [...new Set(results.results.map(r => r.benchmark))]

    for (const benchId of benchmarks) {
      const entries = results.results.filter(r => r.benchmark === benchId)
      log('jfb', `Benchmark: ${benchId}`)

      const coraliteEntry = entries.find(e => e.framework.includes('coralite-v') || e.framework === 'coralite-keyed')
      const coraliteTotal = coraliteEntry?.values?.total?.median || 0

      const rows = entries.map(e => {
        const total = e.values?.total?.median !== undefined ? `${e.values.total.median} ms` : 'N/A'
        const script = e.values?.script?.median !== undefined ? `${e.values.script.median} ms` : 'N/A'
        const paint = e.values?.paint?.median !== undefined ? `${e.values.paint.median} ms` : 'N/A'

        let vsCoralite = '-'
        if (coraliteTotal > 0 && e.values?.total?.median) {
          const ratio = (e.values.total.median / coraliteTotal).toFixed(2)
          vsCoralite = e === coraliteEntry ? '1.00x (baseline)' : `${ratio}x`
        }

        return {
          Framework: e.framework,
          'Total (median)': total,
          'Script (median)': script,
          'Paint (median)': paint,
          'vs Coralite': vsCoralite
        }
      })

      console.table(rows)
    }
  },

  /**
   * Optional cleanup function.
   * @param {string} cloneDir Clone directory path
   * @param {Function} log Log callback
   */
  cleanup: async (cloneDir, log) => {
    log('jfb', 'Cleanup complete.')
  }
}

export default adapter

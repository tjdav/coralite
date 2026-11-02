/**
 * lumeland-benchmark adapter for Coralite external benchmark runner.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

/**
 * Resolves the path to the Deno binary.
 * @returns {string} Path or executable name for Deno
 */
function getDenoBinary () {
  const homeDeno = path.join(process.env.HOME || '', '.deno/bin/deno')
  if (spawnSync(homeDeno, ['--version'], { encoding: 'utf8' }).status === 0) {
    return homeDeno
  }
  if (spawnSync('deno', ['--version'], { encoding: 'utf8' }).status === 0) {
    return 'deno'
  }
  throw new Error('Deno executable not found in PATH or ~/.deno/bin/deno')
}

/**
 * Resolves list of SSGs to run in lumeland harness.
 * @returns {string[]} List of enabled SSG names
 */
function getSelectedSSGs () {
  const ssgs = ['coralite']
  const isCompare = process.argv.includes('--compare')

  const fwArgIdx = process.argv.indexOf('--frameworks')
  const ssgsArgIdx = process.argv.indexOf('--ssgs')
  const explicitArgs = []

  let targetIdx = -1
  if (fwArgIdx !== -1) {
    targetIdx = fwArgIdx
  } else if (ssgsArgIdx !== -1) {
    targetIdx = ssgsArgIdx
  }

  if (targetIdx !== -1) {
    const trailing = process.argv.slice(targetIdx + 1)
    for (const item of trailing) {
      if (item.startsWith('-')) {
        break
      }
      const items = item.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      explicitArgs.push(...items)
    }
  }

  const shouldInclude = (name) => {
    return isCompare || explicitArgs.includes(name)
  }

  if (shouldInclude('eleventy') && !ssgs.includes('eleventy')) {
    ssgs.push('eleventy')
  }

  const hasHugo = spawnSync('hugo', ['version'], { stdio: 'ignore' }).status === 0
  if (hasHugo && shouldInclude('hugo') && !ssgs.includes('hugo')) {
    ssgs.push('hugo')
  }

  const hasLume = spawnSync('lume', ['--version'], { stdio: 'ignore' }).status === 0
  if (hasLume && shouldInclude('lume') && !ssgs.includes('lume')) {
    ssgs.push('lume')
  }

  return ssgs
}

const adapter = {
  name: 'lumeland',
  repoUrl: 'https://github.com/lumeland/benchmark.git',

  /**
   * Returns path to cloned directory inside cache dir.
   * @param {string} cacheDir Cache directory path
   * @returns {string} Clone path
   */
  cloneDir: (cacheDir) => path.join(cacheDir, 'lumeland-benchmark'),

  submissionCopies: [
    {
      from: 'benchmarks/lumeland-benchmark/coralite',
      to: 'ssg/coralite'
    }
  ],

  /**
   * Installs harness dependencies and sets up Coralite target in lumeland harness.
   * @param {string} cloneDir Clone directory path
   * @param {Function} log Log callback
   */
  install: async (cloneDir, log) => {
    const fwDir = path.join(cloneDir, 'ssg/coralite')
    log('lumeland', `Setting up ${fwDir}...`)

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

    const selectedSSGs = getSelectedSSGs()
    if (selectedSSGs.includes('eleventy')) {
      const eleventyDir = path.join(cloneDir, 'ssg/eleventy')
      const eleventyModules = path.join(eleventyDir, 'node_modules')
      const modulesExist = await fs.stat(eleventyModules).then(() => true).catch(() => false)
      if (!modulesExist) {
        log('lumeland', 'Installing eleventy dependencies...')
        const res = spawnSync('npm', ['install'], {
          cwd: eleventyDir,
          stdio: 'inherit',
          encoding: 'utf8'
        })
        if (res.status !== 0) {
          throw new Error('Failed to install eleventy dependencies')
        }
      }
    }

    log('lumeland', `Writing benchmark config.js for SSGs: ${selectedSSGs.join(', ')}...`)
    const configJsPath = path.join(cloneDir, 'config.js')
    const runnerBlocks = []

    if (selectedSSGs.includes('coralite')) {
      runnerBlocks.push(`runners.add(
  new Runner({
    name: "coralite",
    build: ["npm", "run", "build-prod"],
    content: "content",
    output: "dist",
  }),
);`)
    }

    if (selectedSSGs.includes('eleventy')) {
      runnerBlocks.push(`runners.add(
  new Runner({
    name: "eleventy",
    build: ["npx", "eleventy", "--quiet"],
    content: "pages",
    output: "_site",
  }),
);`)
    }

    if (selectedSSGs.includes('hugo')) {
      runnerBlocks.push(`runners.add(
  new Runner({
    name: "hugo",
    build: ["hugo", "-D"],
    content: "content/pages",
    output: "public",
  }),
);`)
    }

    if (selectedSSGs.includes('lume')) {
      runnerBlocks.push(`runners.add(
  new Runner({
    name: "lume",
    build: ["lume"],
    content: "pages",
    output: "_site",
  }),
);`)
    }

    const configContent = `import Runner from "./lib/runner.js";

const runners = new Set();

${runnerBlocks.join('\n\n')}

export default runners;
`
    await fs.writeFile(configJsPath, configContent, 'utf8')
  },

  /**
   * Executes benchmark targets and extracts results.
   * @param {string} cloneDir Clone directory path
   * @param {Function} log Log callback
   * @returns {Promise<object>} Parsed benchmark results
   */
  run: async (cloneDir, log) => {
    const denoBin = getDenoBinary()
    log('lumeland', `Using Deno binary at: ${denoBin}`)

    const denoArgs = ['run', '--unstable', '-A', 'cli.js']

    const pagesIdx = process.argv.indexOf('--pages')
    if (pagesIdx !== -1 && process.argv[pagesIdx + 1]) {
      denoArgs.push('--pages', process.argv[pagesIdx + 1])
    }

    const runsIdx = process.argv.indexOf('--runs')
    if (runsIdx !== -1 && process.argv[runsIdx + 1]) {
      denoArgs.push('--runs', process.argv[runsIdx + 1])
    }

    log('lumeland', `Running benchmark command: ${denoBin} ${denoArgs.join(' ')}`)

    const eleventyBin = path.join(cloneDir, 'ssg/eleventy/node_modules/.bin')
    const pathEnv = `${path.dirname(denoBin)}:${eleventyBin}:${process.env.PATH || ''}`
    const res = spawnSync(denoBin, denoArgs, {
      cwd: cloneDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: pathEnv
      }
    })

    if (res.status !== 0) {
      throw new Error(`Deno benchmark failed with exit code ${res.status}: ${res.stderr || res.stdout}`)
    }

    const stdout = res.stdout || ''
    log('lumeland', stdout)

    let pages = 1000
    let runs = 10
    const pagesMatch = stdout.match(/SITES WITH (\d+) PAGES:/i)
    if (pagesMatch) {
      pages = parseInt(pagesMatch[1], 10)
    }
    const runsMatch = stdout.match(/\((\d+) runs\)/i)
    if (runsMatch) {
      runs = parseInt(runsMatch[1], 10)
    }

    const results = []
    const tableRowRegex = /│\s*\d+\s*│\s*"?(.*?)"?\s*│\s*([\d\.]+)\s*│/g
    let match
    while ((match = tableRowRegex.exec(stdout)) !== null) {
      const name = match[1].trim()
      const seconds = parseFloat(match[2])
      if (name && !isNaN(seconds) && name !== 'name') {
        results.push({
          name,
          seconds
        })
      }
    }

    if (results.length === 0) {
      const avgMatch = stdout.match(/(\d+)\s*runs avg:\s*([\d\.]+)ms/i)
      if (avgMatch) {
        results.push({
          name: 'coralite',
          seconds: Math.round(parseFloat(avgMatch[2])) / 1000
        })
      }
    }

    return {
      adapter: 'lumeland',
      timestamp: new Date().toISOString(),
      pages,
      runs,
      results
    }
  },

  /**
   * Prints formatted summary table of SSG build results.
   * @param {object} results Benchmark run results
   * @param {Function} log Log callback
   */
  printSummary: (results, log) => {
    if (!results || !Array.isArray(results.results) || results.results.length === 0) {
      return
    }

    log('lumeland', `\n=== SSG Build Time Comparison Summary (${results.pages} pages, ${results.runs} runs) ===\n`)
    const coraliteEntry = results.results.find(r => r.name === 'coralite')
    const coraliteSec = coraliteEntry?.seconds || 0

    const rows = results.results.map(r => {
      let vsCoralite = '-'
      if (coraliteSec > 0 && r.seconds > 0) {
        const ratio = (r.seconds / coraliteSec).toFixed(2)
        vsCoralite = r.name === 'coralite' ? '1.00x (baseline)' : `${ratio}x`
      }

      return {
        Generator: r.name,
        'Build Time (seconds)': `${r.seconds}s`,
        'vs Coralite': vsCoralite
      }
    })

    console.table(rows)
  },

  /**
   * Optional cleanup function.
   * @param {string} cloneDir Clone directory path
   * @param {Function} log Log callback
   */
  cleanup: async (cloneDir, log) => {
    log('lumeland', 'Cleanup complete.')
  }
}

export default adapter

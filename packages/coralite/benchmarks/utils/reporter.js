import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_RESULTS_PATH = path.resolve(__dirname, '../results/latest.json')

/**
 *
 */
export function writeJSONResults (data, outputPath = DEFAULT_RESULTS_PATH) {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 *
 */
export function generateMarkdownTable (suiteName, suiteResults) {
  if (!suiteResults || Object.keys(suiteResults).length === 0) {
    return ''
  }
  const frameworks = Object.keys(suiteResults)
  const metrics = Object.keys(suiteResults[frameworks[0]])

  let md = `### ${suiteName}\n\n`
  md += `| Framework | ${metrics.join(' | ')} |\n`
  md += `| ${'--- | '.repeat(metrics.length + 1).slice(0, -1)}\n`

  for (const fw of frameworks) {
    const row = metrics.map(m => suiteResults[fw][m])
    md += `| ${fw} | ${row.join(' | ')} |\n`
  }
  return md
}

/**
 *
 */
export function printTerminalResults (data) {
  console.log('\n=== Benchmark Results ===\n')
  if (!data || !data.suites) {
    console.log('No suite results available.')
    return
  }
  for (const [suiteName, suiteResults] of Object.entries(data.suites)) {
    console.log(`Suite: ${suiteName}`)
    console.table(suiteResults)
    console.log('')
  }
}

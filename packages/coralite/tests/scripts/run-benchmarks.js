import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const benchmarksDir = join(__dirname, '../../benchmarks')

const files = readdirSync(benchmarksDir).filter(f => f.endsWith('.js') && statSync(join(benchmarksDir, f)).isFile())

console.log(`Found ${files.length} benchmark files.`)

for (const file of files) {
  const filepath = join(benchmarksDir, file)
  console.log(`\n======================================================`)
  console.log(`Running benchmark: ${file}`)
  console.log(`======================================================\n`)
  try {
    execSync(`node --experimental-vm-modules ${filepath}`, { stdio: 'inherit' })
  } catch (err) {
    console.error(`Error running ${file}:`, err.message)
  }
}

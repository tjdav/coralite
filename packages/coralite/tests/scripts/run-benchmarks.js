import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import { program } from 'commander'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const benchmarksDir = join(__dirname, '../../benchmarks')

program
  .name('run-benchmarks')
  .description('Run Coralite benchmarks')
  .argument('[benchmarks...]', 'Benchmark names to run (without extension)')
  .parse()

const selectedBenchmarks = program.args

let files = readdirSync(benchmarksDir).filter(f => f.endsWith('.js') && statSync(join(benchmarksDir, f)).isFile())

if (selectedBenchmarks.length > 0) {
  files = files.filter(f => selectedBenchmarks.includes(parse(f).name))

  if (files.length === 0) {
    console.error(`Error: No benchmarks found matching: ${selectedBenchmarks.join(', ')}`)
    process.exit(1)
  }
}

console.log(`Found ${files.length} benchmark file(s).`)

for (const file of files) {
  const filepath = join(benchmarksDir, file)
  console.log(`\n======================================================`)
  console.log(`Running benchmark: ${file}`)
  console.log(`======================================================\n`)
  try {
    execSync(`node --experimental-vm-modules --expose-gc ${filepath}`, { stdio: 'inherit' })
  } catch (err) {
    console.error(`Error running ${file}:`, err.message)
  }
}

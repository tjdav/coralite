import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

console.log('🚀 Running create-coralite template E2E test suite...')

try {
  execSync('pnpm --filter create-coralite test:e2e', {
    cwd: resolve(process.cwd()),
    stdio: 'inherit'
  })
  console.log('\n✅ create-coralite E2E test passed successfully!')
} catch (error) {
  console.error('\n❌ create-coralite E2E test failed!', error.message)
  process.exit(1)
}

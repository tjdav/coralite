import { createCoralite } from '../../lib/index.js'

const coralite = await createCoralite({
  components: 'tests/fixtures/testing-app/components',
  pages: 'tests/fixtures/testing-app/pages',
  output: '.coralite-testing',
  mode: 'testing',
  testing: {
    mocks: {
      'mocking-test': {
        server: async () => ({
          data: 'MOCKED DATA'
        })
      }
    }
  },
  onError: (error) => {
    console.log(`[CORALITE-${error.level}]: ${error.message}`)
    if (error.level === 'ERR') {
      throw new Error(`[CORALITE-ERR]: ${error.message}`)
    }
  }
})

try {
  await coralite.save()
  console.log(`Coralite testing build HTML complete (mode: testing, output: .coralite-testing)`)
} catch (error) {
  console.error(error)
  process.exit(1)
}

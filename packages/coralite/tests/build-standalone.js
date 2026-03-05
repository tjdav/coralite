import Coralite from '../lib/index.js'

async function run () {
  const coralite = new Coralite({
    components: './tests/components',
    pages: './tests/pages',
    standaloneOutput: './tests/standalone'
  })

  await coralite.initialise()
  const res = await coralite.save('./tests/dist')
  console.log('Build complete', res)
}

run().catch(console.error)

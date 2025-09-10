import Coralite from 'coralite'

/**
 * @import {CoraliteScriptConfig} from '#types'
 * @import {CoraliteResult} from 'coralite/types'
 */

/**
 * @param {CoraliteScriptConfig} config
 * @returns {Promise<CoraliteResult[]>}
 */
async function buildHTML (config) {
  // start coralite
  const coralite = new Coralite({
    templates: config.templates,
    pages: config.pages,
    plugins: config.plugins
  })
  await coralite.initialise()

  // compile website
  const documents = await coralite.compile()

  // save documents
  await coralite.save(documents, config.output)

  return documents
}

export default buildHTML

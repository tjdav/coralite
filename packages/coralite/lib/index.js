import { createCoralite } from './coralite.js'

export * from '../types/index.js'
export * from './utils/index.js'
export * from './utils/server/index.js'
export * from './analyser.js'
export * from './plugin.js'
export * from './config.js'

/** @typedef {import('../types/core.js').CoraliteInstance} Coralite */

export { createCoralite }
export default createCoralite


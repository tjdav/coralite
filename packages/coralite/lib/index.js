import { createCoralite } from './server/create.js'

export * from '../types/index.js'
export * from './shared/index.js'
export * from './server/utils/index.js'
export * from './client/utils/index.js'
export * from './server/component/validator.js'
export * from './server/component/fixer.js'
export * from './server/plugin/validator.js'
export * from './server/plugin/fixer.js'
export * from './server/page/validator.js'
export * from './server/page/fixer.js'
export * from './server/plugin/define.js'
export * from './server/config.js'
export * from './server/routes/build-table.js'
export * from './server/routes/match.js'

/** @typedef {import('../types/core.js').CoraliteInstance} Coralite */

export { createCoralite }
export default createCoralite

import { definePlugin } from '../../../lib/server/plugin/define.js'

export default definePlugin({
  name: 'rejected-block-plugin',
  unknownOption: 'invalid-block'
})

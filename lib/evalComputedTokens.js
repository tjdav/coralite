import { computedTokens } from './component.js'

function evalComputedTokens (args, props) {
  return new Function(computedTokens + ' return computedTokens.call(this,' + args + ')').call(props)
}

export default evalComputedTokens

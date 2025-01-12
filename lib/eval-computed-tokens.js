import { computedTokens } from './component.js'

async function evalComputedTokens (args, thisArgs) {
  return new Function(computedTokens + ' return computedTokens.call(this,' + args + ')').call(thisArgs)
}

export default evalComputedTokens

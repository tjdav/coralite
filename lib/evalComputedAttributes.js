import { computedAttributes } from './component.js'

export function evalComputedAttributes (args, props) {
  return new Function(computedAttributes + ' return computedAttributes.call(this,' + args + ')').call(props)
}
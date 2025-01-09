/**
 * @param {Object.<string, Function>} computedProps
 */
function defineProps (computedProps) {
  const result = {}

  for (const key in computedProps) {
    if (Object.prototype.hasOwnProperty.call(computedProps, key)) {
      result[key] = computedProps[key].call(this)
    }
  }
  
  return result
}

export default defineProps
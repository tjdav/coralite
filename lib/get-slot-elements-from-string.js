const slotElementRegExp = /<slot\s*(?<attribute>[\s\S]*?)>(?<content>[\s\S]*?)<\/slot>/gi
const slotNameRegExp = /(name+\b\s*)(?:=(?<name>\s*(?<quotes>'|")[\s\S]*?\3))?/gi

/**
 * @import { CoraliteSlotElement } from '#types'
 */

/**
 * @param {string} string - Content used to extract slot elements
 * @return {CoraliteSlotElement[]}
 */
function getSlotElementsFromString (string) {
  const slotMatches = string.matchAll(slotElementRegExp)
  const slots = []
  const slotsFound = {}

  for (const slotMatch of slotMatches) {
    if (!slotMatch) {
      return slots
    }

    const slot = {
      name: 'default',
      input: slotMatch.input,
      content: slotMatch.groups.content || ''
    }

    if (slotMatch.groups.attribute) {
      const slotName = slotMatch.groups.attribute.matchAll(slotNameRegExp)
      const result = slotName.next().value

      if (result && result.groups.name) {
        let name = result.groups.name.replaceAll(result.groups.quotes, '')
        slot.name = name

        if (slotsFound[name]) {
          console.error('Slot "' + name + ' already exists')
        } else {
          //
          slotsFound[name] = true
          slots.push(slot)
        }
      }
    }

    if (slot.name === 'default' && !slotsFound.default) {
      slotsFound.default = true
      slots.push(slot)
    }
  }

  return slots
}

export default getSlotElementsFromString

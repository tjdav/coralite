const ADJECTIVES = [
  'pretty',
  'large',
  'big',
  'small',
  'tall',
  'short',
  'long',
  'handsome',
  'plain',
  'quaint',
  'clean',
  'elegant',
  'easy',
  'angry',
  'crazy',
  'helpful',
  'mushy',
  'odd',
  'unsightly',
  'adorable',
  'important',
  'inexpensive',
  'cheap',
  'expensive',
  'fancy'
]

const COLOURS = [
  'red',
  'yellow',
  'blue',
  'green',
  'pink',
  'brown',
  'purple',
  'brown',
  'white',
  'black',
  'orange'
]

const NOUNS = [
  'table',
  'chair',
  'house',
  'bbq',
  'desk',
  'car',
  'pony',
  'cookie',
  'sandwich',
  'burger',
  'pizza',
  'mouse',
  'keyboard'
]

function createPRNG (seed = 42) {
  let s = seed >>> 0
  return function random () {
    let t = (s += 0x6D2B79F5) | 0
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let nextId = 1

/**
 *
 */
export function buildData (count = 1000, seed = 42) {
  const random = createPRNG(seed)
  const data = new Array(count)
  for (let i = 0; i < count; i++) {
    const adj = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)]
    const colour = COLOURS[Math.floor(random() * COLOURS.length)]
    const noun = NOUNS[Math.floor(random() * NOUNS.length)]
    data[i] = {
      id: nextId++,
      label: `${adj} ${colour} ${noun}`
    }
  }
  return data
}

/**
 *
 */
export function updateData (data, step = 10) {
  const updated = [...data]
  for (let i = 0; i < updated.length; i += step) {
    updated[i] = {
      ...updated[i],
      label: `${updated[i].label} !!!`
    }
  }
  return updated
}

/**
 *
 */
export function swapRows (data, indexA = 1, indexB = 998) {
  const result = [...data]
  if (result.length > indexA && result.length > indexB) {
    const temp = result[indexA]
    result[indexA] = result[indexB]
    result[indexB] = temp
  }
  return result
}

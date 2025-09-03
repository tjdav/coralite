export const VALID_TAGS = {
  a: true,
  abbr: true,
  acronym: true, // deprecated
  address: true,
  area: true,
  article: true,
  aside: true,
  audio: true,
  b: true,
  base: true,
  bdi: true,
  bdo: true,
  big: true, // deprecated
  blockquote: true,
  body: true,
  br: true,
  button: true,
  canvas: true,
  caption: true,
  center: true, // deprecated
  cite: true,
  code: true,
  col: true,
  colgroup: true,
  data: true,
  datalist: true,
  dd: true,
  del: true,
  details: true,
  dfn: true,
  dialog: true,
  dir: true, // deprecated
  div: true,
  dl: true,
  dt: true,
  em: true,
  embed: true,
  fencedframe: true, // experimental
  fieldset: true,
  figcaption: true,
  figure: true,
  font: true, // deprecated
  footer: true,
  form: true,
  frame: true, // deprecated
  frameset: true, // deprecated
  h1: true,
  h2: true,
  h3: true,
  h4: true,
  h5: true,
  h6: true,
  head: true,
  header: true,
  hgroup: true,
  hr: true,
  html: true,
  i: true,
  iframe: true,
  img: true,
  input: true,
  ins: true,
  kbd: true,
  label: true,
  legend: true,
  li: true,
  link: true,
  main: true,
  map: true,
  mark: true,
  marquee: true, // deprecated
  menu: true,
  meta: true,
  meter: true,
  nav: true,
  nobr: true, // deprecated
  noembed: true, // deprecated
  noframes: true, // deprecated
  noscript: true,
  object: true,
  ol: true,
  optgroup: true,
  option: true,
  output: true,
  p: true,
  param: true, // deprecated
  picture: true,
  plaintext: true, // deprecated
  portal: true, // experimental
  pre: true,
  progress: true,
  q: true,
  rb: true, // deprecated
  rp: true,
  rt: true,
  rtc: true, // deprecated
  ruby: true,
  s: true,
  samp: true,
  script: true,
  search: true,
  section: true,
  select: true,
  slot: true,
  small: true,
  source: true,
  span: true,
  strike: true, // deprecated
  strong: true,
  style: true,
  sub: true,
  summary: true,
  sup: true,
  table: true,
  tbody: true,
  td: true,
  template: true,
  textarea: true,
  tfoot: true,
  th: true,
  thead: true,
  time: true,
  title: true,
  tr: true,
  track: true,
  tt: true, // deprecated
  u: true,
  ul: true,
  var: true,
  video: true,
  wbr: true,
  xmp: true,
  // svg
  svg: true,
  animate: true,
  animatemotion: true,
  animatetransform: true,
  circle: true,
  clippath: true,
  defs: true,
  desc: true,
  ellipse: true,
  feblend: true,
  fecolormatrix: true,
  fecomponenttransfer: true,
  fecomposite: true,
  feconvolvematrix: true,
  fediffuselighting: true,
  fedisplacementmap: true,
  fedistantlight: true,
  fedropshadow: true,
  feflood: true,
  fefunca: true,
  fefuncb: true,
  fefuncg: true,
  fefuncr: true,
  fegaussianblur: true,
  feimage: true,
  femerge: true,
  femergenode: true,
  femorphology: true,
  feoffset: true,
  fepointlight: true,
  fespecularlighting: true,
  fespotlight: true,
  fetile: true,
  feturbulence: true,
  filter: true,
  foreignobject: true,
  g: true,
  image: true,
  line: true,
  lineargradient: true,
  marker: true,
  mask: true,
  metadata: true,
  mpath: true,
  path: true,
  pattern: true,
  polygon: true,
  polyline: true,
  radialgradient: true,
  rect: true,
  set: true,
  stop: true,
  switch: true,
  symbol: true,
  text: true,
  textpath: true,
  tspan: true,
  use: true,
  view: true
}

export const RESERVED_ELEMENT_NAMES = {
  'annotation-xml': true,
  'color-profile': true,
  'font-face': true,
  'font-face-src': true,
  'font-face-uri': true,
  'font-face-format': true,
  'font-face-name': true,
  'missing-glyph': true
}

const CUSTOM_ELEMENT_TAG = /^[a-z](?:[-.\w\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD])*?-(?:[-.\w\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD])*$/

/**
 * Validates a custom element name
 * @param {string} name - The custom element name to validate
 * @param {number} [maxLength=100] - Max length of the tag name
 * @returns {boolean} - True if valid, false otherwise
 * @throws {Error} - If the element name is reserved
 */
export function isValidCustomElementName (name, maxLength = 100) {
  // Check if string is empty or not a string
  if (!name || typeof name !== 'string') {
    return false
  }

  // Check against reserved names first (case-insensitive)
  if (RESERVED_ELEMENT_NAMES[name.toLowerCase()]) {
    throw new Error('Element name is reserved: "'+ name +'"')
  }

  // Length check to prevent ReDoS
  if (name.length > maxLength) {
    return false
  }

  // check for obviously invalid patterns that could cause backtracking
  if (name.includes('--') || name.startsWith('-') || name.endsWith('-')) {
    return false
  }

  // Test against the regex
  return CUSTOM_ELEMENT_TAG.test(name)
}

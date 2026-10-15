export const GLOBAL_ARIA_ATTRIBUTES = new Set([
  'aria-atomic',
  'aria-busy',
  'aria-controls',
  'aria-current',
  'aria-describedby',
  'aria-description',
  'aria-details',
  'aria-disabled',
  'aria-dropeffect',
  'aria-errormessage',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-live',
  'aria-relevant',
  'aria-roledescription'
])

export const ROLE_SUPPORTED_ARIA = {
  button: new Set(['aria-expanded', 'aria-pressed', 'aria-haspopup']),
  link: new Set(['aria-expanded', 'aria-haspopup']),
  checkbox: new Set(['aria-checked', 'aria-readonly', 'aria-required']),
  radio: new Set(['aria-checked', 'aria-required']),
  textbox: new Set(['aria-activedescendant', 'aria-autocomplete', 'aria-multiline', 'aria-placeholder', 'aria-readonly', 'aria-required']),
  combobox: new Set(['aria-activedescendant', 'aria-autocomplete', 'aria-expanded', 'aria-haspopup', 'aria-required', 'aria-orientation']),
  listbox: new Set(['aria-activedescendant', 'aria-multiselectable', 'aria-orientation', 'aria-required']),
  heading: new Set(['aria-level']),
  navigation: new Set([]),
  main: new Set([]),
  banner: new Set([]),
  contentinfo: new Set([]),
  img: new Set(['aria-expanded']),
  dialog: new Set(['aria-modal']),
  alertdialog: new Set(['aria-modal']),
  tab: new Set(['aria-selected', 'aria-controls', 'aria-expanded', 'aria-haspopup']),
  tabpanel: new Set(['aria-labelledby']),
  tablist: new Set(['aria-orientation', 'aria-activedescendant', 'aria-multiselectable']),
  option: new Set(['aria-selected', 'aria-checked', 'aria-posinset', 'aria-setsize']),
  menu: new Set(['aria-activedescendant', 'aria-orientation']),
  menuitem: new Set(['aria-expanded', 'aria-haspopup']),
  menuitemcheckbox: new Set(['aria-checked', 'aria-readonly']),
  menuitemradio: new Set(['aria-checked']),
  switch: new Set(['aria-checked', 'aria-readonly']),
  progressbar: new Set(['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext']),
  slider: new Set(['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext', 'aria-orientation', 'aria-readonly']),
  spinbutton: new Set(['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext', 'aria-readonly', 'aria-required']),
  grid: new Set(['aria-activedescendant', 'aria-colcount', 'aria-multiselectable', 'aria-orientation', 'aria-readonly', 'aria-rowcount']),
  row: new Set(['aria-activedescendant', 'aria-colindex', 'aria-expanded', 'aria-level', 'aria-posinset', 'aria-rowindex', 'aria-selected', 'aria-setsize']),
  gridcell: new Set(['aria-colindex', 'aria-colspan', 'aria-expanded', 'aria-readonly', 'aria-rowindex', 'aria-rowspan', 'aria-selected'])
}

/**
 * Returns implicit WAI-ARIA role for standard HTML element tag and attributes.
 *
 * @param {string} tagName - Element tag name
 * @param {Record<string, string>} [attribs={}] - Normalized lowercase attributes map
 * @returns {string|null} Implicit role name or null
 */
export function getImplicitRole (tagName, attribs = {}) {
  const tag = tagName.toLowerCase()
  if (tag === 'button') {
    return 'button'
  }
  if (tag === 'a') {
    return ('href' in attribs) ? 'link' : null
  }
  if (tag === 'input') {
    const type = (attribs.type || 'text').toLowerCase()
    if (type === 'checkbox') {
      return 'checkbox'
    }
    if (type === 'radio') {
      return 'radio'
    }
    if (['text', 'search', 'tel', 'url', 'email', 'password', 'number'].includes(type)) {
      return 'textbox'
    }
    if (type === 'button' || type === 'submit' || type === 'reset') {
      return 'button'
    }
    return 'textbox'
  }
  if (tag === 'select') {
    return 'combobox'
  }
  if (tag === 'textarea') {
    return 'textbox'
  }
  if (/^h[1-6]$/.test(tag)) {
    return 'heading'
  }
  if (tag === 'nav') {
    return 'navigation'
  }
  if (tag === 'main') {
    return 'main'
  }
  if (tag === 'header') {
    return 'banner'
  }
  if (tag === 'footer') {
    return 'contentinfo'
  }
  if (tag === 'img') {
    return 'img'
  }
  if (tag === 'dialog') {
    return 'dialog'
  }
  if (tag === 'progress') {
    return 'progressbar'
  }
  return null
}

/**
 * Resolves explicit role or implicit role for an element.
 *
 * @param {string} tagName - Element tag name
 * @param {Record<string, string>} [attribs={}] - Normalized lowercase attributes map
 * @returns {string|null} Resolved role name or null
 */
export function getElementRole (tagName, attribs = {}) {
  if (attribs.role) {
    return attribs.role.toLowerCase().trim()
  }
  return getImplicitRole(tagName, attribs)
}

/**
 * Determines if an element tag and attributes represent an interactive control.
 *
 * @param {string} tagName - Element tag name
 * @param {Record<string, string>} [attribs={}] - Normalized lowercase attributes map
 * @returns {boolean} True if element is interactive
 */
export function isInteractiveElement (tagName, attribs = {}) {
  const tag = tagName.toLowerCase()
  if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') {
    return true
  }
  if (tag === 'a') {
    return ('href' in attribs)
  }
  const role = (attribs.role || '').toLowerCase().trim()
  if (role === 'button' || role === 'link') {
    return true
  }
  return false
}

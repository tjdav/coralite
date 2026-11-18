import {
  MagnifierLinearIcon,
  CopyLinearIcon,
  CheckCircleLinearIcon,
  AltArrowDownLinearIcon,
  AltArrowLeftLinearIcon,
  AltArrowRightLinearIcon,
  EarthLinearIcon,
  CodeLinearIcon,
  BookLinearIcon,
  ClockCircleLinearIcon,
  RestartLinearIcon,
  DocumentLinearIcon,
  GalleryLinearIcon,
  CpuLinearIcon,
  HamburgerMenuLinearIcon,
  CloseLinearIcon
} from '@solar-icons/js'

// Solar icons does not contain brand/logo icons like Github. Provide fallback AST for Github:
const GithubLinearIcon = [
  ['path', {
    d: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
    fill: 'currentColor'
  }]
]

export const SOLAR_ICON_MAP = {
  search: MagnifierLinearIcon,
  github: GithubLinearIcon,
  copy: CopyLinearIcon,
  check: { linear: CheckCircleLinearIcon, bold: CheckCircleLinearIcon },
  'chevron-down': AltArrowDownLinearIcon,
  'chevron-left': AltArrowLeftLinearIcon,
  'chevron-right': AltArrowRightLinearIcon,
  web: EarthLinearIcon,
  strictness: CodeLinearIcon,
  education: BookLinearIcon,
  ai: CheckCircleLinearIcon,
  memory: CheckCircleLinearIcon,
  time: ClockCircleLinearIcon,
  swap: RestartLinearIcon,
  doc: DocumentLinearIcon,
  style: GalleryLinearIcon,
  js: CodeLinearIcon,
  ecosystem: CpuLinearIcon,
  'hamburger-menu': HamburgerMenuLinearIcon,
  close: CloseLinearIcon
}

const defaultSvgAttrs = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '24',
  height: '24',
  viewBox: '0 0 24 24',
  fill: 'none',
  'stroke-width': '1.5'
}

function createSvgNode ([tag, attrs, children]) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  if (attrs) {
    for (const key in attrs) {
      el.setAttribute(key, String(attrs[key]))
    }
  }
  if (children && children.length) {
    for (const child of children) {
      el.appendChild(createSvgNode(child))
    }
  }
  return el
}

export function createSvgElement (iconAst, customAttrs = {}) {
  const attrs = { ...defaultSvgAttrs, ...customAttrs }
  return createSvgNode(['svg', attrs, iconAst])
}

/**
 * Renders a Solar icon into a wrapper element.
 *
 * @param {Element | null} [wrapper] - Mount point for the generated SVG.
 * @param {{ name?: string, active?: boolean, size?: number }} [options] - Icon name and rendering options.
 * @returns {void}
 */
export function renderIcon (wrapper, { name, active = false, size = 24 } = {}) {
  if (!wrapper || !name) {
    if (wrapper) wrapper.replaceChildren()
    return
  }

  let iconAst = SOLAR_ICON_MAP[name]
  if (!iconAst) {
    wrapper.replaceChildren()
    return
  }

  if (iconAst && typeof iconAst === 'object' && !Array.isArray(iconAst) && !iconAst.node) {
    iconAst = active ? iconAst.bold : iconAst.linear
  }

  if (!iconAst) {
    wrapper.replaceChildren()
    return
  }

  const sizePx = isNaN(Number(size)) ? size : `${size}px`
  
  const svgEl = createSvgElement(iconAst, {
    class: `solar solar-${name}`,
    style: `width: ${sizePx}; height: ${sizePx};`,
    'aria-hidden': 'true'
  })

  wrapper.replaceChildren(svgEl)
}

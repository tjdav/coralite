import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const WIDTH = 1200
const HEIGHT = 630
const FONT_DIR = join(import.meta.dirname, 'fonts')
const CORAL_DIR = join(import.meta.dirname, 'coral')
const CORAL_FILES = [
  {
    file: 'coral-red.png',
    width: 460,
    height: 493
  },
  {
    file: 'coral-blue.png',
    width: 460,
    height: 356
  },
  {
    file: 'coral-yellow.png',
    width: 460,
    height: 485
  }
]
const LOGO_FILE = join(import.meta.dirname, '..', '..', 'public', 'images', 'logo-icon.svg')

/** @type {Promise<Array<{ name: string, data: Buffer, weight: 400 | 700, style: 'normal' }>> | null} */
let fontsPromise = null

/** @type {Promise<{ logo: string, coral: Array<{ src: string, width: number, height: number }> }> | null} */
let assetsPromise = null

/**
 * Loads the bundled Inter subsets once per process.
 * @returns {Promise<Array<{ name: string, data: Buffer, weight: 400 | 700, style: 'normal' }>>} Satori fonts.
 */
function loadFonts () {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(FONT_DIR, 'inter-400.ttf')),
      readFile(join(FONT_DIR, 'inter-700.ttf'))
    ]).then(([regular, bold]) => [
      {
        name: 'Inter',
        data: regular,
        weight: 400,
        style: 'normal'
      },
      {
        name: 'Inter',
        data: bold,
        weight: 700,
        style: 'normal'
      }
    ])
  }
  return fontsPromise
}

/**
 * Converts a file to a data URI satori can embed.
 * @param {string} file - Absolute path.
 * @param {string} mime - MIME type.
 * @returns {Promise<string>} Data URI.
 */
async function dataUri (file, mime) {
  const data = await readFile(file)
  return `data:${mime};base64,${data.toString('base64')}`
}

/**
 * Loads the logo and coral cut-outs once per process.
 * @returns {Promise<{ logo: string, coral: Array<{ src: string, width: number, height: number }> }>} Data URIs.
 */
function loadAssets () {
  if (!assetsPromise) {
    assetsPromise = Promise.all([
      dataUri(LOGO_FILE, 'image/svg+xml'),
      Promise.all(CORAL_FILES.map(async entry => ({
        src: await dataUri(join(CORAL_DIR, entry.file), 'image/png'),
        width: entry.width,
        height: entry.height
      })))
    ]).then(([logo, coral]) => ({
      logo,
      coral
    }))
  }
  return assetsPromise
}

/**
 * Picks a coral for a post, stable across builds.
 * @param {string} slug - Post slug.
 * @returns {number} Index into the coral list.
 */
function coralIndex (slug) {
  let hash = 0
  for (const character of slug) {
    hash = ((hash * 31) + character.charCodeAt(0)) >>> 0
  }
  return hash % CORAL_FILES.length
}

/**
 * Formats an ISO date for the image footer.
 * @param {string} value - ISO date or date-time string.
 * @returns {string} Long-form date, or the input when unparseable.
 */
function formatDate (value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Picks a title size that keeps long headlines inside the card.
 * @param {string} title - Post title.
 * @returns {number} Font size in pixels.
 */
function titleSize (title) {
  if (title.length > 110) {
    return 46
  }
  if (title.length > 80) {
    return 52
  }
  if (title.length > 50) {
    return 60
  }
  return 68
}

/**
 * Builds the satori element tree for an Open Graph card.
 * @param {{ title: string, section: string, author: string, date: string, logo: string, coral: { src: string, width: number, height: number } }} data - Card content.
 * @returns {object} Satori root element.
 */
function template ({ title, section, author, date, logo, coral }) {
  const shortened = title.length > 150 ? `${title.slice(0, 147).trimEnd()}…` : title
  const coralWidth = 430
  const coralHeight = Math.round((coralWidth * coral.height) / coral.width)

  return {
    type: 'div',
    props: {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        padding: '64px 72px 56px',
        overflow: 'hidden',
        fontFamily: 'Inter',
        backgroundColor: '#0b0f19'
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              inset: '0',
              backgroundImage: 'linear-gradient(225deg, rgba(139, 92, 246, 0.28) 0%, rgba(11, 15, 25, 0) 52%), linear-gradient(115deg, rgba(6, 182, 212, 0.12) 0%, rgba(11, 15, 25, 0) 40%)'
            }
          }
        },
        {
          type: 'img',
          props: {
            src: coral.src,
            style: {
              position: 'absolute',
              right: '-70px',
              bottom: '-30px',
              width: `${coralWidth}px`,
              height: `${coralHeight}px`,
              opacity: 0.38
            }
          }
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              inset: '0',
              backgroundImage: 'linear-gradient(0deg, rgba(11, 15, 25, 0.92) 0%, rgba(11, 15, 25, 0) 52%)'
            }
          }
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '56px'
            },
            children: [
              {
                type: 'img',
                props: {
                  src: logo,
                  style: {
                    width: '46px',
                    height: '54px'
                  }
                }
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '30px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#f8fafc'
                  },
                  children: 'Coralite'
                }
              }
            ]
          }
        },
        {
          type: 'div',
          props: {
            style: {
              marginBottom: '26px',
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: '#06b6d4'
            },
            children: section
          }
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexGrow: 1,
              alignItems: 'flex-start'
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    maxWidth: '980px',
                    fontSize: `${titleSize(shortened)}px`,
                    fontWeight: 700,
                    lineHeight: 1.12,
                    letterSpacing: '-0.02em',
                    color: '#f8fafc'
                  },
                  children: shortened
                }
              }
            ]
          }
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '24px',
              color: '#94a3b8'
            },
            children: [
              {
                type: 'div',
                props: {
                  children: `${author} · ${formatDate(date)}`
                }
              },
              {
                type: 'div',
                props: {
                  style: {
                    color: '#a78bfa'
                  },
                  children: 'coralite.dev'
                }
              }
            ]
          }
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: '0',
              right: '0',
              bottom: '0',
              height: '8px',
              backgroundImage: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)'
            }
          }
        }
      ]
    }
  }
}

/**
 * Renders a 1200x630 Open Graph image.
 * @param {{ title: string, slug?: string, section?: string, author?: string, date?: string }} data - Card content.
 * @returns {Promise<Buffer>} PNG bytes.
 */
export async function renderOgImage (data) {
  const [fonts, assets] = await Promise.all([loadFonts(), loadAssets()])
  const coral = assets.coral[coralIndex(data.slug || data.title)]

  const svg = await satori(template({
    title: data.title,
    section: data.section || 'Blog',
    author: data.author || 'Thomas David',
    date: data.date || new Date().toISOString(),
    logo: assets.logo,
    coral
  }), {
    width: WIDTH,
    height: HEIGHT,
    fonts
  })

  const png = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: WIDTH
    }
  }).render().asPng()

  return png
}

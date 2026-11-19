import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const WIDTH = 1200
const HEIGHT = 630
const FONT_DIR = join(import.meta.dirname, 'fonts')

/** @type {Promise<Array<{ name: string, data: Buffer, weight: 400 | 700, style: 'normal' }>> | null} */
let fontsPromise = null

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
 * @param {{ title: string, section: string, author: string, date: string }} data - Card content.
 * @returns {object} Satori root element.
 */
function template ({ title, section, author, date }) {
  const shortened = title.length > 150 ? `${title.slice(0, 147).trimEnd()}…` : title

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
                type: 'div',
                props: {
                  style: {
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    backgroundImage: 'linear-gradient(135deg, #8b5cf6, #06b6d4)'
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
 * @param {{ title: string, section?: string, author?: string, date?: string }} data - Card content.
 * @returns {Promise<Buffer>} PNG bytes.
 */
export async function renderOgImage (data) {
  const svg = await satori(template({
    title: data.title,
    section: data.section || 'Blog',
    author: data.author || 'Thomas David',
    date: data.date || new Date().toISOString()
  }), {
    width: WIDTH,
    height: HEIGHT,
    fonts: await loadFonts()
  })

  const png = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: WIDTH
    }
  }).render().asPng()

  return png
}

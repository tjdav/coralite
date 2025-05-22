import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { Parser } from 'htmlparser2'
import render from 'dom-serializer'
import {
  getHtmlFile,
  getHtmlFiles,
  createElement,
  createTextNode,
  parseHTMLMeta,
  createPlugin
} from '#lib'

/**
 * @import {
 *  HTMLData,
 *  CoraliteDocument,
 *  CoraliteAggregate,
 *  CoraliteAnyNode,
 *  CoraliteContentNode,
 *  CoraliteDocumentRoot,
 CoraliteElement} from '#types'
 */

/**
 * @typedef {Object} Aggregation
 * @property {CoraliteAnyNode[]} nodes - An array of CoraliteAnyNode objects representing the aggregated content nodes.
 * @property {HTMLData[]} [documents] - Optional array of HTMLData objects representing the documents associated with this aggregation.
 */


export const aggregation = createPlugin({
  name: 'aggregation',
  /**
   * Aggregates HTML content from specified paths into a single collection of components.
   *
   * @param {CoraliteAggregate} options - Configuration object defining the aggregation behavior
   *
   * @returns {Promise.<Aggregation>} Array of processed content nodes from aggregated documents
   * @throws {Error} If pages directory path is undefined or aggregate path doesn't exist
   *
   * @example
   * ```javascript
   * // Aggregating content from pages under 'components' directory into a component with id 'my-component'
   * aggregate({
   *   path: 'button',
   *   recursive: true,
   *   template: 'my-component'
   * }, {
   *   className: 'btn'
   * }, components, document);
   * ```
   */
  async method (options, { values, document, module, path }) {
    let optionPath = options.path
    const dirname = join(path.pages, optionPath)

    if (!existsSync(dirname)) {
      /** @TODO Refer to documentation */
      throw new Error('Aggregate path does not exist: "' + dirname + '"')
    }

    let templateId

    // Determine template component ID from configuration
    if (typeof options.template === 'string') {
      templateId = options.template
    } else if (typeof options.template === 'object') {
      templateId = options.template.item
    }

    if (!templateId) {
      /** @TODO Refer to documentation */
      throw new Error('Aggregate template was undefined')
    }

    optionPath

    if (optionPath[0] !== '/') {
      optionPath = '/' + optionPath
    }

    let pages = this.pages.getListByPath(optionPath)

    if (!pages.length) {
      // Retrieve HTML pages from specified path
      const collection = await getHtmlFiles({
        type: 'page',
        path: dirname
      })

      if (!collection.list.length) {
        throw new Error('Aggregation found no documents in "' + dirname + '"')
      }

      pages = collection.list
    }

    let result = []
    let startIndex = 0
    let endIndex = pages.length
    let paginationOffset

    if (options.pagination) {
      const token = options.pagination.token

      if (!token) {
        throw new Error('Pagination missing token value')
      }

      // @ts-ignore
      paginationOffset = values.paginationOffset
    }

    // Sort results based on custom sort function, if provided
    if (typeof options.sort === 'function') {
      pages.sort((a, b) => {
        const metaA = parseHTMLMeta(a.content)
        const metaB = parseHTMLMeta(b.content)

        return options.sort(metaA, metaB)
      })
    }

    if (typeof options.filter === 'function') {
      const filteredPages = []

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]
        const meta = parseHTMLMeta(page.content)
        let keepItem = false

        // Process metadata and populate token values for rendering
        for (const key in meta) {
          if (Object.prototype.hasOwnProperty.call(meta, key)) {
            const data = meta[key]

            if (Array.isArray(data)) {
              for (let i = 0; i < data.length; i++) {

                if (!keepItem) {
                  keepItem = options.filter(data[i])
                }
              }
            } else {
              // Handle single metadata item
              if (!keepItem) {
                keepItem = options.filter({
                  name: key,
                  content: data
                })
              }
            }
          }
        }

        if (keepItem) {
          filteredPages.push(page)
        }

      }

      pages = filteredPages
      endIndex = pages.length
    }

    // Apply page offset
    if (Object.prototype.hasOwnProperty.call(options, 'offset') || paginationOffset != null) {
      let offset = paginationOffset || options.offset

      if (!Array.isArray(offset)) {
        if (typeof offset === 'string') {
          offset = parseInt(offset)
        }

        if (offset > endIndex) {
          startIndex = endIndex
        } else {
          startIndex = offset
        }
      }
    }

    // Apply page limit
    if (options.limit) {
      if (!Array.isArray(options.limit)) {
        let limit = options.limit

        if (typeof limit === 'string') {
          limit = parseInt(limit)
        }

        limit += startIndex

        if (limit < endIndex) {
          endIndex = limit
        }
      }
    }

    for (let i = startIndex; i < endIndex; i++) {
      const page = pages[i]

      if (page.path.filename !== document.path.filename) {
        const meta = parseHTMLMeta(page.content)
        const pageValues = Object.assign({
          $pathname: page.path.pathname,
          $filename: page.path.filename,
          $dirname: page.path.dirname
        }, values)
        let prefix = '$'

        // Process metadata and populate token values for rendering
        for (const key in meta) {
          if (Object.prototype.hasOwnProperty.call(meta, key)) {
            const data = meta[key]
            const content = []

            if (Array.isArray(data)) {
              let prefixName
              // Handle multiple metadata items as list
              for (let i = 0; i < data.length; i++) {
                const item = data[i]
                let name = prefix + item.name
                let suffix = ''
                prefixName = name

                suffix = '_' + i

                if (i === 0) {
                  pageValues[name] = item.content
                }

                pageValues[name + suffix] = item.content

                content.push(item.content)
              }

              if (prefixName) {
                pageValues[prefixName + '_list'] = content
              }
            } else {
              pageValues[prefix + key] = data
            }
          }
        }

        // Render component with current values and add to results
        const component = await this.createComponent({
          id: templateId,
          values: pageValues,
          document
        })

        if (typeof component === 'object') {
          // concat rendered components
          result = result.concat(component.children)
        }
      }
    }

    if (options.pagination) {
      const pagination = options.pagination
      const token = pagination.token

      if (!values[token + 'PaginationProcessed']) {
        const path = document.path
        const paginationTotal = pages.length.toString()
        // -2 because we excluded the current document
        const paginationLength = Math.floor((pages.length - 2) / endIndex)
        const nameSplit = document.path.filename.split('.')
        const length = nameSplit.length - 1
        let name = ''

        for (let i = 0; i < length; i++) {
          name += nameSplit[i]
        }

        if (name === 'index') {
          name = ''
        }

        const dirname = join(document.path.dirname, name, pagination.path)
        const rawHTML = await getHtmlFile(document.path.pageName)

        values = Object.assign(values, {
          paginationOffset: endIndex.toString(),
          paginationIndex: path.pathname,
          paginationDirname: dirname,
          paginationPathname: path.pathname,
          paginationTotal: paginationTotal,
          paginationCurrent: path.filename
        })

        for (let i = 0; i < paginationLength; i++) {
          const filename = i + 2 + '.html'
          const pathname = join(dirname, filename)
          const index = i + 1
          const root = parsePagination(rawHTML, {
            template: module.id,
            attributes: {
              [token + '-pagination-processed']: 'true',
              'pagination-offset': (endIndex * index).toString(),
              'pagination-index': path.pathname,
              'pagination-dirname': dirname,
              'pagination-pathname': pathname,
              'pagination-total': paginationTotal,
              'pagination-current': index.toString()
            }
          })
          const content = render(root)

          this.addRenderQueue({
            path: {
              dirname,
              pathname,
              filename,
              page: join(path.pages, dirname),
              pageName: join(path.pages, dirname, filename)
            },
            content
          })
        }
      }

      if (pagination.template) {
        const component = await this.createComponent({
          id: pagination.template,
          values,
          document
        })

        if (typeof component === 'object') {
          result = result.concat(component.children)
        }
      }
    }

    return result
  }
})

/**
 * Parse HTML content and return a CoraliteDocument object representing the parsed document structure
 *
 * @param {string} string - The HTML content to parse. This should be a valid HTML string input.
 * @param {Object} pagination - Configuration object for pagination templates
 * @param {string} pagination.template - The template tag name used to identify pagination elements
 * @param {Object.<string, string>} pagination.attributes - Additional attributes to merge into the template element
 * @example parsePagination('<pagination-element></pagination-element>', {
 *   template: 'pagination-element',
 *   attributes: { class: 'custom-pagination' }
 * })
 */
export function parsePagination (string, pager) {
  // root element reference
  /** @type {CoraliteDocumentRoot} */
  const root = {
    type: 'root',
    children: []
  }

  // stack to keep track of current element hierarchy
  /** @type {CoraliteContentNode[]} */
  const stack = [root]
  const parser = new Parser({
    onprocessinginstruction (name, data) {
      root.children.push({
        type: 'directive',
        name,
        data
      })
    },
    onopentag (originalName, attributes) {
      const parent = stack[stack.length - 1]
      const element = createElement({
        name: originalName,
        attributes,
        parent
      })
      // push element to stack as it may have children
      stack.push(element)

      if (originalName === pager.template) {
        element.attribs = Object.assign(element.attribs, pager.attributes)
      }
    },
    ontext (text) {
      const parent = stack[stack.length - 1]

      createTextNode(text, parent)
    },
    onclosetag () {
      // remove current element from stack as we're done with its children
      stack.pop()
    },
    oncomment (data) {
      const parent = stack[stack.length - 1]

      parent.children.push({
        type: 'comment',
        data,
        parent
      })
    }
  })

  parser.write(string)
  parser.end()

  return root
}

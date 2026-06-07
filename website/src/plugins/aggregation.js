import { definePlugin } from 'coralite'
import path from 'node:path'

/**
 * Collects and filters pages based on the provided configuration.
 *
 * @param {import('coralite').CoraliteInstance} app
 * @param {Object} config
 * @returns {import('coralite').CoraliteCollectionItem[]}
 */
const collectPages = (app, config) => {
  const {
    path: paths = [],
    recursive = false,
    filter,
    sort,
    context
  } = config
  const pagesRoot = app.options.pages

  let allPages = []
  const uniquePaths = new Set()

  for (const relativePath of paths) {
    const targetPath = path.join(pagesRoot, relativePath)

    if (!recursive) {
      const pagesInDir = app.pages.getListByPath(targetPath)

      if (pagesInDir) {
        for (const item of pagesInDir) {
          const itemPath = item.path.pathname

          if (!uniquePaths.has(itemPath)) {
            uniquePaths.add(itemPath)
            allPages.push(item)
          }
        }
      }
    } else {
      // Recursive search
      for (const item of app.pages.list) {
        const dirname = item.path.dirname

        if (dirname === targetPath || dirname.startsWith(targetPath + path.sep)) {
          const itemPath = item.path.pathname

          if (!uniquePaths.has(itemPath)) {
            uniquePaths.add(itemPath)
            allPages.push(item)
          }
        }
      }
    }
  }

  // Filter
  if (typeof filter === 'function') {
    allPages = allPages.filter(item => {
      const itemState = (item.result && item.result.state) ? item.result.state : item.state
      return filter(itemState, context)
    })
  }

  // Sort
  if (typeof sort === 'function') {
    allPages.sort((a, b) => {
      const propsA = (a.result && a.result.state) ? a.result.state : a.state
      const propsB = (b.result && b.result.state) ? b.result.state : b.state
      return sort(propsA, propsB)
    })
  }

  return allPages
}

/**
 *
 */
export const aggregation = (configs = []) => {
  const configMap = new Map(configs.map(c => [c.name, c]))

  return definePlugin({
    name: 'aggregation',
    server: {
      onBeforeBuild: async ({ app, buildId }) => {
        for (const config of configs) {
          if (!config.pagination || !config.page) {
            continue
          }

          const allPages = collectPages(app, {
            ...config,
            context: {
              app,
              buildId
            }
          })
          const limit = config.limit
          const totalPages = limit ? Math.ceil(allPages.length / limit) : 1

          if (totalPages > 1) {
            const basePagePath = path.isAbsolute(config.page) ? config.page : path.join(app.options.pages, config.page)
            const basePage = app.pages.getItem(basePagePath)

            if (!basePage) {
              console.warn(`[aggregation] Base page "${config.page}" not found at "${basePagePath}" for aggregation "${config.name}"`)
              continue
            }

            const segment = config.pagination.segment || 'page'
            const currentPathname = basePage.path.pathname
            const currentFilename = basePage.path.filename
            const currentDirname = basePage.path.dirname

            // Derive URL pathname for the base page
            const pagesRoot = app.options.pages
            const urlPathname = path.join('/', path.relative(pagesRoot, currentPathname)).replace(/\\/g, '/')

            let urlPrefixBase = ''

            if (currentFilename === 'index.html') {
              urlPrefixBase = path.dirname(urlPathname)
            } else {
              const basename = path.basename(currentFilename, path.extname(currentFilename))
              urlPrefixBase = path.join(path.dirname(urlPathname), basename)
            }

            if (!urlPrefixBase.endsWith('/')) {
              urlPrefixBase += '/'
            }

            const targetDir = currentFilename === 'index.html'
              ? currentDirname
              : path.join(currentDirname, path.basename(currentFilename, path.extname(currentFilename)))

            for (let i = 2; i <= totalPages; i++) {
              const newPathname = path.join(targetDir, segment, `${i}.html`)

              const virtualItem = {
                content: basePage.content || await app.source.utils.getHtmlFile(basePage.path.pathname),
                virtual: true,
                path: {
                  pathname: newPathname,
                  dirname: path.dirname(newPathname),
                  filename: path.basename(newPathname)
                },
                state: {
                  paginationBaseUrl: urlPathname,
                  paginationUrlPrefix: urlPrefixBase
                },
                type: 'page'
              }

              await app.addRenderQueue(virtualItem, buildId)
            }
          }
        }
      },
      exports: {
        aggregate: ({ app }) => (context) => async (nameOrOptions) => {
          let config

          if (typeof nameOrOptions === 'object' && nameOrOptions !== null) {
            config = nameOrOptions
          } else {
            config = configMap.get(nameOrOptions)
            if (!config) {
              throw new Error(`Aggregation config "${nameOrOptions}" not found`)
            }
          }

          const {
            component,
            pagination,
            limit,
            offset = 0,
            transformState
          } = config

          const { state = {}, page: currentPageContext, session: currentRenderContext } = context || {}

          const allPages = collectPages(app, {
            ...config,
            context: {
              ...context,
              app,
              buildId: currentRenderContext?.buildId
            }
          })

          // Pagination
          let startIndex = offset
          let endIndex = allPages.length

          let currentPage = 1
          let totalPages = 1

          if (limit) {
            if (pagination) {
              const segment = pagination.segment || 'page'
              const urlPathname = (currentPageContext && currentPageContext.url) ? currentPageContext.url.pathname : ''

              const escapedSegment = segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              const segmentRegex = new RegExp(`/${escapedSegment}/(\\d+)`)
              const match = urlPathname.match(segmentRegex)

              if (match) {
                currentPage = parseInt(match[1], 10)
              }

              startIndex = offset + ((currentPage - 1) * limit)
              endIndex = startIndex + limit
              totalPages = Math.ceil(allPages.length / limit)
            } else {
              endIndex = Math.min(startIndex + limit, allPages.length)
            }
          }

          const paginatedPages = allPages.slice(startIndex, endIndex)
          const resultNodes = []

          for (const item of paginatedPages) {
            const itemState = (item.result && item.result.state) ? item.result.state : item.state
            const itemProps = { ...itemState }

            // Apply properties transformations
            if (transformState && typeof transformState === 'object') {
              for (const key in transformState) {
                if (Object.prototype.hasOwnProperty.call(transformState, key)) {
                  const transform = transformState[key]
                  if (typeof transform === 'string') {
                    itemProps[key] = itemState[transform]
                  } else if (typeof transform === 'function') {
                    itemProps[key] = transform(itemState)
                  }
                }
              }
            }

            if (component) {
              const componentElement = await app.createComponentElement({
                id: component,
                state: itemProps,
                page: item.result?.page || item.state?.page,
                session: currentRenderContext
              })

              if (componentElement && 'children' in componentElement) {
                resultNodes.push(...componentElement.children)
              }
            }
          }

          if (pagination) {
            const paginationComponentId = pagination.component || 'coralite-pagination'
            const urlPathname = (currentPageContext && currentPageContext.url) ? currentPageContext.url.pathname : ''

            let baseUrl = urlPathname
            let urlPrefix = ''

            if (state && typeof state.paginationBaseUrl === 'string') {
              baseUrl = state.paginationBaseUrl
            }

            if (state && typeof state.paginationUrlPrefix === 'string') {
              urlPrefix = state.paginationUrlPrefix
            } else {
              if (baseUrl.endsWith('/index.html') || baseUrl.endsWith('/')) {
                urlPrefix = path.dirname(baseUrl)
              } else {
                const basename = path.basename(baseUrl, '.html')
                urlPrefix = path.join(path.dirname(baseUrl), basename)
              }
            }

            if (!urlPrefix.endsWith('/')) {
              urlPrefix += '/'
            }

            const paginationProps = {
              'current-page': String(currentPage),
              'total-pages': String(totalPages),
              'base-url': baseUrl,
              'url-prefix': urlPrefix,
              segment: pagination.segment || 'page',
              'max-visible': String(pagination.maxVisible || 5),
              'aria-label': pagination.ariaLabel || 'Pagination',
              ellipsis: pagination.ellipsis || '...'
            }

            const componentElement = await app.createComponentElement({
              id: paginationComponentId,
              state: paginationProps,
              page: currentPageContext,
              session: currentRenderContext
            })

            if (componentElement && 'children' in componentElement) {
              resultNodes.push(...componentElement.children)
            }
          }

          return app.transform(resultNodes)
        }
      },
      components: [
        path.join(import.meta.dirname, 'components/coralite-pagination.html')
      ]
    }
  })
}

export default aggregation

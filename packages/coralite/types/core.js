
/**
 * @import { CoraliteModuleDefinitions } from './module.js'
 * @import { CoralitePluginInstance } from './plugin.js'
 * @import { Attribute } from './component.js'
 * @import { DomSerializerOptions } from 'dom-serializer'
 * @import { CoraliteAnyNode, CoraliteComponentRoot } from './dom.js'
 * @import { ScriptContent } from './script.js'
 * @import { CoraliteCollectionItem, CoraliteCollection } from './collection.js'
 */

/**
 * Represents HTML file data including path and raw content.
 * @typedef {Object} HTMLData
 * @property {'page'|'component'} [type] - The type of HTML file. 'page' for main pages, 'component' for reusable components.
 * @property {CoraliteModuleDefinitions} [state] - The initial values for the HTML module.
 * @property {CoraliteFilePath} path - The file's path information within the project structure.
 * @property {string} [content] - The raw HTML string contents of the file (optional, may be omitted for templates).
 * @property {boolean} [virtual] - Indicates if the file is virtual (in-memory) rather than from the filesystem.
 */

/**
 * Represents a file's path structure within the project.
 * @typedef {Object} CoraliteFilePath
 * @property {string} pathname - Full relative path from the project root to the file.
 * @property {string} dirname - Directory name containing the file.
 * @property {string} filename - The base file name (including extension).
 */

/**
 * Defines root directories for pages and components in a Coralite project.
 * @typedef {Object} CoralitePath
 * @property {string} pages - The path to the root pages directory
 * @property {string} components - The path to the root components directory
 */

/**
 * @typedef {Object} CoraliteStaticAsset
 * @property {string} [pkg] - The package name to copy assets from.
 * @property {string} [path] - The path to the asset within the package.
 * @property {string} dest - The destination path for the asset in the output directory.
 * @property {string} [src] - The absolute path to the source file (bypasses package resolution).
 */

/**
 * Error or warning data passed to the onError callback.
 * @typedef {Object} CoraliteErrorData
 * @property {'WARN'|'ERR'|'LOG'} level - The severity level.
 * @property {string} message - The message describing the error or warning.
 * @property {Error} [error] - Optional error object for tracing.
 */

/**
 * Callback function for handling errors and warnings.
 * @callback CoraliteOnError
 * @param {CoraliteErrorData} data - The error or warning data.
 * @returns {void}
 */

/**
 * @typedef {Object} CoraliteConfig
 * @property {string} [output='.coralite'] - The path to the output directory where built files will be placed.
 * @property {string} components - The path to the directory containing Coralite components.
 * @property {string} pages - The path to the directory containing pages that will be rendered using the provided templates.
 * @property {CoralitePluginInstance[]} [plugins] - Optional array of plugin instances to extend Coralite functionality.
 * @property {string} [baseURL] - Optional base URL for asset paths. Defaults to '/'.
 * @property {CoraliteStaticAsset[]} [assets] - Static assets to copy during build.
 * @property {Array<string | Attribute>} [ignoreByAttribute] - An array of attribute names and values to ignore by element type.
 * @property {Array<string | Attribute>} [skipRenderByAttribute] - An array of attribute names and values to skip rendering by element type.
 * @property {CoraliteOnError} [onError] - Optional callback function for handling errors and warnings.
 * @property {string[]} [externalStyles] - Global styles to inject into every page
 * @property {string} [mode='production'] - Build mode: "development" or "production"
 * @property {CoralitePath} [path] - Internal path mapping.
 */

/**
 * @typedef {Object} CoraliteBuildOptions
 * @property {number} [maxConcurrent] - The maximum number of concurrent file write operations.
 * @property {AbortSignal} [signal] - An AbortSignal to cancel the build operation.
 * @property {Object.<string, any>} [variables] - Local variables for the page
 */

/**
 * @typedef {Object} CoraliteBuildResult
 * @property {'page'} type - The type of result.
 * @property {CoraliteFilePath & { pages: string, components: string }} path - Path information.
 * @property {string} content - The rendered HTML content.
 * @property {number} duration - Time taken to render in milliseconds.
 * @property {CoraliteSession} session - The session associated with the render.
 */

/**
 * @typedef {Object} CoraliteSaveResult
 * @property {string} path - The absolute path where the file was saved.
 * @property {number} duration - Time taken in milliseconds.
 */

/**
 * @callback CoraliteBuildCallback
 * @param {CoraliteBuildResult} result - The build result for a single page.
 * @returns {Promise<any>|any}
 */

/**
 * Represents structured page URL, file, and meta information.
 * @typedef {Object} CoralitePage
 * @property {Object} url - URL path info.
 * @property {string} url.pathname - The URL pathname.
 * @property {string} url.dirname - The directory name of the URL.
 * @property {Object} file - Physical file path info.
 * @property {string} file.pathname - The file path name.
 * @property {string} file.dirname - The directory name of the file.
 * @property {string} file.filename - The filename.
 * @property {Object.<string, any>} meta - Extracted metadata from the page.
 */

/**
 * Union type representing values available for token replacement in components.
 * @typedef {Object.<string, string> & { __script__?: ScriptContent, $urlPathname?: string }} CoraliteProperties
 */

/**
 * @typedef {Object} CoraliteSession
 * @property {string} [buildId] - The unique identifier for the build process.
 * @property {Object.<string, any>} state - Global state for the session.
 * @property {Map<string, string>} styles - Collected styles during rendering.
 * @property {Set<string>} componentTags - Set of component tags used in the page.
 * @property {Object.<string, number>} instanceCounters - Counters for generating unique IDs.
 * @property {(prefix: string) => string} generateId - Function to generate a unique ID.
 * @property {Object} scripts - Script collection.
 * @property {Object.<string, Object.<string, any>>} scripts.content - Collected scripts content.
 * @property {(id: string, item: any) => void} scripts.add - Function to add a script to the collection.
 * @property {Object} source - Source context information.
 * @property {string} source.currentSourceContextId - Current source context ID.
 * @property {Object.<string, any>} source.contextInstances - Map of context instances.
 * @property {'production' | 'development'} [mode] - Current build mode.
 */

/**
 * Configuration options for creating a component element.
 * @typedef {Object} ComponentElementOptions
 * @property {string} id - The unique identifier of the component to render.
 * @property {Object.<string, any>} [state={}] - Initial state or properties to pass to the component.
 * @property {CoraliteAnyNode} [element] - The original AST node representing the component in the template.
 * @property {CoralitePage} [page] - Contextual information about the page being rendered.
 * @property {CoraliteAnyNode} [root] - The root node of the current rendering context.
 * @property {string} [contextId] - A unique identifier for this specific component instance.
 * @property {number} [index] - The index of the component within its parent's children.
 * @property {CoraliteSession} [session] - The current rendering session object.
 * @property {boolean} [noHydration] - If true, hydration scripts will not be generated for this component.
 */

/**
 * @typedef {Object} CoraliteInstance
 * @property {CoraliteConfig} options
 * @property {CoraliteCollection} pages
 * @property {CoraliteCollection} components
 * @property {(pathOrOptions?: string | string[] | CoraliteBuildCallback, optionsOrCallback?: CoraliteBuildOptions | CoraliteBuildCallback, callback?: CoraliteBuildCallback) => Promise<CoraliteBuildResult[]>} build
 * @property {(savePath?: string | string[], saveOptions?: CoraliteBuildOptions) => Promise<CoraliteSaveResult[]>} save
 * @property {(root: CoraliteComponentRoot | CoraliteAnyNode | CoraliteAnyNode[], options?: DomSerializerOptions) => string} transform
 * @property {(value: string | CoraliteCollectionItem, buildId: string) => Promise<void>} addRenderQueue
 * @property {(targetPath: string) => string[]} getPagePathsUsingCustomElement
 * @property {(options: ComponentElementOptions, head?: boolean) => Promise<CoraliteAnyNode | CoraliteAnyNode[]>} createComponentElement
 * @property {Record<string, { hashedPath: string, text: string }>} outputFiles
 * @property {(name: string, initialData: any) => Promise<any>} _triggerPluginHook
 * @property {(name: string, contextData: any) => Promise<any[]>} _triggerPluginAggregateHook
 * @property {Object} [source]
 */

export default {}

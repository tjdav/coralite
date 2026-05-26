import { CoraliteElement } from '../lib/coralite-element.js'
/**
 * @import { CoraliteResult, CoraliteComponent, ParseHTMLResult, Attribute, CoraliteRef, CoraliteTextNodeToken, CoraliteAttributeToken } from './component.js'
 * @import { CoraliteComponentOptions } from '../lib/coralite-element.js'
 * @import { HTMLData, CoraliteFilePath, CoralitePage, CoraliteSession } from './core.js'
 * @import { CoraliteModule, CoraliteModuleDefinition } from './module.js'
 * @import { CoraliteAnyNode } from './dom.js'
 * @import { CoraliteCollectionItem } from './collection.js'
 * @import { ScriptPlugin } from './script.js'
 * @import { Coralite } from '#lib'
 */

/**
 * @typedef {Object} CoraliteClientBeforeComponentSession
 * @property {Object.<string, any>} state - The unproxied initial component state.
 * @property {string} instanceId - The unique ID of the component instance.
 * @property {string} componentId - The tag name of the component.
 * @property {Array<{name: string, element: HTMLElement}>} refs - The DOM elements mapped by their reference names.
 * @property {CoraliteElement} element - The component instance element.
 * @property {CoraliteComponentOptions} options - The component options.
 */

/**
 * @typedef {Object} CoraliteClientAfterComponentSession
 * @property {Object.<string, any>} state - The proxied component state.
 * @property {string} instanceId - The unique ID of the component instance.
 * @property {string} componentId - The tag name of the component.
 * @property {CoraliteElement} element - The component instance element.
 * @property {CoraliteComponentOptions} options - The component options.
 */

/**
 * @typedef {Object} CoraliteClientDisconnectedSession
 * @property {Object.<string, any>} state - The proxied component state.
 * @property {string} instanceId - The unique ID of the component instance.
 * @property {string} componentId - The tag name of the component.
 * @property {CoraliteElement} element - The component instance element.
 * @property {CoraliteComponentOptions} options - The component options.
 */

/**
 * @callback CoraliteClientPluginBeforeComponentRenderCallback - Callback triggered before a client component state proxy is created and rendered.
 * @param {CoraliteClientBeforeComponentSession} context
 * @returns {void}
 */

/**
 * @callback CoraliteClientPluginAfterComponentRenderCallback - Callback triggered after a client component DOM is updated.
 * @param {CoraliteClientAfterComponentSession} context
 * @returns {void}
 */

/**
 * @callback CoraliteClientPluginDisconnectedCallback - Callback triggered when a client component is removed from the DOM.
 * @param {CoraliteClientDisconnectedSession} context
 * @returns {void}
 */

/**
 * @callback CoralitePluginBeforeComponentRenderCallback - Async callback triggered before a component is rendered.
 * @param {Object} context
 * @param {Object.<string, any>} context.state - Mutable state object
 * @param {string} context.componentId - Generic component name
 * @param {string} context.instanceId - Clean unique identifier
 * @param {CoraliteRef[]} context.refs - Scoped AST pointers for refs
 * @param {CoraliteTextNodeToken[]} context.textNodes - Scoped AST pointers for text nodes
 * @param {CoraliteAttributeToken[]} context.attributes - Scoped AST pointers for attributes
 * @param {CoralitePage} context.page - The current page context
 * @param {CoraliteElement} [context.element] - The parent AST tag itself
 * @param {CoraliteSession} context.session - Global build state
 * @param {Coralite} [context.app] - The global Coralite app instance
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @callback CoralitePluginAfterComponentRenderCallback - Async callback triggered after a component is rendered.
 * @param {Object} context
 * @param {CoraliteAnyNode} context.result - The component's rendered AST root
 * @param {Object.<string, any>} context.state - Final mutable state object
 * @param {string} context.componentId - Generic component name
 * @param {string} context.instanceId - Clean unique identifier
 * @param {CoraliteRef[]} context.refs - Scoped AST pointers for refs
 * @param {CoraliteTextNodeToken[]} context.textNodes - Scoped AST pointers for text nodes
 * @param {CoraliteAttributeToken[]} context.attributes - Scoped AST pointers for attributes
 * @param {CoralitePage} context.page - The current page context
 * @param {CoraliteElement} [context.element] - The parent AST tag itself
 * @param {CoraliteSession} context.session - Global build state
 * @param {Coralite} [context.app] - The global coralite app instance
 * @returns {Promise<Object|void>|Object|void} A partial AST patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginContext
 * @property {import('./module.js').CoraliteModuleDefinitions} state - Key-value pairs of data relevant to plugin execution
 * @property {CoralitePage} page - The global page object
 * @property {CoraliteModule} module - The module context the plugin is operating within (contains template/script)
 * @property {import('./dom.js').CoraliteAnyNode | import('./dom.js').CoraliteComponentRoot} root - The specific HTML element the plugin is applied to (if applicable)
 * @property {CoraliteSession} session - The current build session
 * @property {Attribute[]} [excludeByAttribute] - List of attribute name-value pairs to ignore during processing by element type
 * @property {string} id - Unique identifier for the value context.
 * @property {Coralite} [app] - The global coralite app instance
 * @property {boolean} [noHydration] - Indicates if the component should be stripped and not hydrated
 */

/**
 * @typedef {(context: CoralitePluginContext) => (...args: any[]) => any} CoralitePluginExportFunction
 */

/**
 * @callback CoralitePluginPageSetCallback - Async callback triggered when a page is created. Called with elements, state, and data.
 * @param {Object} param
 * @param {ParseHTMLResult} param.elements - Parsed HTML elements from the page
 * @param {CoraliteFilePath & Object.<string, any>} param.state - Values associated with the page path
 * @param {CoralitePage} param.page - The global page object
 * @param {CoraliteCollectionItem} param.data - Data item representing the newly created page
 * @param {Coralite} param.app - The global coralite app instance
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @callback CoralitePluginPageUpdateCallback - Async callback triggered when a page is updated. Called with elements, new and old state.
 * @param {Object} param
 * @param {ParseHTMLResult} param.elements - Updated HTML elements from the page
 * @param {CoralitePage} param.page - The global page object
 * @param {CoraliteCollectionItem} param.newValue - The updated data item
 * @param {CoraliteCollectionItem} param.oldValue - The previous data item before update
 * @param {Coralite} [param.app] - The global coralite app instance
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @callback CoralitePluginPageDeleteCallback - Async callback triggered when a page is deleted. Called with the deleted data.
 * @param {CoraliteCollectionItem} value - The data item being deleted
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @this {ThisType<Coralite>}
 * @callback CoralitePluginComponentCallback - Async callback triggered for component-related events (set, update, delete).
 * @param {CoraliteModule & {app?: Coralite}} component - The component module that was set, updated, or deleted
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @callback CoralitePluginBeforePageRenderCallback - Async callback triggered before a page has been rendered.
 * @param {Object} context
 * @param {CoraliteComponent} context.component - The cloned HTML component data being processed
 * @param {Object.<string, CoraliteModuleDefinition>} context.state - Properties associated with the component
 * @param {CoralitePage} context.page - The global page object
 * @param {CoraliteSession} context.session - Render context containing state for the build
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @callback CoralitePluginBeforeBuildCallback - Async callback triggered before the build begins.
 * @param {Object} context
 * @param {string | string[] | null} context.path - The target directory or an array of specific page paths to build
 * @param {Object} context.options - Configuration options for the build process
 * @param {Coralite} context.app - The global coralite app instance
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @callback CoralitePluginAfterPageRenderCallback - Async callback triggered after a page has been rendered but before saving.
 * @param {Object} context
 * @param {CoraliteResult} context.result - The rendered page result
 * @param {CoraliteSession} context.session - The current page build session
 * @returns {Promise<CoraliteResult[]|CoraliteResult|void>} New result(s) to add to the build output
 * @async
 */

/**
 * @callback CoralitePluginAfterBuildCallback - Async callback triggered when a build process completes (success or failure).
 * @param {Object} context
 * @param {CoraliteResult[]} context.results - The results of the build (pages generated)
 * @param {Error|null} context.error - The error if the build failed
 * @param {number} context.duration - The duration of the build in milliseconds
 * @param {Coralite} context.app - The global coralite app instance
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginServer
 * @property {Record<string, CoralitePluginExportFunction>} [exports] - Object of Two-Phase Curried functions. Phase 1 receives the explicit context, Phase 2 receives the executable arguments.
 * @property {HTMLData[]} [components] - Array of loaded component data
 * @property {CoralitePluginPageSetCallback} [onPageSet] - Async callback triggered when a page is created
 * @property {CoralitePluginPageUpdateCallback} [onPageUpdate] - Async callback triggered when a page is updated
 * @property {CoralitePluginPageDeleteCallback} [onPageDelete] - Async callback triggered when a page is deleted
 * @property {CoralitePluginComponentCallback} [onComponentSet] - Async callback triggered when a component is created
 * @property {CoralitePluginComponentCallback} [onComponentUpdate] - Async callback triggered when a components is updated
 * @property {CoralitePluginComponentCallback} [onComponentDelete] - Async callback triggered when a component is deleted
 * @property {CoralitePluginBeforePageRenderCallback} [onBeforePageRender] - Async callback triggered before page render
 * @property {CoralitePluginAfterPageRenderCallback} [onAfterPageRender] - Async callback triggered after page render
 * @property {CoralitePluginBeforeComponentRenderCallback} [onBeforeComponentRender] - Async callback triggered before component render
 * @property {CoralitePluginAfterComponentRenderCallback} [onAfterComponentRender] - Async callback triggered after component render
 * @property {CoralitePluginBeforeBuildCallback} [onBeforeBuild] - Async callback triggered before build starts
 * @property {CoralitePluginAfterBuildCallback} [onAfterBuild] - Async callback triggered when a build completes
 */

/**
 * @typedef {Object} CoralitePlugin
 * @property {string} name - Unique identifier/name of the plugin
 * @property {CoralitePluginServer} [server] - Server-side plugin configuration
 * @property {ScriptPlugin} [client] - Client-side plugin configuration
 */

/**
 * @typedef {Object} CoralitePluginInstance
 * @property {string} name - Unique identifier/name of the plugin
 * @property {CoralitePluginServer} [server] - Server-side plugin configuration
 * @property {ScriptPlugin} [client] - Client-side plugin configuration
 */

export default {}

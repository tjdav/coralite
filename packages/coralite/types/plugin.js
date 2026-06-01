import { CoraliteElement } from '../lib/coralite-element.js'
/**
 * @import { CoraliteResult, CoraliteComponent, ParseHTMLResult, Attribute, CoraliteRef, CoraliteTextNodeToken, CoraliteAttributeToken } from './component.js'
 * @import { CoraliteComponentOptions } from '../lib/coralite-element.js'
 * @import { HTMLData, CoraliteFilePath, CoralitePage, CoraliteSession } from './core.js'
 * @import { CoraliteModule, CoraliteModuleDefinition } from './module.js'
 * @import { CoraliteAnyNode } from './dom.js'
 * @import { CoraliteCollectionItem } from './collection.js'
 * @import { ScriptPlugin } from './script.js'
 * @import { Coralite } from '../lib/index.js'
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
 * @typedef {Object} CoralitePluginBeforeComponentRenderContext
 * @property {Object.<string, any>} state - Mutable state object
 * @property {string} componentId - Generic component name
 * @property {string} instanceId - Clean unique identifier
 * @property {CoraliteRef[]} refs - Scoped AST pointers for refs
 * @property {CoraliteTextNodeToken[]} textNodes - Scoped AST pointers for text nodes
 * @property {CoraliteAttributeToken[]} attributes - Scoped AST pointers for attributes
 * @property {CoralitePage} page - The current page context
 * @property {CoraliteElement} [element] - The parent AST tag itself
 * @property {CoraliteSession} session - Global build state
 * @property {Coralite} app - The global Coralite app instance
 */

/**
 * @callback CoralitePluginBeforeComponentRenderCallback - Async callback triggered before a component is rendered.
 * @param {CoralitePluginBeforeComponentRenderContext} context
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginAfterComponentRenderContext
 * @property {CoraliteAnyNode} result - The component's rendered AST root
 * @property {Object.<string, any>} state - Final mutable state object
 * @property {string} componentId - Generic component name
 * @property {string} instanceId - Clean unique identifier
 * @property {CoraliteRef[]} refs - Scoped AST pointers for refs
 * @property {CoraliteTextNodeToken[]} textNodes - Scoped AST pointers for text nodes
 * @property {CoraliteAttributeToken[]} attributes - Scoped AST pointers for attributes
 * @property {CoralitePage} page - The current page context
 * @property {CoraliteElement} [element] - The parent AST tag itself
 * @property {CoraliteSession} session - Global build state
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginAfterComponentRenderCallback - Async callback triggered after a component is rendered.
 * @param {CoralitePluginAfterComponentRenderContext} context
 * @returns {Promise<Object|void>|Object|void} A partial AST patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginGlobalContext
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @typedef {CoralitePluginGlobalContext & Object.<string, any>} CoralitePluginGlobalContextWithMutation
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
 * @property {Coralite} app - The global coralite app instance
 * @property {boolean} [noHydration] - Indicates if the component should be stripped and not hydrated
 */

/**
 * @typedef {CoralitePluginContext & Object.<string, any>} CoralitePluginContextWithMutation
 */

/**
 * @typedef {(context: CoralitePluginGlobalContextWithMutation) => Promise<(...args: any[]) => any> | ((...args: any[]) => any)} CoralitePluginExportFunction
 */

/**
 * @typedef {Object} CoralitePluginPageSetContext
 * @property {ParseHTMLResult} elements - Parsed HTML elements from the page
 * @property {CoraliteFilePath & Object.<string, any>} state - Values associated with the page path
 * @property {CoralitePage} page - The global page object
 * @property {CoraliteCollectionItem} data - Data item representing the newly created page
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginPageSetCallback - Async callback triggered when a page is created. Called with elements, state, and data.
 * @param {CoralitePluginPageSetContext} context
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginPageUpdateContext
 * @property {ParseHTMLResult} elements - Updated HTML elements from the page
 * @property {CoralitePage} page - The global page object
 * @property {CoraliteCollectionItem} newValue - The updated data item
 * @property {CoraliteCollectionItem} oldValue - The previous data item before update
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginPageUpdateCallback - Async callback triggered when a page is updated. Called with elements, new and old state.
 * @param {CoralitePluginPageUpdateContext} context
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoraliteApp
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @typedef {Object} CoralitePluginPageDeleteContext
 * @property {CoraliteCollectionItem} data - The page data being deleted
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginPageDeleteCallback - Async callback triggered when a page is deleted. Called with the deleted data.
 * @param {CoralitePluginPageDeleteContext} context
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginComponentContext
 * @property {CoraliteModule} component - The component module being set or updated
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginComponentCallback - Async callback triggered for component-related events (set and update).
 * @param {CoralitePluginComponentContext} context
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginComponentDeleteContext
 * @property {CoraliteCollectionItem} component - The component data being deleted
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginComponentDeleteCallback - Async callback triggered when a component is deleted.
 * @param {CoralitePluginComponentDeleteContext} context
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginBeforePageRenderContext
 * @property {CoraliteComponent} component - The cloned HTML component data being processed
 * @property {Object.<string, CoraliteModuleDefinition>} state - Properties associated with the component
 * @property {CoralitePage} page - The global page object
 * @property {CoraliteSession} session - Render context containing state for the build
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginBeforePageRenderCallback - Async callback triggered before a page has been rendered.
 * @param {CoralitePluginBeforePageRenderContext} context
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginBeforeBuildContext
 * @property {string | string[] | null} path - The target directory or an array of specific page paths to build
 * @property {import('./core.js').CoraliteBuildOptions} options - Configuration options for the build process
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginBeforeBuildCallback - Async callback triggered before the build begins.
 * @param {CoralitePluginBeforeBuildContext} context
 * @returns {Promise<Object|void>|Object|void} A partial state patch to be merged.
 * @async
 */

/**
 * @typedef {Object} CoralitePluginAfterPageRenderContext
 * @property {CoraliteResult} result - The rendered page result
 * @property {CoraliteSession} session - The current page build session
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginAfterPageRenderCallback - Async callback triggered after a page has been rendered but before saving.
 * @param {CoralitePluginAfterPageRenderContext} context
 * @returns {Promise<CoraliteResult[]|CoraliteResult|void>} New result(s) to add to the build output
 * @async
 */

/**
 * @typedef {Object} CoralitePluginAfterBuildContext
 * @property {CoraliteResult[]} results - The results of the build (pages generated)
 * @property {Error|null} error - The error if the build failed
 * @property {number} duration - The duration of the build in milliseconds
 * @property {Coralite} app - The global coralite app instance
 */

/**
 * @callback CoralitePluginAfterBuildCallback - Async callback triggered when a build process completes (success or failure).
 * @param {CoralitePluginAfterBuildContext} context
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
 * @property {CoralitePluginComponentDeleteCallback} [onComponentDelete] - Async callback triggered when a component is deleted
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

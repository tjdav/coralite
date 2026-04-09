
/**
 * CORE TYPES
 * @import { HTMLData, CoraliteFilePath, CoralitePath, CoraliteConfig, CoralitePathValues, CoraliteValues, CoraliteErrorData, CoraliteOnError } from './core.js'
 *
 * DOM & AST
 * @import { CoraliteElement, RawCoraliteElement, CoraliteTextNode, RawCoraliteTextNode, CoraliteComment, RawCoraliteComment, CoraliteDirective, RawCoraliteDirective, CoraliteAnyNode, CoraliteComponentRoot, RawCoraliteComponentRoot, CoraliteContentNode } from './dom.js'
 *
 * DOCUMENT
 * @import { CoraliteComponent, CoraliteResult, ParseHTMLResult, CoraliteToken, CoraliteAttributeToken, CoraliteTextNodeToken, CoraliteRef, CoraliteComponentValues, Attribute, CoraliteComponentResult } from './component.js'
 *
 * MODULES
 * @import { CoraliteModule, CoraliteModuleValues, CoraliteModuleValue, CoraliteModuleSlotElement, CoraliteModuleScript, CoraliteModuleSetup, CoraliteModuleSlotFunction } from './module.js'
 *
 * COLLECTIONS
 * @import { CoraliteCollectionItem, CoraliteCollectionCallbackResult, CoraliteCollectionEventResult, CoraliteCollectionEventSet, CoraliteCollectionEventDelete, CoraliteCollectionEventUpdate } from './collection.js'
 *
 * PLUGINS
 * @import { CoralitePlugin, CoralitePluginContext, CoralitePluginInstance, CoralitePluginResult, CoralitePluginModule, CoralitePluginPageSetCallback, CoralitePluginPageUpdateCallback, CoralitePluginPageDeleteCallback, CoralitePluginComponentCallback, CoralitePluginAfterPageRenderCallback } from './plugin.js'
 *
 * SCRIPTS
 * @import { ScriptContent, ScriptPlugin, InstanceContext, CoraliteScriptContent, ScriptPluginHelperGlobalContext, ScriptPluginHelperGlobalInstance, ScriptPluginHelperLocalInstance } from './script.js'
 */

/**
 * @typedef {import('#lib').Coralite} Coralite
 */

/**
 * @typedef {import('./core.js').HTMLData} HTMLData
 * @typedef {import('./core.js').CoraliteFilePath} CoraliteFilePath
 * @typedef {import('./core.js').CoralitePath} CoralitePath
 * @typedef {import('./core.js').CoraliteConfig} CoraliteConfig
 * @typedef {import('./core.js').CoralitePathValues} CoralitePathValues
 * @typedef {import('./core.js').CoraliteValues} CoraliteValues
 * @typedef {import('./core.js').CoraliteStaticAsset} CoraliteStaticAsset
 * @typedef {import('./core.js').CoraliteErrorData} CoraliteErrorData
 * @typedef {import('./core.js').CoraliteOnError} CoraliteOnError
 */

/**
 * @typedef {import('./dom.js').CoraliteElement} CoraliteElement
 * @typedef {import('./dom.js').RawCoraliteElement} RawCoraliteElement
 * @typedef {import('./dom.js').CoraliteTextNode} CoraliteTextNode
 * @typedef {import('./dom.js').RawCoraliteTextNode} RawCoraliteTextNode
 * @typedef {import('./dom.js').CoraliteComment} CoraliteComment
 * @typedef {import('./dom.js').RawCoraliteComment} RawCoraliteComment
 * @typedef {import('./dom.js').CoraliteDirective} CoraliteDirective
 * @typedef {import('./dom.js').RawCoraliteDirective} RawCoraliteDirective
 * @typedef {import('./dom.js').CoraliteAnyNode} CoraliteAnyNode
 * @typedef {import('./dom.js').CoraliteComponentRoot} CoraliteComponentRoot
 * @typedef {import('./dom.js').RawCoraliteComponentRoot} RawCoraliteComponentRoot
 * @typedef {import('./dom.js').CoraliteContentNode} CoraliteContentNode
 */

/**
 * @typedef {import('./component.js').CoraliteComponent} CoraliteComponent
 * @typedef {import('./component.js').CoraliteResult} CoraliteResult
 * @typedef {import('./component.js').ParseHTMLResult} ParseHTMLResult
 * @typedef {import('./component.js').CoraliteToken} CoraliteToken
 * @typedef {import('./component.js').CoraliteAttributeToken} CoraliteAttributeToken
 * @typedef {import('./component.js').CoraliteTextNodeToken} CoraliteTextNodeToken
 * @typedef {import('./component.js').CoraliteRef} CoraliteRef
 * @typedef {import('./component.js').CoraliteComponentValues} CoraliteComponentValues
 * @typedef {import('./component.js').Attribute} Attribute
 * @typedef {import('./component.js').CoraliteComponentResult} CoraliteComponentResult
 */

/**
 * @typedef {import('./module.js').CoraliteModule} CoraliteModule
 * @typedef {import('./module.js').CoraliteModuleValues} CoraliteModuleValues
 * @typedef {import('./module.js').CoraliteModuleValue} CoraliteModuleValue
 * @typedef {import('./module.js').CoraliteModuleSlotElement} CoraliteModuleSlotElement
 * @typedef {import('./module.js').CoraliteModuleScript} CoraliteModuleScript
 * @typedef {import('./module.js').CoraliteModuleSetup} CoraliteModuleSetup
 * @typedef {import('./module.js').CoraliteModuleSlotFunction} CoraliteModuleSlotFunction
 */

/**
 * @typedef {import('./collection.js').CoraliteCollectionItem} CoraliteCollectionItem
 * @typedef {import('./collection.js').CoraliteCollectionCallbackResult} CoraliteCollectionCallbackResult
 * @typedef {import('./collection.js').CoraliteCollectionEventResult} CoraliteCollectionEventResult
 * @typedef {import('./collection.js').CoraliteCollectionEventSet} CoraliteCollectionEventSet
 * @typedef {import('./collection.js').CoraliteCollectionEventDelete} CoraliteCollectionEventDelete
 * @typedef {import('./collection.js').CoraliteCollectionEventUpdate} CoraliteCollectionEventUpdate
 */

/**
 * @template T
 * @typedef {import('./plugin.js').CoralitePlugin<T>} CoralitePlugin
 */

/**
 * @typedef {import('./plugin.js').CoralitePluginContext} CoralitePluginContext
 * @typedef {import('./plugin.js').CoralitePluginInstance} CoralitePluginInstance
 */

/**
 * @template T
 * @typedef {import('./plugin.js').CoralitePluginResult<T>} CoralitePluginResult
 */

/**
 * @template T
 * @typedef {import('./plugin.js').CoralitePluginModule<T>} CoralitePluginModule
 */

/**
 * @typedef {import('./plugin.js').CoralitePluginPageSetCallback} CoralitePluginPageSetCallback
 * @typedef {import('./plugin.js').CoralitePluginPageUpdateCallback} CoralitePluginPageUpdateCallback
 * @typedef {import('./plugin.js').CoralitePluginPageDeleteCallback} CoralitePluginPageDeleteCallback
 * @typedef {import('./plugin.js').CoralitePluginComponentCallback} CoralitePluginComponentCallback
 * @typedef {import('./plugin.js').CoralitePluginAfterPageRenderCallback} CoralitePluginAfterPageRenderCallback
 */

/**
 * @typedef {import('./script.js').ScriptContent} ScriptContent
 * @typedef {import('./script.js').ScriptPlugin} ScriptPlugin
 * @typedef {import('./script.js').InstanceContext} InstanceContext
 * @typedef {import('./script.js').CoraliteScriptContent} CoraliteScriptContent
 * @typedef {import('./script.js').ScriptPluginHelperGlobalContext} ScriptPluginHelperGlobalContext
 * @typedef {import('./script.js').ScriptPluginHelperGlobalInstance} ScriptPluginHelperGlobalInstance
 * @typedef {import('./script.js').ScriptPluginHelperLocalInstance} ScriptPluginHelperLocalInstance
 */

export default {}

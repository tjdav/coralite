
/**
 * CORE TYPES
 * @import { HTMLData, CoraliteFilePath, CoralitePath, CoraliteConfig, CoralitePathValues, CoraliteValues } from './core.js'
 *
 * DOM & AST
 * @import { CoraliteElement, RawCoraliteElement, CoraliteTextNode, RawCoraliteTextNode, CoraliteComment, RawCoraliteComment, CoraliteDirective, RawCoraliteDirective, CoraliteAnyNode, CoraliteDocumentRoot, RawCoraliteDocumentRoot, CoraliteContentNode } from './dom.js'
 *
 * DOCUMENT
 * @import { CoraliteDocument, CoraliteResult, ParseHTMLResult, CoraliteToken, CoraliteAttributeToken, CoraliteTextNodeToken, CoraliteRef, CoraliteDocumentValues, IgnoreByAttribute, CoraliteDocumentResult } from './document.js'
 *
 * MODULES
 * @import { CoraliteModule, CoraliteModuleValues, CoraliteModuleValue, CoraliteModuleSlotElement, CoraliteModuleScript, CoraliteModuleSetup } from './module.js'
 *
 * COLLECTIONS
 * @import { CoraliteCollectionItem, CoraliteCollectionCallbackResult, CoraliteCollectionEventResult, CoraliteCollectionEventSet, CoraliteCollectionEventDelete, CoraliteCollectionEventUpdate } from './collection.js'
 *
 * PLUGINS
 * @import { CoralitePlugin, CoralitePluginContext, CoralitePluginInstance, CoralitePluginResult, CoralitePluginModule, CoralitePluginPageSetCallback, CoralitePluginPageUpdateCallback, CoralitePluginPageDeleteCallback, CoralitePluginTemplateCallback, CoralitePluginAfterPageRenderCallback } from './plugin.js'
 *
 * SCRIPTS
 * @import { ScriptContent, ScriptPlugin, InstanceContext, CoraliteScriptContent } from './script.js'
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
 * @typedef {import('./dom.js').CoraliteDocumentRoot} CoraliteDocumentRoot
 * @typedef {import('./dom.js').RawCoraliteDocumentRoot} RawCoraliteDocumentRoot
 * @typedef {import('./dom.js').CoraliteContentNode} CoraliteContentNode
 */

/**
 * @typedef {import('./document.js').CoraliteDocument} CoraliteDocument
 * @typedef {import('./document.js').CoraliteResult} CoraliteResult
 * @typedef {import('./document.js').ParseHTMLResult} ParseHTMLResult
 * @typedef {import('./document.js').CoraliteToken} CoraliteToken
 * @typedef {import('./document.js').CoraliteAttributeToken} CoraliteAttributeToken
 * @typedef {import('./document.js').CoraliteTextNodeToken} CoraliteTextNodeToken
 * @typedef {import('./document.js').CoraliteRef} CoraliteRef
 * @typedef {import('./document.js').CoraliteDocumentValues} CoraliteDocumentValues
 * @typedef {import('./document.js').IgnoreByAttribute} IgnoreByAttribute
 * @typedef {import('./document.js').CoraliteDocumentResult} CoraliteDocumentResult
 */

/**
 * @typedef {import('./module.js').CoraliteModule} CoraliteModule
 * @typedef {import('./module.js').CoraliteModuleValues} CoraliteModuleValues
 * @typedef {import('./module.js').CoraliteModuleValue} CoraliteModuleValue
 * @typedef {import('./module.js').CoraliteModuleSlotElement} CoraliteModuleSlotElement
 * @typedef {import('./module.js').CoraliteModuleScript} CoraliteModuleScript
 * @typedef {import('./module.js').CoraliteModuleSetup} CoraliteModuleSetup
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
 * @typedef {import('./plugin.js').CoralitePluginTemplateCallback} CoralitePluginTemplateCallback
 * @typedef {import('./plugin.js').CoralitePluginAfterPageRenderCallback} CoralitePluginAfterPageRenderCallback
 */

/**
 * @typedef {import('./script.js').ScriptContent} ScriptContent
 * @typedef {import('./script.js').ScriptPlugin} ScriptPlugin
 * @typedef {import('./script.js').InstanceContext} InstanceContext
 * @typedef {import('./script.js').CoraliteScriptContent} CoraliteScriptContent
 */

export default {}

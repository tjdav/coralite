
/**
 * @import { CoraliteElement, CoraliteComponentRoot, CoraliteTextNode } from './dom.js'
 * @import { CoraliteModuleDefinitions, CoraliteAttributesDefinition, CoraliteModuleSlotFunction } from './module.js'
 * @import { CoralitePath, CoraliteFilePath, CoralitePage, CoraliteSession } from './core.js'
 */

/**
 * Represents a complete Coralite component with metadata and rendering structure.
 * @typedef {Object} CoraliteComponent
 * @property {CoraliteComponentRoot} root - Array of elements and text nodes in the component
 * @property {CoraliteElement[]} customElements - Custom elements defined in the component
 * @property {CoralitePath & CoraliteFilePath} path - Document's file path
 * @property {Array<string | Attribute>} ignoreByAttribute - An array of attribute names and values to ignore by element type.
 * @property {string[]} [styles] - Collected styles during build process
 * @property {Set<string>} [sharedStyles] - Set of processed shared style IDs
 * @property {CoraliteModuleDefinitions} [state] - The initial definitions for the component.
 * @property {CoralitePage} [page] - The global page object.
 * @property {CoraliteElement[]} [tempElements] - An array of temporary elements created during the parsing process.
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 */

/**
 * @typedef {Object} CoraliteComponentResult
 * @property {CoraliteModuleDefinitions} state - The module definitions extracted from the component
 * @property {CoralitePage} [page] - The global page object.
 * @property {CoraliteElement[]} tempElements - Temporary elements created during processing
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 * @property {string[]} [styles] - Collected styles during build process
 * @property {Set<string>} [sharedStyles] - Set of processed shared style IDs
 * @property {CoraliteElement[]} [customElements] - Custom elements defined in the component
 */

/**
 * Represents a rendered output component with metadata and statistics.
 * @typedef {Object} CoraliteResult
 * @property {'page'|'component'} type - Result type.
 * @property {CoraliteFilePath} path - Document's file path
 * @property {string} content - Raw file content of the render process as a string
 * @property {number} [duration] - The duration of the render process in milliseconds
 */

/**
 * @typedef {Object} Attribute
 * @property {string} name - Name of attribute
 * @property {string} value - Value of attribute
 */

/**
 * Holds tokenized metadata extracted from component attributes, element references and text nodes.
 * @typedef {Object} CoraliteComponentValues
 * @property {CoraliteRef[]} refs - List of element references
 * @property {CoraliteAttributeToken[]} attributes - List of attribute tokens from the component
 * @property {CoraliteTextNodeToken[]} textNodes - List of text node tokens from the component
 */

/**
 * A representation of a token with name and value.
 * @typedef {Object} CoraliteToken
 * @property {string} name - Token identifier
 * @property {string} content - Token value or content
 */

/**
 * Represents an HTML attribute token linked to its parent element.
 * @typedef {Object} CoraliteAttributeToken
 * @property {string} name - Attribute token identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the attribute
 * @property {CoraliteToken[]} tokens - Array of associated tokens
 */

/**
 * @typedef {Object} CoraliteRef
 * @property {string} name - Ref identifier
 * @property {CoraliteElement} element - Corresponding HTML element for the attribute
 */

/**
 * @typedef {Object} CoraliteSlotElement
 * @property {string} name - Slot name
 * @property {CoraliteElement} element - Corresponding slot element node
 * @property {CoraliteElement} [customElement] - Corresponding custom element node
 */

/**
 * Represents a text node token with associated metadata.
 * @typedef {Object} CoraliteTextNodeToken
 * @property {CoraliteTextNode} textNode - Text node that contains the token
 * @property {CoraliteToken[]} tokens - Array of associated tokens
 * @property {'html' | 'text'} type - Type of token
 */

/**
 * @typedef {Object} ParseHTMLResult
 * @property {CoraliteComponentRoot} root - The root element of the parsed HTML component.
 * @property {CoraliteElement[]} customElements - An array of custom elements identified during parsing.
 * @property {CoraliteElement[]} tempElements - An array of temporary elements created during the parsing process.
 * @property {CoraliteElement[]} [skipRenderElements] - An array of elements to skip rendering.
 */

/**
 * Helper for querying slotted content.
 * @typedef {Object} CoraliteSlotsHelper
 * @property {function(string=): boolean} has - Checks if content was provided for a slot.
 * @property {function(string=): Node[]} get - Returns array of projected nodes for a slot.
 * @property {function(string=): number} count - Returns number of projected nodes for a slot.
 * @property {string[]} names - List of declared slot names.
 * @property {Node[]} default - Projected nodes in the default slot.
 */

/**
 * Context passed to component isomorphic getters.
 * @template {Record<string, any>} [TState=Record<string, any>]
 * @typedef {Object} CoraliteGetterContext
 * @property {Readonly<TState>} state - Read-only reactive state proxy (client) or merged state (SSR).
 * @property {HTMLElement|null} root - Host custom element on client, null or AST node during SSR.
 * @property {(id: string) => HTMLElement|null} refs - Ref resolver returning matching element or null.
 * @property {CoraliteSlotsHelper} slots - Query interface for projected slotted content.
 * @property {AbortSignal} signal - Lifecycle abort signal aborted on element disconnection or state mutation.
 */

/**
 * Context passed to component server() block for server-side data fetching.
 * @template {Record<string, any>} [TState=Record<string, any>]
 * @typedef {Object} CoraliteServerContext
 * @property {TState} state - Component state.
 * @property {HTMLElement|null} [root] - Server AST root node.
 * @property {CoraliteSession} [session] - Server session.
 * @property {CoralitePage} [page] - Page metadata.
 * @property {AbortSignal} [signal] - Lifecycle abort signal.
 * @property {Record<string, any>} [slots] - Server slots helper.
 * @property {(id: string) => any} [refs] - Element refs resolver.
 */

/**
 * Context passed to component client() lifecycle function.
 * @template {Record<string, any>} [TState=Record<string, any>]
 * @typedef {Object} CoraliteClientContext
 * @property {string} id - Unique instance identifier.
 * @property {string} instanceId - Unique instance identifier.
 * @property {HTMLElement} root - The custom element instance.
 * @property {TState} state - Reactive proxy of component state.
 * @property {Record<string, string>} errors - Validation errors dictionary.
 * @property {(refName: string) => HTMLElement|null} refs - Instance element ref lookup function.
 * @property {AbortSignal} signal - Lifecycle abort signal aborted on disconnectedCallback.
 * @property {(propertyName: string, callback: (newValue: any, oldValue: any) => void) => (() => void)} observe - Explicit state observation API returning a disposer.
 * @property {(eventName: string, detail?: any, options?: CustomEventInit) => boolean} emit - Dispatches a bubbling, composed CustomEvent from the component's root element.
 */

/**
 * Context passed to reactive slot builders.
 * @template {Record<string, any>} [TState=Record<string, any>]
 * @typedef {Object} CoraliteSlotBuilderContext
 * @property {string} name - The slot name being rendered.
 * @property {TState} state - Reactive state proxy.
 * @property {HTMLElement|null} root - Host element.
 * @property {(id: string) => HTMLElement|null} refs - Ref resolver.
 * @property {AbortSignal} signal - Lifecycle abort signal.
 */

/**
 * Function computing reactive slot content.
 * @template {Record<string, any>} [TState=Record<string, any>]
 * @callback CoraliteComputedSlotFunction
 * @param {CoraliteSlotBuilderContext<TState>} context - Slot builder context.
 * @returns {any}
 */

/**
 * Options for defineComponent.
 *
 * @template {Record<string, any>} [TState=Record<string, any>]
 * @typedef {Object} CoraliteComponentOptions
 * @property {CoraliteAttributesDefinition} [attributes] - Attribute schema definitions.
 * @property {Record<string, (context: CoraliteGetterContext<TState>) => any>} [getters] - Isomorphic derived getters.
 * @property {(context: CoraliteClientContext<TState> & Record<string, any>) => void | Promise<void>} [client] - Browser lifecycle function.
 * @property {(context: CoraliteServerContext<TState> & TState & Record<string, any>) => Promise<Record<string, any> | void> | Record<string, any> | void} [server] - Server-side data fetching.
 * @property {Map<any, any> | Record<string | symbol, any>} [provide] - W3C context provider map or object.
 * @property {string[] | Record<string, any>} [consume] - W3C context consumer declaration.
 * @property {Record<string, CoraliteComputedSlotFunction<TState> | CoraliteModuleSlotFunction>} [slots] - Reactive slot builders or slot transform functions.
 * @property {Record<string, ((state: TState) => any) | string | number>} [style] - Reactive style definitions and CSS custom properties.
 */

export default {}


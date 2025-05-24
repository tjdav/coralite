# Coralite Type Reference

This document serves as a comprehensive reference for the type definitions used within the Coralite. It outlines the structure, properties, and relationships of core types involved in parsing, rendering, and managing HTML documents, templates, and modules. The following sections provide detailed breakdowns of each type, with tables and internal links for easy navigation.

# Table of Contents

## Core Document Types
- [CoraliteResult](#coralite-result)

## Document Structure Types
- [CoraliteDocument](#coralite-document)
- [CoraliteDocumentRoot](#coralite-document-root)

## File and Path Structures
- [HTMLData](#html-data)
- [CoraliteFilePath](#coralite-file-path)
- [CoralitePath](#coralite-path)

## Tokenization and Metadata
- [CoraliteToken](#coralite-token)
- [CoraliteAttributeToken](#coralite-attribute-token)
- [CoraliteTextNodeToken](#coralite-text-node-token)
- [CoraliteDocumentValues](#coralite-document-values)

## Module and Component Structures
- [CoraliteModule](#coralite-module)
- [CoraliteModuleValue](#coralite-module-value)
- [CoraliteModuleValues](#coralite-module-values)

## Element and Node Types
- [CoraliteElement](#coralite-element)
- [CoraliteTextNode](#coralite-text-node)
- [CoraliteComment](#coralite-comment)
- [CoraliteAnyNode](#coralite-any-node)
- [CoraliteContentNode](#coralite-content-node)

## Directives and Slots
- [CoraliteDirective](#coralite-directive)
- [CoraliteModuleSlotElement](#coralite-module-slot-element)

## Collection and Event Types
- [CoraliteCollectionItem](#coralite-collection-item)
- [CoraliteCollectionEventResult](#coralite-collection-event-result)
- [CoraliteCollectionEventSet](#coralite-collection-event-set)
- [CoraliteCollectionEventDelete](#coralite-collection-event-delete)
- [CoraliteCollectionEventUpdate](#coralite-collection-event-update)

## Utility and Miscellaneous Types
- [IgnoreByAttribute](#ignore-by-attribute)
- [CoraliteSlotElement](#coralite-slot-element)
- [CoraliteCollectionCallbackResult](#coralite-collection-callback-result)

### Core Document Types {#core-document-types}

#### `CoraliteResult` {#coralite-result}
Represents a rendered output document with metadata and statistics.

| Property | Type | Description |
|----------|------|-------------|
| `item` | [`CoraliteDocument`](#coralite-document) | The parsed and rendered document object. |
| `html` | `string` | Raw HTML content of the render process as a string. |
| `duration` | `number` | Time taken to render the page in milliseconds (optional). |

---

### Document Structure Types {#document-structure-types}

#### `CoraliteDocument` {#coralite-document}
Represents a complete Coralite document with metadata and rendering structure.

| Property | Type | Description |
|----------|------|-------------|
| `root` | [`CoraliteDocumentRoot`](#coralite-document-root) | Root node containing all content nodes. |
| `customElements` | `CoraliteElement[]` | Custom elements defined in the document. |
| `path` | `CoralitePath & CoraliteFilePath` | Document's file path information. |
| `ignoreByAttribute` | [`IgnoreByAttribute`](#ignore-by-attribute) | Attributes to ignore during processing. |

#### `CoraliteDocumentRoot` {#coralite-document-root}
Represents the root node of a document containing all content nodes.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'root'` | Node type identifier. |
| `children` | `(CoraliteAnyNode \| CoraliteDirective)[]` | Array of elements, text nodes, or directives in the document. |

---

### File and Path Structures {#file-and-path-structures}

#### `HTMLData` {#html-data}
Represents HTML file data including path and raw content.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'page' \| 'template'` | File type: main page or reusable template. |
| `path` | [`CoraliteFilePath`](#coralite-file-path) | Path information within the project structure. |
| `content` | `string` | Optional raw HTML string contents of the file. |

#### `CoraliteFilePath` {#coralite-file-path}
Represents a file's path structure within the project.

| Property | Type | Description |
|----------|------|-------------|
| `pathname` | `string` | Full relative path from project root to file. |
| `dirname` | `string` | Directory containing the file. |
| `filename` | `string` | Base file name with extension. |
| `page` | `string` | Path to template directory (for organizing related templates). |
| `pageName` | `string` | Relative path to template file within its directory. |

#### `CoralitePath` {#coralite-path}
Defines root directories for pages and templates in a Coralite project.

| Property | Type | Description |
|----------|------|-------------|
| `pages` | `string` | Path to the root pages directory. |
| `templates` | `string` | Path to the root templates directory. |

---

### Tokenization and Metadata {#tokenization-and-metadata}

#### `CoraliteToken` {#coralite-token}
A representation of a token with name and value.

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Token identifier. |
| `content` | `string` | Token value or content. |

#### `CoraliteAttributeToken` {#coralite-attribute-token}
Represents an HTML attribute token linked to its parent element.

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Attribute token identifier. |
| `element` | [`CoraliteElement`](#coralite-element) | Parent HTML element. |
| `tokens` | `CoraliteToken[]` | Array of associated tokens. |

#### `CoraliteTextNodeToken` {#coralite-text-node-token}
Represents a text node token with metadata.

| Property | Type | Description |
|----------|------|-------------|
| `textNode` | [`CoraliteTextNode`](#coralite-text-node) | Text node containing the token. |
| `tokens` | `CoraliteToken[]` | Array of associated tokens. |

#### `CoraliteDocumentValues` {#coralite-document-values}
Holds tokenized metadata extracted from document attributes and text nodes.

| Property | Type | Description |
|----------|------|-------------|
| `attributes` | `CoraliteAttributeToken[]` | Array of attribute tokens. |
| `textNodes` | `CoraliteTextNodeToken[]` | Array of text node tokens. |

---

### Module and Component Structures {#module-and-component-structures}

#### `CoraliteModule` {#coralite-module}
A module within the Coralite library, containing metadata and rendering logic.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique module identifier. |
| `path` | [`CoraliteFilePath`](#coralite-file-path) | Template paths associated with this module (optional). |
| `lineOffset` | `number` | Optional offset for line numbering in templates. |
| `template` | [`CoraliteElement`](#coralite-element) | Module's rendering template. |
| `script` | `string \| undefined` | JavaScript raw code for logic or behavior (optional). |
| `values` | [`CoraliteDocumentValues`](#coralite-document-values) | Values generated from the module's markup. |
| `customElements` | `CoraliteElement[]` | Custom elements defined in the module. |
| `slotElements` | `Object.<string, CoraliteModuleSlotElement>` | Custom slot elements and their configurations. |

#### `CoraliteModuleValue` {#coralite-module-value}
Represents a single value that a module can store or process.

| Type | Description |
|------|-------------|
| `string` | Simple string value. |
| `string[]` | Array of strings. |
| `(CoraliteDirective \| CoraliteAnyNode)[]` | Array of directives or content nodes. |

#### `CoraliteModuleValues` {#coralite-module-values}
A collection of module values associated with a module.

| Type | Description |
|------|-------------|
| `Object.<string, CoraliteModuleValue>` | Key-value mapping of module identifiers to their values. |

---

### Element and Node Types {#element-and-node-types}

#### `CoraliteElement` {#coralite-element}
Represents a standard HTML element in the Coralite content tree.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'tag'` | Element type identifier. |
| `name` | `string` | Tag name (e.g., `'div'`, `'span'`). |
| `attribs` | `Object.<string, string>` | Element attributes. |
| `children` | `CoraliteAnyNode[]` | Child nodes of the element. |
| `parent` | [`CoraliteContentNode`](#coralite-content-node) | Parent element or document root. |
| `parentChildIndex` | `number` | Position in parent's child list (optional). |
| `slots` | `Object[]` | Slot configurations (optional). |
| `remove` | `boolean` | Flag to mark element for removal from the stack (optional). |

#### `CoraliteTextNode` {#coralite-text-node}
Represents a text node within the Coralite content tree.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'text'` | Text node type identifier. |
| `data` | `string` | Additional attributes for the text node. |
| `parent` | [`CoraliteContentNode`](#coralite-content-node) | Parent element of the text node. |

#### `CoraliteComment` {#coralite-comment}
Represents an HTML comment within the Coralite content tree.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'comment'` | Comment type identifier. |
| `data` | `string` | Content of the HTML comment. |
| `parent` | [`CoraliteContentNode`](#coralite-content-node) | Parent element of the comment. |

#### `CoraliteAnyNode` {#coralite-any-node}
Union type representing any content node (element, text, or comment).

| Type | Description |
|------|-------------|
| [`CoraliteElement`](#coralite-element) | HTML element. |
| [`CoraliteTextNode`](#coralite-text-node) | Text node. |
| [`CoraliteComment`](#coralite-comment) | HTML comment. |

#### `CoraliteContentNode` {#coralite-content-node}
Union type representing nodes that can be part of a document's content hierarchy.

| Type | Description |
|------|-------------|
| [`CoraliteElement`](#coralite-element) | HTML element. |
| [`CoraliteDocumentRoot`](#coralite-document-root) | Document root node. |

---

### Directives and Slots {#directives-and-slots}

#### `CoraliteDirective` {#coralite-directive}
Represents a directive found in HTML content, like a DOCTYPE declaration.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'directive'` | Node type identifier. |
| `data` | `string` | Raw HTML doctype string (e.g., `<!DOCTYPE html>`). |
| `name` | `string` | Doctype name (e.g., `'html'`). |

#### `CoraliteModuleSlotElement` {#coralite-module-slot-element}
Defines a slot with its associated HTML element and custom component.

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Slot's unique identifier. |
| `customElement` | [`CoraliteElement`](#coralite-element) | Custom component for the slot. |
| `element` | [`CoraliteElement`](#coralite-element) | Corresponding HTML element for the slot. |

---

#### `CoraliteTokenOptions` {#coralite-token-options}
Configuration options for token handling during processing.

| Property | Type | Description |
|----------|------|-------------|
| `default` | `Object.<string, string>` | Default token values for properties not explicitly set (optional). |
| `aliases` | `Object.<string, string[]>` | Token aliases and their possible values (optional). |

### Collection and Event Types {#collection-and-event-types}

#### `CoraliteCollectionItem` {#coralite-collection-item}
A document object with both `HTMLData` properties and result handling capabilities.

| Type | Description |
|------|-------------|
| `CoraliteCollectionCallbackResult & HTMLData` | Combines result callback data with HTML file metadata. |

#### `CoraliteCollectionEventResult` {#coralite-collection-event-result}
Represents the outcome of a collection event (set, delete, update).

| Property | Type | Description |
|----------|------|-------------|
| `value` | `*` | Processed value from the event handler. |
| `type` | `'page' \| 'template'` | Document type (optional). |
| `id` | `string` | Optional identifier for the item. |

#### `CoraliteCollectionEventSet` {#coralite-collection-event-set}
Callback function to set a collection item.

| Parameter | Type | Description |
|----------|------|-------------|
| `value` | [`CoraliteCollectionItem`](#coralite-collection-item) | Item to be set. |

#### `CoraliteCollectionEventDelete` {#coralite-collection-event-delete}
Callback function to delete a collection item.

| Parameter | Type | Description |
|----------|------|-------------|
| `value` | [`CoraliteCollectionItem`](#coralite-collection-item) | Item or pathname to delete. |

#### `CoraliteCollectionEventUpdate` {#coralite-collection-event-update}
Callback function to update a collection item.

| Parameters | Type | Description |
|-----------|------|-------------|
| `newValue` | [`CoraliteCollectionItem`](#coralite-collection-item) | New item value. |
| `oldValue` | [`CoraliteCollectionItem`](#coralite-collection-item) | Original item value. |

---

### Utility and Miscellaneous Types {#utility-and-miscellaneous-types}

#### `IgnoreByAttribute` {#ignore-by-attribute}
An array of attribute name-value pairs to exclude from processing.

| Type | Description |
|------|-------------|
| `Array.<[string, string]>` | Array of `[attributeName, value]` pairs. |

#### `CoraliteSlotElement` {#coralite-slot-element}
Represents a slot with its associated HTML element and custom component.

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Slot's unique identifier. |
| `customElement` | [`CoraliteElement`](#coralite-element) | Custom component for the slot. |
| `element` | [`CoraliteElement`](#coralite-element) | Corresponding HTML element for the slot. |

#### `CoraliteCollectionCallbackResult` {#coralite-collection-callback-result}
Represents a result returned from event handlers.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'page' \| 'template'` | Document type (optional). |
| `result` | `*` | Result value returned from the event handler. |
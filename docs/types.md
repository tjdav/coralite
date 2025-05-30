# Coralite Type Reference

This document serves as a comprehensive reference for the type definitions used within the Coralite. It outlines the structure, properties, and relationships of core types involved in parsing, rendering, and managing HTML documents, templates, and modules. The following sections provide detailed breakdowns of each type, with tables and internal links for easy navigation.

## Table of Contents

- [Core Types](#core-types)
  - [HTMLData](#html-data)
  - [CoraliteFilePath](#coralite-file-path)
  - [CoralitePath](#coralite-path)
  - [CoraliteTokenOptions](#coralite-token-options)

- [Document and Result Types](#document-and-result-types)
  - [CoraliteDocumentValues](#coralite-document-values)
  - [CoraliteResult](#coralite-result)
  - [CoraliteDocumentRoot](#coralite-document-root)
  - [CoraliteDocument](#coralite-document)

- [Module and Plugin Types](#module-and-plugin-types)
  - [CoraliteModuleValues](#coralite-module-values)
  - [CoraliteModuleValue](#coralite-module-value)
  - [CoraliteModule](#coralite-module)
  - [CoralitePluginContext](#coralite-plugin-context)
  - [CoralitePluginModule](#coralite-plugin-module)
  - [CoralitePlugin](#coralite-plugin)
  - [CoralitePluginInstance](#coralite-plugin-instance)

- [Content Nodes](#content-nodes)
  - [CoraliteElement](#coralite-element)
  - [CoraliteTextNode](#coralite-text-node)
  - [CoraliteComment](#coralite-comment)
  - [CoraliteAnyNode](#coralite-any-node)
  - [CoraliteContentNode](#coralite-content-node)

- [Plugins, Collections and Events](#plugins-collections-and-events)
  - [IgnoreByAttribute](#ignore-by-attribute)
  - [CoraliteCollectionCallbackResult](#coralite-collection-callback-result)
  - [CoraliteCollectionItem](#coralite-collection-item)
  - [CoraliteCollectionEventResult](#coralite-collection-event-result)
  - [CoraliteCollectionEventSet](#coralite-collection-event-set)
  - [CoraliteCollectionEventDelete](#coralite-collection-event-delete)
  - [CoraliteCollectionEventUpdate](#coralite-collection-event-update)

---

## Core Types {#core-types}

### `HTMLData` {#html-data}
Represents HTML file data including path and raw content.

| Property | Type                                 | Description                                                                 |
|----------|--------------------------------------|-----------------------------------------------------------------------------|
| `type`   | `'page'` \| `'template'`             | The type of HTML file. 'page' for main pages, 'template' for reusable components. |
| `values` | [`CoraliteModuleValues`](#coralite-module-values) | The initial values for the HTML module.                                      |
| `path`   | [`CoraliteFilePath`](#coralite-file-path)     | The file's path information within the project structure.                   |
| `content`| `string` (optional)                  | The raw HTML string contents of the file (optional, may be omitted for templates). |

---

### `CoraliteFilePath` {#coralite-file-path}
Represents a file's path structure within the project.

| Property   | Type     | Description                                                                 |
|------------|----------|-----------------------------------------------------------------------------|
| `pathname` | `string` | Full relative path from the project root to the file.                       |
| `dirname`  | `string` | Directory name containing the file.                                         |
| `filename` | `string` | The base file name (including extension).                                   |

---

### `CoralitePath` {#coralite-path}
Defines root directories for pages and templates in a Coralite project.

| Property | Type     | Description                                                                 |
|----------|----------|-----------------------------------------------------------------------------|
| `pages`    | `string` | The path to the root pages directory.                                       |
| `templates`| `string` | The path to the root templates directory.                                   |

---

### `CoraliteTokenOptions` {#coralite-token-options}
Configuration options for token handling during processing.

| Property     | Type                              | Description                                                                 |
|--------------|-----------------------------------|-----------------------------------------------------------------------------|
| `default`    | `Object.<string, string>`         | Default token values for properties not explicitly set.                     |
| `aliases`    | `Object.<string, string[]>`       | Token aliases and their possible values.                                    |

---

## Document and Result Types {#document-and-result-types}

### `CoraliteDocumentValues` {#coralite-document-values}
Holds tokenized metadata extracted from document attributes and text nodes.

| Property     | Type                                | Description                                                                 |
|--------------|-------------------------------------|-----------------------------------------------------------------------------|
| `attributes` | [`CoraliteAttributeToken[]`](#coralite-attribute-token) | Array of attribute tokens from the document.                               |
| `textNodes`  | [`CoraliteTextNodeToken[]`](#coralite-text-node-token)  | Array of text node tokens from the document.                               |

---

### `CoraliteResult` {#coralite-result}
Represents a rendered output document with metadata and statistics.

| Property     | Type                                | Description                                                                 |
|--------------|-------------------------------------|-----------------------------------------------------------------------------|
| `item`       | [`CoraliteDocument`](#coralite-document)   | The document object from the rendering process.                             |
| `html`       | `string`                            | Raw HTML content of the render process as a string.                         |
| `duration`   | `number` (optional)                 | Time taken to render the page in milliseconds.                              |

---

### `CoraliteDocumentRoot` {#coralite-document-root}
Represents the root node of a document containing all content nodes.

| Property     | Type                                | Description                                                                 |
|--------------|-------------------------------------|-----------------------------------------------------------------------------|
| `children`   | [`(CoraliteAnyNode | CoraliteDirective)[]`](#coralite-any-node)  | Document list.                                                              |

---

### `CoraliteDocument` {#coralite-document}
Represents a complete Coralite document with metadata and rendering structure.

| Property           | Type                                 | Description                                                                 |
|--------------------|--------------------------------------|-----------------------------------------------------------------------------|
| `root`             | [`CoraliteDocumentRoot`](#coralite-document-root)   | Array of elements and text nodes in the document.                           |
| `customElements`   | [`CoraliteElement[]`](#coralite-element)     | Custom elements defined in the document.                                    |
| `path`             | [`CoralitePath & CoraliteFilePath`](#coralite-file-path)  | Document's file path.                                                       |
| `ignoreByAttribute`| [`IgnoreByAttribute`](#ignore-by-attribute)   | An array of attribute names and values to ignore by element type.          |

---

## Module and Plugin Types {#module-and-plugin-types}

### `CoraliteModuleValues` {#coralite-module-values}
A collection of module values associated with a module.

| Property | Type                                | Description                                                                 |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| (Key)    | [`CoraliteModuleValue`](#coralite-module-value)  | Key-value pairs representing module data.                                   |

---

### `CoraliteModuleValue` {#coralite-module-value}
Represents a single value that a module can store or process.

| Type                          | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| `string`                      | A simple string value.                                                      |
| `string[]`                    | An array of strings.                                                        |
| [`CoraliteDirective[]`](#coralite-directive)  | Array of directives (e.g., DOCTYPE).                                       |
| [`CoraliteAnyNode[]`](#coralite-any-node)     | Array of content nodes (elements, text, comments).                          |

---

### `CoraliteModule` {#coralite-module}
A module within the Coralite library, containing metadata and rendering logic.

| Property       | Type                                 | Description                                                                 |
|----------------|--------------------------------------|-----------------------------------------------------------------------------|
| `id`           | `string`                             | Unique module identifier used to reference this module within the application. |
| `path`         | [`CoraliteFilePath`](#coralite-file-path)  | Template paths associated with this module, if any.                         |
| `lineOffset`   | `number` (optional)                  | Optional offset value for line numbering purposes within the template.       |
| `template`     | [`CoraliteElement`](#coralite-element)    | Module's rendering template which defines its structure and layout.          |
| `script`       | `string` (optional)                  | Module's JavaScript raw code used for logic or behavior associated with this module. |
| `values`       | [`CoraliteDocumentValues`](#coralite-document-values)  | Values generated from the module's markup, containing metadata or variable information. |
| `customElements`| [`CoraliteElement[]`](#coralite-element)    | Custom elements defined in the module, allowing extension of HTML capabilities. |
| `slotElements` | `Object.<string, CoraliteModuleSlotElement>`  | Custom slot elements and their configurations, enabling flexible content insertion points within components. |

---

## Content Nodes {#content-nodes}

### `CoraliteElement` {#coralite-element}
Represents a standard HTML element in the Coralite content tree.

| Property         | Type                                | Description                                                                 |
|------------------|-------------------------------------|-----------------------------------------------------------------------------|
| `type`           | `'tag'`                             | Element type.                                                               |
| `name`           | `string`                            | Tag name.                                                                   |
| `attribs`        | `Object.<string, string>`           | Element attributes.                                                         |
| `children`       | [`CoraliteAnyNode[]`](#coralite-any-node)     | Child nodes of the element.                                                 |
| `parent`         | [`CoraliteContentNode`](#coralite-content-node)  | Parent element.                                                             |
| `parentChildIndex` | `number` (optional)                | Position in parent's child list.                                            |
| `slots`          | `Object[]` (optional)               | Slot configurations.                                                        |
| `remove`         | `boolean` (optional)                | Mark element to be removed from stack.                                      |

---

### `CoraliteTextNode` {#coralite-text-node}
Represents a text node within the Coralite content tree.

| Property   | Type                                | Description                                                                 |
|------------|-------------------------------------|-----------------------------------------------------------------------------|
| `type`     | `'text'`                            | Text node type.                                                             |
| `data`     | `string`                            | Additional attributes for the text node.                                    |
| `parent`   | [`CoraliteContentNode`](#coralite-content-node)  | Parent element of the text node.                                            |

---

### `CoraliteComment` {#coralite-comment}
Represents an HTML comment within the Coralite content tree.

| Property   | Type                                | Description                                                                 |
|------------|-------------------------------------|-----------------------------------------------------------------------------|
| `type`     | `'comment'`                         | Comment type.                                                               |
| `data`     | `string`                            | Additional attributes for the text node.                                    |
| `parent`   | [`CoraliteContentNode`](#coralite-content-node)  | Parent element of the text node.                                            |

---

### `CoraliteAnyNode` {#coralite-any-node}
Union type representing any content node (element, text, or comment).

| Type                          | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| [`CoraliteElement`](#coralite-element)   | A standard HTML element.                                                    |
| [`CoraliteTextNode`](#coralite-text-node) | A text node within the content tree.                                        |
| [`CoraliteComment`](#coralite-comment)    | An HTML comment in the content tree.                                         |

---

### `CoraliteContentNode` {#coralite-content-node}
Union type representing nodes that can be part of a document's content hierarchy.

| Type                          | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| [`CoraliteElement`](#coralite-element)   | A standard HTML element.                                                    |
| [`CoraliteDocumentRoot`](#coralite-document-root)  | Root node containing all content nodes.                                     |

---

## Plugins, Collections and Events {#plugins-collections-and-events}

### `IgnoreByAttribute` {#ignore-by-attribute}
An array of attribute name-value pairs to exclude from processing.

| Property     | Type                              | Description                                                                 |
|--------------|-----------------------------------|-----------------------------------------------------------------------------|
| (Key)        | `[string, string][]`              | List of attribute names and values to ignore by element type.               |

---

### `CoralitePluginContext` {#coralite-plugin-context}
Runtime context for plugin execution.

| Property       | Type                                | Description                                                                 |
|----------------|-------------------------------------|-----------------------------------------------------------------------------|
| `values`       | `Object.<string, string|string[]|CoraliteAnyNode[]>`  | Key-value pairs of data relevant to plugin execution.                       |
| `document`     | [`CoraliteDocument`](#coralite-document)   | The HTML file data being processed by the plugin.                           |
| `module`       | [`CoraliteModule`](#coralite-module)    | The module context the plugin is operating within (contains template/script). |
| `element`      | [`CoraliteElement`](#coralite-element)   | The specific HTML element the plugin is applied to (if applicable).          |
| `path`         | `Object`                            | File path information for the current document/module being processed.      |
| `excludeByAttribute` | `[string, string][]`             | List of attribute name-value pairs to ignore during processing by element type. |
| `id`           | `string`                            | Unique identifier for the value context.                                    |

---

### `CoralitePluginModule` {#coralite-plugin-module}
Execution function that processes content using plugin logic.

```javascript
/**
 * @callback CoralitePluginModule
 * @param {Object} options - Configuration options passed to the plugin
 * @param {CoralitePluginContext} context - Runtime context providing access to values, document data, module info, and path details
 */
```

---

### `CoralitePlugin` {#coralite-plugin}
Definition of a Coralite plugin.

| Property | Type                                | Description                                                                 |
|----------|-------------------------------------|-----------------------------------------------------------------------------|
| `name`   | `string`                            | Unique identifier/name of the plugin.                                       |
| `method` | [`CoralitePluginModule`](#coralite-plugin-module)  | Execution function that processes content using plugin logic.               |
| `templates` | `string[]` (optional, default: `[]`)  | List of custom templates to be included in the coralite instance.           |

---

### `CoralitePluginInstance` {#coralite-plugin-instance}
A Coralite plugin with associated template data.

| Property     | Type                                | Description                                                                 |
|--------------|-------------------------------------|-----------------------------------------------------------------------------|
| `name`       | `string`                            | Unique identifier/name of the plugin.                                       |
| `method`     | [`CoralitePluginModule`](#coralite-plugin-module)  | Execution function that processes content using plugin logic.               |
| `templates`  | [`HTMLData[]`](#html-data) (optional, default: `[]`) | List of custom templates to be included in the coralite instance.           |

---

### `CoraliteCollectionCallbackResult` {#coralite-collection-callback-result}
Result value returned from event handlers.

| Property     | Type                                | Description                                                                 |
|--------------|-------------------------------------|-----------------------------------------------------------------------------|
| `type`       | `'page'` \| `'template'`            | Document type.                                                              |
| `result`     | `*`                                 | Result value returned from event handlers.                                  |

---

### `CoraliteCollectionItem` {#coralite-collection-item}
A document object with both HTMLData properties and result handling capabilities.

| Type                          | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| [`CoraliteCollectionCallbackResult & HTMLData`](#html-data)  | Combines callback results and HTML data.                                    |

---

### `CoraliteCollectionEventResult` {#coralite-collection-event-result}
Processed value from event handlers.

| Property     | Type                                | Description                                                                 |
|--------------|-------------------------------------|-----------------------------------------------------------------------------|
| `value`      | `*`                                 | The processed value.                                                        |
| `type`       | `'page'` \| `'template'` (optional) | Document type.                                                              |
| `id`         | `string` (optional)                 | Optional identifier for the item.                                           |

---

### `CoraliteCollectionEventSet` {#coralite-collection-event-set}
Callback for setting an item in a collection.

```javascript
/**
 * @callback CoraliteCollectionEventSet
 * @param {CoraliteCollectionItem} value - Item to be set
 * @returns {CoraliteCollectionEventResult} Returns a result object with processed value and optional ID
 */
```

---

### `CoraliteCollectionEventDelete` {#coralite-collection-event-delete}
Callback for deleting an item from a collection.

```javascript
/**
 * @callback CoraliteCollectionEventDelete
 * @param {CoraliteCollectionItem} value - Item or pathname to delete
 */
```

---

### `CoraliteCollectionEventUpdate` {#coralite-collection-event-update}
Callback for updating an item in a collection.

```javascript
/**
 * @callback CoraliteCollectionEventUpdate
 * @param {CoraliteCollectionItem} newValue - New item value
 * @param {CoraliteCollectionItem} oldValue - Original item value
 */
```
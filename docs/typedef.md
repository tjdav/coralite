# Coralite Type Reference

This document serves as a comprehensive reference for the type definitions used within the Coralite. It outlines the structure, properties, and relationships of core types involved in parsing, rendering, and managing HTML documents, templates, modules, and aggregation processes. The following sections provide detailed breakdowns of each type, with tables and internal links for easy navigation.

### Table of Contents

1. [HTMLData](#html-data)  
2. [CoraliteFilePath](#coralite-file-path)  
3. [CoralitePath](#coralite-path)  
4. [CoraliteTokenOptions](#coralite-token-options)  
5. [CoraliteModuleValues](#coralite-module-values)  
6. [CoraliteModuleValue](#coralite-module-value)  
7. [CoraliteModule](#coralite-module)  
8. [CoraliteDocumentTokens](#coralite-document-tokens)  
9. [CoraliteToken](#coralite-token)  
10. [CoraliteAttributeToken](#coralite-attribute-token)  
11. [CoraliteTextNodeToken](#coralite-text-node-token)  
12. [CoraliteModuleSlotElement](#coralite-module-slot-element)  
13. [CoraliteComponent](#coralite-component)  
14. [CoraliteElement](#coralite-element)  
15. [CoraliteTextNode](#coralite-text-node)  
16. [CoraliteComment](#coralite-comment)  
17. [CoraliteAnyNode](#coralite-any-node)  
18. [CoraliteContentNode](#coralite-content-node)  
19. [CoraliteSlotElement](#coralite-slot-element)  
20. [CoraliteDirective](#coralite-directive)  
21. [CoraliteDocumentRoot](#coralite-document-root)  
22. [CoraliteDocument](#coralite-document)  
23. [CoraliteAggregateTemplate](#coralite-aggregate-template)  
24. [CoraliteResult](#coralite-result)  
25. [IgnoreByAttribute](#ignore-by-attribute)  
26. [CoraliteAggregateFilter](#coralite-aggregate-filter)  
27. [CoraliteAggregateSort](#coralite-aggregate-sort)  
28. [CoraliteAggregate](#coralite-aggregate)

### `HTMLData` {#html-data}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `path` | [`CoraliteFilePath`](#coralite-file-path) | Relative path information for the HTML file. |
| `content` | `string` | Raw HTML string contents of the file (optional). |

---

### `CoraliteFilePath` {#coralite-file-path}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `pathname` | `string` | Relative path to the file. |
| `dirname` | `string` | Directory name of the file. |
| `filename` | `string` | File name (including extension). |
| `page` | `string` | Path to the template directory. |
| `pageName` | `string` | Pathname to the template. |

---
  
### `CoralitePath` {#coralite-path}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `pages` | `string` | Root directory path for Coralite pages. |
| `templates` | `string` | Root directory path for Coralite templates. |

---

### `CoraliteTokenOptions` {#coralite-token-options}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `default` | `Object.<string, string>` | Default token values for unspecified properties. |
| `aliases` | `Object.<string, string[]>` | Token aliases and their possible values. |

---


### `CoraliteModuleValues` {#coralite-module-values}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| (Key) | [`CoraliteModuleValue`](#coralite-module-value) | Map of module keys to their values. |

---

### `CoraliteModuleValue` {#coralite-module-value}

| Type | Description |
|------------------------------------------------------------------------------------------|----------------------------------------------|
| `string` | A string value. |
| `string[]` | An array of strings. |
| [`CoraliteDirective`](#coralite-directive) \| [`CoraliteAnyNode`](#coralite-any-node)[] | Array of directive or node elements. |

---

### `CoraliteModule` {#coralite-module}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `id` | `string` | Unique module identifier. |
| `path` | [`CoraliteFilePath`](#coralite-file-path) | Template paths associated with this module (optional). |
| `lineOffset` | `number` | Optional offset for line numbering in templates. |
| `template` | [`CoraliteElement`](#coralite-element) | Module's rendering template structure. |
| `script` | `string \| undefined` | Raw JavaScript code for module logic (optional). |
| `tokens` | [`CoraliteDocumentTokens`](#coralite-document-tokens) | Tokens generated from the module's markup. |
| `customElements` | [`CoraliteElement[]`](#coralite-element) | Custom elements defined in the module. |
| `slotElements` | `Object.<string, Object.<string, `[CoraliteModuleSlotElement](#coralite-module-slot-element)`>>` | Slot elements and their configurations. |

---

### `CoraliteDocumentTokens` {#coralite-document-tokens}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `attributes` | [`CoraliteAttributeToken[]`](#coralite-attribute-token) | Array of attribute tokens. |
| `textNodes` | [`CoraliteTextNodeToken[]`](#coralite-text-node-token) | Array of text node tokens. |

---
  
### `CoraliteToken` {#coralite-token}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `name` | `string` | Token identifier. |
| `content` | `string` | Token value or content. |

---

### `CoraliteAttributeToken` {#coralite-attribute-token}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `name` | `string` | Attribute token identifier. |
| `element` | [`CoraliteElement`](#coralite-element) | Corresponding HTML element for the attribute. |
| `tokens` | [`CoraliteToken[]`](#coralite-token) | Array of associated tokens. |

  

---

  

### `CoraliteTextNodeToken` {#coralite-text-node-token}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `textNode` | [`CoraliteTextNode`](#coralite-text-node) | Text node containing the token. |
| `tokens` | [`CoraliteToken[]`](#coralite-token) | Array of associated tokens. |

---

### `CoraliteModuleSlotElement` {#coralite-module-slot-element}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `name` | `string` | Slot element identifier. |
| `element` | [`CoraliteElement`](#coralite-element) | Corresponding HTML element for the slot. |

---

### `CoraliteComponent` {#coralite-component}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `element` | [`CoraliteElement`](#coralite-element) | Primary HTML element representing this component. |
| `documents` | [`CoraliteDocument[]`](#coralite-document) | Documents used to append to page render list (optional). |

---

### `CoraliteElement` {#coralite-element}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `type` | `'tag'` | Element type identifier. |
| `name` | `string` | Tag name of the element. |
| `attribs` | `Object.<string, string>` | Element attributes. |
| `children` | [`CoraliteAnyNode[]`](#coralite-any-node) | Child nodes of the element. |
| `parent` | [`CoraliteContentNode`](#coralite-content-node) | Parent element of this node. |
| `parentChildIndex` | `number | undefined` | Position in parent's child list (optional). |
| `slots` | `Object[] | undefined` | Slot definitions (optional). |
| `remove` | `boolean | undefined` | Whether to remove this element from the stack (optional). |

---


### `CoraliteTextNode` {#coralite-text-node}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `type` | `'text'` | Node type identifier. |
| `data` | `string` | Additional attributes for the text node. |
| `parent` | [`CoraliteContentNode`](#coralite-content-node) | Parent element of this text node. |

  

---

  

### `CoraliteComment` {#coralite-comment}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `type` | `'comment'` | Node type identifier. |
| `data` | `string` | Additional attributes for the comment. |
| `parent` | [`CoraliteContentNode`](#coralite-content-node) | Parent element of this comment node. |

---

### `CoraliteAnyNode` {#coralite-any-node}

| Type | Description |
|------------------------------------------------------------------------------------------|----------------------------------------------|
| [`CoraliteElement`](#coralite-element) \| [`CoraliteTextNode`](#coralite-text-node) \| [`CoraliteComment`](#coralite-comment) | Union type for any node (element, text, comment). |

---

### `CoraliteContentNode` {#coralite-content-node}

| Type | Description |
|------------------------------------------------------------------------------------------|----------------------------------------------|
| [`CoraliteElement`](#coralite-element) \| [`CoraliteDocumentRoot`](#coralite-document-root) | Union type for content nodes (elements or document roots). |

---

### `CoraliteSlotElement` {#coralite-slot-element}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `name` | `string` | Slot identifier. |
| `customElement` | [`CoraliteElement`](#coralite-element) | Custom component for the slot. |
| `element` | [`CoraliteElement`](#coralite-element) | Corresponding HTML element for the slot. |

---

### `CoraliteDirective` {#coralite-directive}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `type` | `'directive'` | Node type identifier. |
| `data` | `string` | Raw HTML DOCTYPE data. |
| `name` | `string` | DOCTYPE name. |

---

### `CoraliteDocumentRoot` {#coralite-document-root}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `type` | `'root'` | Node type identifier. |
| `children` | ([CoraliteAnyNode](#coralite-any-node) \| [CoraliteDirective](#coralite-directive))[] | List of document elements, text nodes, or directives. |

---  

### `CoraliteDocument` {#coralite-document}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `root` | [`CoraliteDocumentRoot`](#coralite-document-root) | Root node of the document containing elements and text nodes. |
| `customElements` | [`CoraliteElement[]`](#coralite-element) | Custom elements defined in the document. |
| `path` | [`CoralitePath & CoraliteFilePath`](#coralite-path) | Document's file path information. |
| `ignoreByAttribute` | [`IgnoreByAttribute`](#ignore-by-attribute) | Array of attributes and values to ignore by element type. |

---  

### `CoraliteAggregateTemplate` {#coralite-aggregate-template}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `item` | `string` | Unique identifier for the component used for each document. |

---

### `CoraliteResult` {#coralite-result}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `item` | [`CoraliteDocument`](#coralite-document) | The parsed and rendered document object. |
| `html` | `string` | Final HTML output as a string. |
| `duration` | `number` | Time taken to render the page in milliseconds. |

---

### `IgnoreByAttribute` {#ignore-by-attribute}

| Type | Description |
|------------------------------------------------------------------------------------------|----------------------------------------------|
| `Array<Array<string, string>>` | Array of attribute names and values to ignore by element type. |

---

### `CoraliteAggregateFilter` {#coralite-aggregate-filter}

| Signature | Description |
|----------|---------------------|
| `(metadata: `[`CoraliteToken`](#coralite-token)`) => void` | Callback to filter out unwanted elements from the aggregated content. |

---

### `CoraliteAggregateSort` {#coralite-aggregate-sort}

| Signature | Description |
|----------|---------------------|
| `(a: Object.<string, (string \| `[`CoraliteToken[]`](#coralite-token)`)>, b: Object.<string, (string \| `[`CoraliteToken[]`](#coralite-token)`)>) => number` | Sort aggregated pages based on metadata. |

---

### `CoraliteAggregate` {#coralite-aggregate}

| Property | Type | Description |
|----------|---------------------|----------------------------------------------|
| `path` | `string` | Path to aggregate, relative to the pages directory. |
| `template` | [`CoraliteAggregateTemplate`](#coralite-aggregate-template) \| `string` | Templates used to display the result. |
| `pagination` | `Object \| undefined` | Pagination configuration (optional). |
| `recursive` | `boolean \| undefined` | Whether to recursively search subdirectories (optional). |
| `tokens` | [`CoraliteTokenOptions`](#coralite-token-options) \| `undefined` | Token configuration options (optional). |
| `sort` | [`CoraliteAggregateSort`](#coralite-aggregate-sort) \| `undefined` | Sort aggregated pages (optional). |
| `limit` | `number \| undefined` | Maximum number of results to retrieve (optional). |
| `offset` | `number \| undefined` | Starting index for the results list (optional). |

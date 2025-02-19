# coralite

The `coralite` function is the core processing engine of Coralite. It takes a configuration object and returns an array of objects, each representing one page rendered with its respective HTML content along with other metadata such as document title or render time in milliseconds (ms). 

## Signature

```typescript
async function coralite(options: {
  templates: string
  pages: string
  ignoreByAttribute?: Array<Array<string, string>>
}): Promise<
  Array<{
    document: CoraliteDocument
    html: string
    duration: number
  }>
>
```

## Parameters

- **`options`** (`Object`): An object containing configuration options for the `coralite` function.

### `templates`

- **Type:** `string`
- **Description:** The file system path to the directory containing Coralite templates. These templates are used to create components during the rendering process.
- **Required:** Yes

### `pages`

- **Type:** `string`
- **Description:** The file system path to the directory containing pages that will be rendered using the provided templates.
- **Required:** Yes

### `ignoreByAttribute` (optional)

- **Type:** `Array<Array<string, string>>`
- **Description:** An optional 2D array of element names and their respective attributes to ignore during parsing. For example, `[['data-ignore', 'true']]` ignores elements with a `data-ignore="true"` attribute.
- **Default:** `undefined`

## Returns

The `coralite` function returns a promise that resolves to an array of objects, each containing the following properties:

### `document`

- **Type:** `CoraliteDocument`
- **Description:** An object representing the parsed HTML document with metadata about custom elements used in it. See [Coralite Document](#coralitedocument) for more details.

### `html`

- **Type:** `string`
- **Description:** The rendered HTML content as a string.

### `duration`

- **Type:** `number`
- **Description:** The time taken (in milliseconds) to render the document and its components.

## Examples

```javascript
coralite({
  templates: './path/to/templates',
  pages: './path/to/pages',
  ignoreByAttribute: [['data-ignore', 'true']],
})
  .then((documents) => {
    console.log(documents)
  })
```

## Coralite Document

The `CoraliteDocument` object is a part of the return value from the `coralite` function. It contains metadata about custom elements used in the rendered HTML document.

### Signature

```typescript
type CoraliteDocument = {
  item: {
    name: string
    parentPath: string
  }
  duration: number
}
```

### Properties

#### `item`

- **Type:** `{ name: string; parentPath: string }`
- **Description:** An object containing information about the rendered page item.
  - `name` (`string`): The name of the rendered page (e.g., `index.html`, etc.).
  - `parentPath` (`string`): The file system path to the directory containing the rendered page, relative to the `pages` option provided when calling `coralite`.

#### `duration`

- **Type:** `number`
- **Description:** The time taken (in milliseconds) to render the document and its components.

## Technical Details

Under the hood, the `coralite` function performs the following tasks:

1. Reads HTML files from the specified `pages` directory.
2. Parses each page's content using the provided templates to create custom elements.
3. Renders each page using the created components and generates an HTML string.
4. Calculates the duration it took to render each document.
5. Optionally, ignores specific elements based on the `ignoreByAttribute` option during parsing.

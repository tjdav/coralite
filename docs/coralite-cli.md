# Coralite CLI

This technical documentation provides an in-depth overview of the Coralite CLI, its command-line options, and usage examples.

## Installation

Before using the Coralite CLI, ensure you have Node.js installed on your system. Then, install Coralite globally via npm:

```bash
npm install -g coralite
```

## Command Structure

The basic command structure for the Coralite CLI is as follows:

```bash
coralite [options]
```

## Options

The Coralite CLI accepts several options to configure its behavior. Here's a detailed list of available options:

- **`-t, --templates <path>`** (required)
  - Description: The file system path to the directory containing Coralite templates.
  - Example: `--templates ./path/to/templates`

- **`-p, --pages <path>`** (required)
  - Description: The file system path to the directory containing pages that will be rendered using the provided templates.
  - Example: `--pages ./path/to/pages`

- **`-o, --output <path>`** (required)
  - Description: The output directory for the generated site. If the specified directory does not exist, it will be created.
  - Example: `--output ./dist`

- **`-i, --ignore-attribute <key=value...>`** (optional)
  - Description: Ignore elements by attribute name-value pair during parsing. Multiple pairs can be provided separated by spaces.
  - Examples:
    - Ignore `<div data-ignore="true">` elements: `--ignore-attribute data-ignore=true`
    - Ignore multiple elements: `--ignore-attribute data-ignore=true class=test-only`

- **`-d, --dry-run`** (optional)
  - Description: Run the CLI in dry-run mode. This displays information about generated documents and their content without actually writing files to the output directory.
  - Example: `coralite -t ./path/to/templates -p ./path/to/pages -o ./dist --dry-run`

## Examples

1. **Generate a site with default options:**

```bash
coralite -t ./path/to/templates -p ./path/to/pages -o ./dist
```

2. **Ignore specific elements during parsing and run in dry-run mode:**

```bash
coralite -t ./path/to/templates -p ./path/to/pages -o ./dist --ignore-attribute data-ignore=true --dry-run
```

## Technical Details

Under the hood, the Coralite CLI does the following:

1. Parses command-line options using the `commander` library.
2. Validates and processes provided options (e.g., splits ignore attribute key-value pairs).
3. Calls the core `coralite` function with the parsed options.
4. Based on the `--dry-run` option, either displays generated document information or writes rendered HTML files to the specified output directory.

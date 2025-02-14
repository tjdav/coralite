# Getting Started: Basic templating

This guide will walk you through creating your first page using Coralite, a static site generator built around HTML modules.

## Project Structure

Create a new project directory with the following structure:

```
my-coralite-site/
├── src/
│   ├── templates/
│   │   ├── header.html
│   │   └── footer.html
│   └── pages/
│       └── index.html
└── dist/
```

## Creating Templates

Before creating the template files, there are few things to take note of:

1. Every template must have an `id` attribute that matches its usage in pages:
  ```html
  <template id="coralite-header">
  ```

2. Custom element names in pages must match template IDs:
  ```html
  <coralite-header title="My Title">
  ```

3. Data can be passed via attributes and accessed using double curly bracket syntax:
  ```html
  <!-- In your page -->
  <coralite-header title="Hello World">
  
  <!-- In your template -->
  <h1>{{ title }}</h1>
   ```

4. Templates can pass nested elements via `slots`

Let's create two basic templates:

### 1. Header Template (src/templates/header.html)

```html
<template id="coralite-header">
  <h1>{{ title }}</h1>
  <slot name="subtitle"></slot>
  <slot></slot>
</template>
```

### 2. Footer Template (src/templates/footer.html)

```html
<template id="coralite-footer">
  <footer>
    Just keep swimming.
  </footer>
</template>
```

## Building Your First Page

Create your main page in `src/pages/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First Coralite Page</title>
</head>
<body>
  <coralite-header title="Welcome to My Site">
    <span slot="subtitle">A Coralite Creation</span>
    <p>This is my first page built with Coralite!</p>
  </coralite-header>

  <coralite-footer></coralite-footer>
</body>
</html>
```

## Building Your Site

Generate your site using the Coralite CLI:

```bash
coralite --templates ./src/templates --pages ./src/pages --output ./dist
```

To preview changes without generating files, use the dry-run mode:

```bash
coralite --templates ./src/templates --pages ./src/pages --output ./dist --dry-run
```

## Next Steps

- Try creating more complex templates with multiple slots
- Explore nested components by using one component inside another
- Use the dry-run mode to debug template issues
- Check the [full documentation](https://github.com/tjdav/coralite) for advanced features

## Common Issues

1. If your templates aren't rendering, ensure:
  - Template IDs match the component names in your pages
  - All required attributes are provided
  - The Node.js `--experimental-vm-modules` flag is enabled

2. Missing content might indicate:
  - Incorrect slot names
  - Missing slot definitions in templates
  - Malformed template syntax

Remember to keep your templates modular and reusable for the best development experience with Coralite!
# Coralite library documentation

Coralite is designed to work with a structured project layout containing `templates` (reusable components) and `pages` (content to be rendered). Below are typical directory structures and file examples that illustrate how Coralite processes HTML files.

---

## 📁 Project Structure Example

A basic Coralite project might look like this:

```
my-coralite-project/
│
├── src/  
│   ├── templates/                // ✅ Templates used for rendering
│   │   ├── header.html           // Reusable template component
│   │   └── layout.html           // Base layout template
│   │
│   └── pages/                    // ✅ Pages to be rendered using templates
│       ├── index.html            // Main page with dynamic content
│       └── about.html            // Another page that uses templates
│
├── assets/                       // 📁 Optional: static files (CSS, images)
│   └── styles.css                // CSS file referenced by pages or templates
│
└── package.json                  // Project metadata and dependencies
```

---

## 📄 Template File Example (`src/templates/header.html`)

```html
<!-- header.html - A reusable template component -->
<template id="coralite-header">
  <header>
    <h1>{{ title }}</h1> <!-- Dynamic token placeholder -->
    <nav>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  </header>
</template>
```

This template defines a reusable header component with a dynamic `{{ title }}` token that will be replaced during rendering.

---

## 📄 Page File Example (`src/pages/index.html`)

```html
<!-- index.html - A page to be rendered using templates -->
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Homepage</title>
</head>  
<article data-page="home">
  <!-- Custom element - the attributes will be available as tokens in the template -->
  <coralite-module title="Hello world"></coralite-module>

  <section>
    <h2>Welcome</h2>
    <p>This is the homepage content.</p>
  </section>
</article>
</body>
</html>
```

This page includes a `coralite-header` element that references the `header.html` template and defines its own content.

---

## 📌 Ignored Element Example

If you want to exclude certain elements during rendering, use the `ignoreByAttribute` option:

```html
<!-- ignored-element.html -->
<div data-dev="true">This element will be ignored by Coralite.</div>
```

Then include it in your configuration:

```javascript
coralite({
  templates: './src/templates',
  pages: './src/pages',
  ignoreByAttribute: [['data-dev', 'true']]
})
.then(...)
```

---

## 📁 Recursive Template Example

Coralite can also process nested directories if enabled via the `recursive` option in advanced configurations. For example:

```
src/
├── templates/
│   └── components/
│       ├── button.html
│       └── card.html
└── pages/
    └── blog/
        └── post-1.html
```

Coralite will process all HTML files in `templates` and `pages`, including subdirectories.

---

## Usage Example  
```javascript
coralite({
  templates: './src/templates',
  pages: './src/pages',
  ignoreByAttribute: [['data-dev', 'true']]
})
.then(documents => {
  documents.forEach(({ document, html, duration }) => {
    console.log(`Rendered ${document.title} in ${duration}ms.`);
    console.log(html);
  });
})
.catch(console.error);
```

---

## Parameters  

| Name              | Type                      | Required | Description                                                                 |
|-------------------|---------------------------|----------|-----------------------------------------------------------------------------|
| `templates`       | `string`                  | ✅ Yes   | Absolute or relative path to the directory containing Coralite templates.   |
| `pages`           | `string`                  | ✅ Yes   | Absolute or relative path to the directory containing pages to render.      |
| `ignoreByAttribute` | `[string, string][]`    | ❌ No    | Array of attribute name/value pairs to exclude elements that contain any of the attributes during rendering (e.g., `[['data-dev', 'true']]`). |

---

## Return Value  

- **Type**: `Promise<Array<CoraliteResult>>`  
- **Description**: Resolves to an array of objects containing:  
  - `document`: The rendered [`CoraliteDocument`](./typedef.md#coralite-document) object.  
  - `html`: Raw HTML string output.  
  - `duration`: Render time in milliseconds.  

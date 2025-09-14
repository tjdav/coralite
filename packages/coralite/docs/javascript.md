# How to use javascript within a custom element

## Overview

The `script` function is a scoped execution environment within a custom element defined using `defineComponent`. It enables dynamic behavior and interactivity by accessing both computed values (tokens) and DOM references (`refs`) from the component’s template.

This guide explains how to use the `script` function in conjunction with the `defineComponent` API, focusing on its parameters: `values`, `refs`.

---

## Parameters

### `values`
- **Type**: Object  
- **Description**: Contains all computed values derived from declared tokens and attributes assigned to the custom element. Attributes are automatically converted to camel case (e.g., `first-name` → `firstName`).  
- **Access**: Available as key-value pairs within the object.

> Example:  
> ```js
> { firstName: "John", lastName: "Smith", fullName: "John Smith" }
> ```

### `refs`
- **Type**: Function (callable)  
- **Description**: A function that returns a DOM element based on the value of the `ref` attribute in the template. The argument passed to this function is the string identifier from the `ref` attribute.
- **Usage**: Call `refs('identifier')` to retrieve the corresponding element.

> Example:  
> ```js
> refs('author') → <span ref="author">...</span>
> ```

---

## Usage Guidelines

### 1. Declare Tokens in `tokens`
Use the `tokens` object to define dynamic computed values based on attributes or other tokens.

```js
tokens: {
  fullName ({ firstName, lastName }) {
    return firstName + ' ' + lastName;
  }
}
```

- **Note**: The function receives an object with available attribute values (in camel case).
- Output is stored in `values` and accessible within the `script` function.

### 2. Use `ref` Attributes in Template
Assign unique identifiers to DOM elements using the `ref` attribute inside `<template>`.

```html
<template id="coralite-footer">
  <footer class="text-center">
    Made by <span ref="author">{{ fullName }}</span>
  </footer>
</template>
```

- **Important**: The value of `ref` must be a string identifier (e.g., `"author"`).
- Elements with `ref` attributes are resolved via the `refs` function.

### 3. Implement Behavior in `script`
The `script` function runs once per component instantiation, allowing direct manipulation of DOM elements and access to computed values.

```js
script ({ values, refs }) {
  const authorElement = refs('author');
  
  // Add event listener to the referenced element
  authorElement.addEventListener('click', () => {
    console.log(values.fullName + ' Made this!');
  });

  // Log reference for debugging
  console.log(refs('author'));
}
```

---

## Example: Full Implementation

```html
<coralite-footer first-name="John" last-name="Smith"></coralite-footer>
```

```html
<template id="coralite-footer">
  <footer class="text-center">
    Made by <span ref="author">{{ fullName }}</span>
  </footer>
</template>

<script type="module">
  import { defineComponent } from 'coralite'

  export default defineComponent({
    tokens: {
      fullName ({ firstName, lastName }) {
        return firstName + ' ' + lastName;
      }
    },
    script ({ values, refs }) {
      const authorElement = refs('author');
      
      authorElement.addEventListener('click', () => {
        console.log(`${values.fullName} made this!`);
      });

      // Debug: Confirm element retrieval
      console.log(refs('author'));
    }
  });
</script>
```

---

## Summary

- The `script` function provides a powerful interface for component-level logic.
- It has access to:
  - `values`: computed attributes and tokens.
  - `refs`: DOM elements referenced via `ref` attribute.
- Use this function to attach event listeners, update styles, or trigger behaviors based on dynamic data.

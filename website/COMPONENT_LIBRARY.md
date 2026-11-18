# Coralite Component Library Manifest

This file is the absolute source of truth for UI composition. Do not use raw HTML for interactive widgets. Use these custom elements.

## Atoms

### `<ui-button>`
Use for **actions only** (submits, toggles, client-side handlers, form controls). Navigation belongs in `ui-link` or `ui-nav-link`.
**Attributes:**
- `variant`: `"primary"` (Violet, default), `"secondary"` (Outline), `"danger"` (Red).
- `type`: `"button"` (default), `"submit"`, `"reset"`.
- `disabled`: Boolean.
**Slots:**
- Default slot for button text.
**Example:**
<ui-button variant="primary" type="button">Save changes</ui-button>

### `<ui-link>`
Replaces `<a>` elements that need button styling. Use instead of wrapping `ui-button` in an anchor — a `<button>` inside an `<a>` is invalid and breaks keyboard navigation.
**Attributes:**
- `href`: Required destination.
- `variant`: `"primary"` (default), `"secondary"` (outline), `"danger"`. `"outline"` is accepted as an alias.
- `external`: Boolean. Adds `target="_blank"` and `rel="noopener noreferrer"`.
**Slots:**
- Default slot for link text.
**Example:**
<ui-link href="/learn/" variant="primary">Start Learning</ui-link>
<ui-link href="https://euroloom.eu/" variant="secondary" external>Visit website</ui-link>

### `<ui-card>`
Replaces all `<div class="card">` wrappers.
**Attributes:**
- `hoverable`: Boolean (adds a violet border glow on hover).
**Slots:**
- `header`: For the card title/heading.
- Default slot: For the card body text.
**Example:**
<ui-card hoverable>
  <h3 slot="header">Explicit Boundaries</h3>
  <p>No class extends HTMLElement.</p>
</ui-card>

### `<ui-badge>`
For small labels and pills.
**Attributes:**
- `variant`: `"violet"` (Lesson, default), `"cyan"` (Reference), `"amber"` (Warning).
**Slots:**
- Default slot for badge text.
**Example:**
<ui-badge variant="cyan">Reference API</ui-badge>

### `<code-block>`
Replaces raw `<pre><code>` tags. Handles syntax highlighting and the copy button automatically.
**Attributes:**
- `language`: `"html"`, `"javascript"`, `"bash"`, `"json"`.
**Slots:**
- Default slot for the code string. Must be raw HTML tags, not escaped entities.
**Example:**
<code-block language="html">
<div class="container">
  <h1>Hello</h1>
</div>
</code-block>

### `<ui-input>`
Replaces native text inputs.
**Attributes:**
- `type`: `"text"`, `"email"`, etc. (default: "text").
- `placeholder`: Placeholder text.
**Slots:**
- `icon-left`: Optional left icon (use `<ui-icon>`).
- `icon-right`: Optional right badge (e.g., `<kbd>Ctrl K</kbd>`).
**Example:**
<ui-input placeholder="Search...">
  <ui-icon slot="icon-left" name="search"></ui-icon>
  <kbd slot="icon-right">Ctrl K</kbd>
</ui-input>

### `<ui-icon>`
Renders a Solar icon.
**Attributes:**
- `name`: `"search"`, `"github"`, `"copy"`, `"check"`, `"chevron-down"`, `"chevron-left"`, `"chevron-right"`.
- `size`: Number (default: 16).
**Example:**
<ui-icon name="search"></ui-icon>

### `<ui-toggle>`
Two-option segmented control.
**Attributes:**
- `active`: `"left"` (default) or `"right"`.
**Slots:**
- `left`: Label for the left option.
- `right`: Label for the right option.
**Example:**
<ui-toggle active="left">
  <span slot="left">Authored</span>
  <span slot="right">Compiled</span>
</ui-toggle>

### `<ui-nav-link>`
Sidebar navigation link.
**Attributes:**
- `href`: URL (required).
- `active`: Boolean (highlights the link).
**Slots:**
- Default slot for link text.
**Example:**
<ui-nav-link href="/learn/the-document" active>1. The Document</ui-nav-link>

### `<ui-accordion>`
Collapsible sidebar group using native `<details>`.
**Attributes:**
- `title`: Accordion header text (required).
- `open`: Boolean (default: false).
**Slots:**
- Default slot for the accordion body (usually `<ui-nav-link>` elements).
**Example:**
<ui-accordion title="Module 1: HTML Foundations" open>
  <ui-nav-link href="#" active>1. The Document</ui-nav-link>
</ui-accordion>

### `<ui-breadcrumb>`
Breadcrumb navigation.
**Attributes:** None.
**Slots:**
- Default slot for `<a>` links and `<span class="separator">/</span>`.
**Example:**
<ui-breadcrumb>
  <a href="#">Learn</a>
  <span class="separator">/</span>
  <span>Lesson 1</span>
</ui-breadcrumb>

### `<ui-tooltip>`
Floating tooltip using Floating UI.
**Attributes:**
- `placement`: `"top"` (default), `"bottom"`, `"left"`, `"right"`.
**Slots:**
- `reference`: The trigger element (e.g., a `<ui-button>`).
- Default slot: The tooltip text.
**Example:**
<ui-tooltip placement="top">
  <ui-button slot="reference" variant="secondary">Hover me</ui-button>
  <span>Tree-shaken server code</span>
</ui-tooltip>

### `<ui-avatar>`
User avatar with initials.
**Attributes:**
- `initials`: String (default: "?").
- `size`: `"sm"` (32px), `"md"` (48px), `"lg"` (80px).
**Example:**
<ui-avatar initials="TD" size="md"></ui-avatar>

### `<ui-terminal>`
CLI output window.
**Attributes:** None.
**Slots:**
- Default slot for terminal text. Use `<span class="prompt">$</span>`, `<span class="success">✔</span>`, `<span class="warning">✖</span>`.
**Example:**
<ui-terminal>
<span class="prompt">$</span> coralite build
<span class="success">✔</span> Successfully compiled.
</ui-terminal>

## Organisms

### `<site-header>`
The global top navigation bar.
**Attributes:** None.
**Slots:** None.
**Example:**
<site-header></site-header>

### `<site-footer>`
The global bottom footer.
**Attributes:** None.
**Slots:** None.
**Example:**
<site-footer></site-footer>

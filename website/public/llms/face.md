# Form-Associated Custom Elements (FACE)

> Building accessible, native-participating form controls with Coralite.

## 1. Opt-In Configuration

To turn a custom element into a Form-Associated Custom Element, declare `export const formControl = true`:

```html
<template id="custom-input">
  <div class="input-wrapper">
    <label for="native-input">{{ label }}</label>
    <input ref="input" id="native-input" value="{{ value }}" placeholder="{{ placeholder }}" />
  </div>
</template>

<script type="module">
  export const formControl = true

  export const attributes = {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    required: { type: Boolean, default: false }
  }

  export function client ({
    state,
    refs,
    signal,
    setFormValue,
    setValidity,
    checkValidity,
    reportValidity,
    onFormReset,
    onFormDisabled,
    onFormRestore,
    observe
  }) {
    const input = refs('input')

    // 1. Initial form synchronization
    setFormValue(state.value)
    if (state.required && !state.value) {
      setValidity({ valueMissing: true }, 'This field is required', input)
    } else {
      setValidity({})
    }

    // 2. React to user inputs
    input.addEventListener('input', (e) => {
      state.value = e.target.value
    }, { signal })

    // 3. React to state changes
    observe('value', (newVal) => {
      setFormValue(newVal)
      if (state.required && !newVal) {
        setValidity({ valueMissing: true }, 'This field is required', input)
      } else {
        setValidity({})
      }
    })

    // 4. Native form lifecycle hooks
    onFormReset(() => {
      state.value = ''
      input.value = ''
    })

    onFormDisabled((disabled) => {
      input.disabled = disabled
    })

    onFormRestore((restoredValue) => {
      state.value = restoredValue
    })
  }
</script>
```

## 2. Injected FACE Context Helpers

When `formControl = true` is declared, the `client()` context receives:
* **`setFormValue(value, state?)`**: Sets the element's form submission value and state.
* **`setValidity(flags, message?, anchor?)`**: Sets native constraint validation flags (`ValidityStateFlags`).
* **`checkValidity()`**: Evaluates validity without reporting.
* **`reportValidity()`**: Triggers browser constraint validation popup.
* **`internals`**: The underlying `ElementInternals` instance.
* **`form`**: Associated parent `HTMLFormElement`.
* **`onFormReset(callback)`**: Invoked on `<form reset>`.
* **`onFormDisabled(callback)`**: Invoked when form or `<fieldset>` disabled state toggles.
* **`onFormRestore(callback)`**: Invoked on browser autofill / session restore.

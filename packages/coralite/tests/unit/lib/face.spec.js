import '../setup.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoraliteClass } from '../../../lib/coralite-element.js'
import { createComponentDefinition } from '../../../lib/component-setup.js'
import { ScriptManager } from '../../../lib/script-manager.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

test('Form-Associated Custom Elements (FACE)', async (t) => {

  await t.test('1. Explicit Opt-In Policy', () => {
    const NonFormClass = createCoraliteClass({
      componentId: 'c-non-form'
    })
    customElements.define('c-non-form', NonFormClass)
    const nonFormEl = new NonFormClass()
    assert.equal(NonFormClass.formAssociated, false)
    assert.equal(nonFormEl._internals, null)

    const FormClass = createCoraliteClass({
      componentId: 'c-form-input',
      formAssociated: true
    })
    customElements.define('c-form-input', FormClass)
    const formEl = new FormClass()
    assert.equal(FormClass.formAssociated, true)
    assert.notEqual(formEl._internals, null)
  })

  await t.test('2. Form Value Auto-Sync and Manual setFormValue Override', () => {
    let clientCtx = null
    const FormInputClass = createCoraliteClass({
      componentId: 'c-auto-sync-input',
      formAssociated: true,
      defaultValues: { value: 'initial' },
      client (ctx) {
        clientCtx = ctx
      }
    })
    const tag = 'c-auto-sync-input'
    customElements.define(tag, FormInputClass)
    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.equal(el._internals._formValue, 'initial')

    el._state.value = 'updated'
    assert.equal(el._internals._formValue, 'updated')

    clientCtx.setFormValue('custom-override')
    assert.equal(el._internals._formValue, 'custom-override')

    document.body.removeChild(el)
  })

  await t.test('3. Schema Validation to Native Form Validity Bridge and Manual Latching', () => {
    let clientCtx = null
    const ValidatedInputClass = createCoraliteClass({
      componentId: 'c-validated-input',
      formAssociated: true,
      attributes: {
        value: {
          type: String,
          validate (val) {
            if (!val || val.length < 3) return 'Value must be at least 3 characters long.'
            return true
          }
        }
      },
      client (ctx) {
        clientCtx = ctx
      }
    })
    const tag = 'c-validated-input'
    customElements.define(tag, ValidatedInputClass)
    const el = document.createElement(tag)
    document.body.appendChild(el)

    el._state.value = 'a'
    assert.equal(el.checkValidity(), false)
    assert.equal(el.validity.customError, true)
    assert.equal(el.validationMessage, 'Value must be at least 3 characters long.')

    clientCtx.setValidity({ valueMissing: true }, 'Manual required error')
    assert.equal(el.checkValidity(), false)
    assert.equal(el.validity.valueMissing, true)
    assert.equal(el.validationMessage, 'Manual required error')

    el._state.value = 'abcde'
    assert.equal(el.validity.valueMissing, true)

    clientCtx.setValidity({})
    assert.equal(el.checkValidity(), true)
    assert.equal(el.validity.customError, false)

    document.body.removeChild(el)
  })

  await t.test('4. new FormData(form) Integration with Custom Elements', () => {
    const CustomInputClass = createCoraliteClass({
      componentId: 'c-form-data-input',
      formAssociated: true,
      defaultValues: { value: 'form-data-val' }
    })
    const tag = 'c-form-data-input'
    customElements.define(tag, CustomInputClass)

    const form = document.createElement('form')
    document.body.appendChild(form)
    const customInput = document.createElement(tag)
    customInput.setAttribute('name', 'customField')
    form.appendChild(customInput)

    const fd = new FormData(form)
    assert.equal(fd.get('customField'), 'form-data-val')

    document.body.removeChild(form)
  })

  await t.test('5. Form Reset Callback and onFormReset Context Hook', () => {
    let resetHookCalled = false
    const ResettableClass = createCoraliteClass({
      componentId: 'c-resettable',
      formAssociated: true,
      attributes: {
        value: {
          type: String,
          default: 'default-value'
        }
      },
      client (ctx) {
        ctx.onFormReset(() => {
          resetHookCalled = true
        })
      }
    })
    const tag = 'c-resettable'
    customElements.define(tag, ResettableClass)
    const el = document.createElement(tag)
    document.body.appendChild(el)

    el._state.value = 'mutated-value'
    assert.equal(el._state.value, 'mutated-value')
    assert.equal(el._internals._formValue, 'mutated-value')

    el.formResetCallback()
    assert.equal(el._state.value, 'default-value')
    assert.equal(el._internals._formValue, 'default-value')
    assert.equal(resetHookCalled, true)

    document.body.removeChild(el)
  })

  await t.test('6. Fieldset Disabled Cascading and Pre-Hydration Handling', () => {
    let disabledHookValue = null
    const DisabledClass = createCoraliteClass({
      componentId: 'c-disabled-input',
      formAssociated: true,
      attributes: {
        disabled: {
          type: Boolean,
          default: false
        }
      },
      client (ctx) {
        ctx.onFormDisabled((disabled) => {
          disabledHookValue = disabled
        })
      }
    })
    const tag = 'c-disabled-input'
    customElements.define(tag, DisabledClass)

    const el = document.createElement(tag)
    el.formDisabledCallback(true)
    document.body.appendChild(el)

    assert.equal(el._state.disabled, true)

    el.formDisabledCallback(false)
    assert.equal(el._state.disabled, false)
    assert.equal(disabledHookValue, false)

    document.body.removeChild(el)
  })

  await t.test('7. Form State Restore Callback', () => {
    let restoredState = null
    let restoredMode = null
    const RestoreClass = createCoraliteClass({
      componentId: 'c-restore-input',
      formAssociated: true,
      defaultValues: { value: 'initial' },
      client (ctx) {
        ctx.onFormRestore((state, mode) => {
          restoredState = state
          restoredMode = mode
        })
      }
    })
    const tag = 'c-restore-input'
    customElements.define(tag, RestoreClass)
    const el = document.createElement(tag)
    document.body.appendChild(el)

    el.formStateRestoreCallback('restored-value', 'restore')
    assert.equal(el._state.value, 'restored-value')
    assert.equal(el._internals._formValue, 'restored-value')
    assert.equal(restoredState, 'restored-value')
    assert.equal(restoredMode, 'restore')

    document.body.removeChild(el)
  })

  await t.test('8. Host DOM Properties and Schema Property Shadowing', () => {
    const HostPropsClass = createCoraliteClass({
      componentId: 'c-host-props',
      formAssociated: true,
      attributes: {
        name: { type: String, default: 'customName' },
        value: { type: String, default: 'customValue' }
      }
    })
    const tag = 'c-host-props'
    customElements.define(tag, HostPropsClass)
    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.equal(el.name, 'customName')
    assert.equal(el.value, 'customValue')
    assert.equal(el.type, tag)

    el.name = 'newName'
    assert.equal(el.name, 'newName')
    assert.equal(el._state.name, 'newName')

    document.body.removeChild(el)
  })

  await t.test('9. form attribute association: state string vs context form property and external by-id association', () => {
    let ctxFormRes = null
    const FormAttrClass = createCoraliteClass({
      componentId: 'c-form-attr',
      formAssociated: true,
      client (ctx) {
        ctxFormRes = ctx.form
      }
    })
    const tag = 'c-form-attr'
    customElements.define(tag, FormAttrClass)

    // Nested element with an unresolvable form attribute: state keeps the raw string,
    // while the live context form property resolves to the containing form.
    const form = document.createElement('form')
    document.body.appendChild(form)
    const el = document.createElement(tag)
    el.setAttribute('form', 'outside-form-id')
    form.appendChild(el)

    assert.equal(el._state.form, 'outside-form-id')
    assert.equal(ctxFormRes, form)

    // External association: a form attribute referencing an existing form id
    const externalForm = document.createElement('form')
    externalForm.id = 'login-form'
    document.body.appendChild(externalForm)

    const externalEl = document.createElement(tag)
    externalEl.setAttribute('form', 'login-form')
    document.body.appendChild(externalEl)

    assert.equal(externalEl.form, externalForm)

    document.body.removeChild(form)
    document.body.removeChild(externalEl)
    document.body.removeChild(externalForm)
  })

  await t.test('10. Dev Warning for non-form-associated component setFormValue/setValidity call', () => {
    let warningMsg = ''
    const originalWarn = console.warn
    console.warn = (msg) => {
      warningMsg = msg
    }

    let clientCtx = null
    const NonFormClass = createCoraliteClass({
      componentId: 'c-non-form-warn',
      client (ctx) {
        clientCtx = ctx
      }
    })
    const tag = 'c-non-form-warn'
    customElements.define(tag, NonFormClass)
    const el = document.createElement(tag)
    document.body.appendChild(el)

    clientCtx.setFormValue('foo')
    assert.match(warningMsg, /Coralite Warning: setFormValue\(\) called on component "c-non-form-warn"/)

    warningMsg = ''
    clientCtx.setValidity({ customError: true }, 'error')
    assert.match(warningMsg, /Coralite Warning: setValidity\(\) called on component "c-non-form-warn"/)

    console.warn = originalWarn
    document.body.removeChild(el)
  })

  await t.test('11. Build Pipeline Propagation and Option Validation', async () => {
    let warningLogged = null
    const defineComponent = createComponentDefinition({
      app: {
        onError: (errData) => {
          warningLogged = errData
        }
      }
    })

    // Test validation of formAssociated type
    await assert.rejects(
      async () => {
        await defineComponent({ formAssociated: 'not-a-bool' }, {
          state: {},
          module: { id: 'invalid-face' },
          root: null
        })
      },
      (err) => err instanceof CoraliteError && err.message.includes('formAssociated" must be a boolean')
    )

    // Test unknown option warning
    await defineComponent({ formAssociated: true, someUnknownKey: 'invalid' }, {
      state: {},
      module: { id: 'warn-comp' },
      root: null
    })
    assert.ok(warningLogged)
    assert.equal(warningLogged.level, 'WARN')
    assert.equal(warningLogged.type, 'unknown_option')
    assert.match(warningLogged.message, /specifies unknown option "someUnknownKey"/)

    // Test successful propagation through defineComponent
    const setupState = await defineComponent({
      formAssociated: true,
      attributes: { value: String }
    }, {
      state: {},
      module: { id: 'c-pipeline-test' },
      root: null
    })
    assert.equal(setupState.__script__.formAssociated, true)

    // Test compilation through ScriptManager
    const sm = new ScriptManager()
    try {
      sm.registerComponent({
        id: 'c-pipeline-test',
        formAssociated: setupState.__script__.formAssociated,
        script: { content: '() => {}' }
      })

      const buildResult = await sm.compileComponents('development')
      const chunkHash = buildResult.manifest['c-pipeline-test'].js || buildResult.manifest['c-pipeline-test']
      const emittedCode = buildResult.outputFiles[chunkHash]
      assert.ok(emittedCode)
      const codeStr = typeof emittedCode === 'string' ? emittedCode : (emittedCode.text || String(emittedCode))
      // Esbuild compiles formAssociated: true to formAssociated: !0 or formAssociated: true
      assert.ok(codeStr.includes('formAssociated: !0') || codeStr.includes('formAssociated: true'))
    } finally {
      await sm.disposeContext()
    }
  })

  await t.test('12. Reconnection Lifecycle Clears and Re-registers Callback Sets', async () => {
    let resetCount = 0
    const ReconnectClass = createCoraliteClass({
      componentId: 'c-reconnect-face',
      formAssociated: true,
      client (ctx) {
        ctx.onFormReset(() => {
          resetCount++
        })
      }
    })
    const tag = 'c-reconnect-face'
    customElements.define(tag, ReconnectClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.equal(el._formResetCallbacks.size, 1)

    // Disconnect: _teardownLifecycle runs in a microtask
    document.body.removeChild(el)
    await new Promise(r => queueMicrotask(r))
    assert.equal(el._formResetCallbacks.size, 0)

    // Reconnect: revived element should re-run client() and re-register callback
    document.body.appendChild(el)
    assert.equal(el._formResetCallbacks.size, 1)

    el.formResetCallback()
    assert.equal(resetCount, 1)

    document.body.removeChild(el)
  })

  await t.test('13. FormData Polyfill Nested-Form Protection Guard', () => {
    const GuardInputClass = createCoraliteClass({
      componentId: 'c-inner-face',
      formAssociated: true,
      defaultValues: { value: 'guard-val' }
    })
    const tag = 'c-inner-face'
    customElements.define(tag, GuardInputClass)

    const form = document.createElement('form')
    document.body.appendChild(form)

    const el1 = document.createElement(tag)
    el1.setAttribute('name', 'field1')
    form.appendChild(el1)

    const el2 = document.createElement(tag)
    el2.setAttribute('name', 'field2')
    // Simulate an element inside a nested sub-form or shadow root whose closest form is not this form
    const otherForm = document.createElement('form')
    el2.closest = (sel) => (sel === 'form' ? otherForm : null)
    form.appendChild(el2)

    const fd = new FormData(form)
    assert.equal(fd.get('field1'), 'guard-val')
    // field2 must be excluded because el2.closest('form') !== form
    assert.equal(fd.get('field2'), null)

    document.body.removeChild(form)
  })

  await t.test('14. Context internals Exposure', () => {
    let capturedInternals = undefined
    const InternalsCheckClass = createCoraliteClass({
      componentId: 'c-internals-check',
      formAssociated: true,
      client (ctx) {
        capturedInternals = ctx.internals
      }
    })
    const tag = 'c-internals-check'
    customElements.define(tag, InternalsCheckClass)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    assert.notEqual(capturedInternals, null)
    assert.equal(capturedInternals, el._internals)

    document.body.removeChild(el)
  })

  await t.test('15. Context form, validity, validationMessage getters & onForm* hooks', () => {
    let capturedCtx = null
    const ContextGetterClass = createCoraliteClass({
      componentId: 'c-context-getters',
      formAssociated: true,
      attributes: {
        value: {
          type: String,
          default: '',
          validate: (val) => (!val || val.length >= 3) || 'Must be at least 3 characters'
        }
      },
      client (ctx) {
        capturedCtx = ctx
      }
    })
    const tag = 'c-context-getters'
    customElements.define(tag, ContextGetterClass)

    const form = document.createElement('form')
    document.body.appendChild(form)
    const el = document.createElement(tag)
    form.appendChild(el)

    // Verify hooks exist
    assert.equal(typeof capturedCtx.onFormReset, 'function')
    assert.equal(typeof capturedCtx.onFormDisabled, 'function')
    assert.equal(typeof capturedCtx.onFormRestore, 'function')

    // Verify form, validity, validationMessage are GETTERS, not function methods
    assert.equal(typeof capturedCtx.form, 'object')
    assert.equal(capturedCtx.form, form)

    assert.equal(typeof capturedCtx.validity, 'object')
    assert.equal(capturedCtx.validity.valid, true)

    // checkValidity() is a live method reflecting the current validity state
    assert.equal(typeof capturedCtx.checkValidity(), 'boolean')
    assert.equal(capturedCtx.checkValidity(), true)

    assert.equal(typeof capturedCtx.validationMessage, 'string')
    assert.equal(capturedCtx.validationMessage, '')

    // Mutate state to invalid and verify live getter reflects without function call
    el._state.value = 'ab'
    assert.equal(capturedCtx.validity.valid, false)
    assert.equal(capturedCtx.validity.customError, true)
    assert.equal(capturedCtx.validationMessage, 'Must be at least 3 characters.')

    document.body.removeChild(form)
  })
})

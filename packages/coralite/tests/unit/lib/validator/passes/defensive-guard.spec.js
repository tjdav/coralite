import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateComponentSource } from '../../../../../lib/server/component/validator.js'

describe('CORALITE-W601 Defensive Guard Validator Pass', () => {
  it('fires CORALITE-W601 on if (!lists) return in client()', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client ({ lists }) {
            if (!lists) return
            lists.bind()
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.ok(diag)
    assert.equal(diag.severity, 'error')
    assert.match(diag.message, /Defensive guard on context key "lists" in client\(\)/)
  })

  it('fires CORALITE-W601 on if (router == null) return in client()', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client ({ router }) {
            if (router == null) return
            router.navigate('/')
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.ok(diag)
    assert.match(diag.message, /Defensive guard on context key "router" in client\(\)/)
  })

  it('fires CORALITE-W601 on if (!state) return in server()', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          server ({ state }) {
            if (!state) return
            return { ok: true }
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.ok(diag)
    assert.match(diag.message, /Defensive guard on context key "state" in server\(\)/)
  })

  it('fires CORALITE-W601 on if (!state) return in getter', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            doubled: ({ state }) => {
              if (!state) return 0
              return state.count * 2
            }
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.ok(diag)
    assert.match(diag.message, /Defensive guard on context key "state" in getters/)
  })

  it('fires CORALITE-W601 on typeof window === "undefined" in client()', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client () {
            if (typeof window === 'undefined') return
            window.addEventListener('click', () => {})
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.ok(diag)
    assert.match(diag.message, /"typeof window === 'undefined'" in client\(\) is always false/)
  })

  it('fires CORALITE-W601 on typeof window !== "undefined" in server()', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          server () {
            if (typeof window !== 'undefined') {
              console.log('browser')
            }
            return { ok: true }
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.ok(diag)
    assert.match(diag.message, /"typeof window !== 'undefined'" in server\(\) is always false/)
  })

  it('fires CORALITE-W601 on optional chaining lists?.createStore() in client()', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client ({ lists }) {
            const store = lists?.createStore()
            return store
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.ok(diag)
    assert.match(diag.message, /Defensive guard on context key "lists" in client\(\)/)
  })

  it('does NOT fire CORALITE-W601 on user property access if (!state.user) return', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client ({ state }) {
            if (!state.user) return
            console.log(state.user)
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.equal(diag, undefined)
  })

  it('does NOT fire CORALITE-W601 on user-data optional chaining state.user?.name', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client ({ state }) {
            const userName = state.user?.name
            console.log(userName)
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.equal(diag, undefined)
  })

  it('does NOT fire CORALITE-W601 on local variable existence check if (!btn) return', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client ({ refs }) {
            const btn = refs('button')
            if (!btn) return
            btn.click()
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.equal(diag, undefined)
  })

  it('does NOT fire CORALITE-W601 on isServer ternary branch', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            greeting: ({ isServer }) => (isServer ? 'SSR' : 'Client')
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.equal(diag, undefined)
  })

  it('does NOT fire CORALITE-W601 on top-level module typeof window check', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'

        const isBrowser = typeof window !== 'undefined'

        export default defineComponent({
          client () {
            if (isBrowser) {
              console.log('browser')
            }
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.equal(diag, undefined)
  })

  it('does NOT fire CORALITE-W601 on process.env.NODE_ENV development check', () => {
    const code = `
      <template id="x-test"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client () {
            if (process.env.NODE_ENV === 'development') {
              console.log('dev mode')
            }
          }
        })
      </script>
    `
    const res = validateComponentSource(code, 'test.html')
    const diag = res.diagnostics.find(d => d.code === 'CORALITE-W601')
    assert.equal(diag, undefined)
  })
})

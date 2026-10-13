import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateComponentSource } from '../../../../lib/server/component/validator.js'
import { validatePageSource } from '../../../../lib/server/page/validator.js'

describe('CORALITE-E401 session / HTTP context detection', () => {
  it('fires CORALITE-E401 when server() references headers', () => {
    const code = `<template id="x-test"><div></div></template>
<script>
export default defineComponent({
  server() {
    console.log(headers)
  }
})
</script>`
    const res = validateComponentSource(code, 'x-test.html')
    const e401 = res.diagnostics.find(d => d.code === 'CORALITE-E401')
    assert.ok(e401, 'Should emit CORALITE-E401 for headers')
    assert.equal(e401.severity, 'warning')
    assert.match(e401.message, /"headers" is not available in server\(\)/)
  })

  it('fires CORALITE-E401 when server() references cookies and cookie', () => {
    const code = `<template id="x-test"><div></div></template>
<script>
export default defineComponent({
  server() {
    console.log(cookies, cookie)
  }
})
</script>`
    const res = validateComponentSource(code, 'x-test.html')
    const e401s = res.diagnostics.filter(d => d.code === 'CORALITE-E401')
    assert.equal(e401s.length, 2)
    assert.ok(e401s.some(d => d.message.includes('"cookies"')))
    assert.ok(e401s.some(d => d.message.includes('"cookie"')))
  })

  it('fires CORALITE-E401 for request, response, req, res', () => {
    const code = `<template id="x-test"><div></div></template>
<script>
export default defineComponent({
  server() {
    const a = request
    const b = response
    const c = req
    const d = res
  }
})
</script>`
    const res = validateComponentSource(code, 'x-test.html')
    const e401s = res.diagnostics.filter(d => d.code === 'CORALITE-E401')
    assert.equal(e401s.length, 4)
  })

  it('does NOT fire E401 when identifier is locally declared (shadowed)', () => {
    const code = `<template id="x-test"><div></div></template>
<script>
export default defineComponent({
  server() {
    const headers = { 'content-type': 'text/html' }
    console.log(headers)
  }
})
</script>`
    const res = validateComponentSource(code, 'x-test.html')
    const e401 = res.diagnostics.find(d => d.code === 'CORALITE-E401')
    assert.equal(e401, undefined, 'Shadowed local identifier should not trigger E401')
  })

  it('does NOT fire E401 for property accesses like config.headers or object keys', () => {
    const code = `<template id="x-test"><div></div></template>
<script>
export default defineComponent({
  server() {
    const config = { headers: { accept: 'application/json' } }
    console.log(config.headers)
  }
})
</script>`
    const res = validateComponentSource(code, 'x-test.html')
    const e401 = res.diagnostics.find(d => d.code === 'CORALITE-E401')
    assert.equal(e401, undefined, 'Property keys and member properties should not trigger E401')
  })

  it('does NOT fire E401 for string literals containing identifier names', () => {
    const code = `<template id="x-test"><div></div></template>
<script>
export default defineComponent({
  server() {
    fetch('https://api.example.com/headers')
  }
})
</script>`
    const res = validateComponentSource(code, 'x-test.html')
    const e401 = res.diagnostics.find(d => d.code === 'CORALITE-E401')
    assert.equal(e401, undefined, 'String literal should not trigger E401')
  })

  it('does NOT fire E401 for client() block references', () => {
    const code = `<template id="x-test"><div></div></template>
<script>
export default defineComponent({
  client() {
    const req = fetch('/api')
  }
})
</script>`
    const res = validateComponentSource(code, 'x-test.html')
    const e401 = res.diagnostics.find(d => d.code === 'CORALITE-E401')
    assert.equal(e401, undefined, 'client() block should not trigger E401')
  })

  it('fires CORALITE-E401 in page server() blocks', () => {
    const code = `<!DOCTYPE html>
<html>
<head>
  <script>
    export default definePage({
      server() {
        console.log(headers)
      }
    })
  </script>
</head>
<body></body>
</html>`
    const res = validatePageSource(code, 'page.html')
    const e401 = res.diagnostics.find(d => d.code === 'CORALITE-E401')
    assert.ok(e401, 'Page server() block referencing headers should trigger E401')
    assert.match(e401.message, /"headers" is not available in server\(\)/)
  })

  it('respects coralite-ignore E401 pragma', () => {
    const code = `<template id="x-test"><div></div></template>
<!-- coralite-ignore E401 -->
<script>
export default defineComponent({
  server() {
    console.log(headers)
  }
})
</script>`
    const res = validateComponentSource(code, 'x-test.html')
    const e401 = res.diagnostics.find(d => d.code === 'CORALITE-E401')
    assert.equal(e401, undefined, 'coralite-ignore E401 should suppress diagnostic')
  })
})

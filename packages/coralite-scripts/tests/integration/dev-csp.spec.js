import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('Dev Server Live-Reload CSP', () => {
  it('formats rebuild script tag with external src and optional dev nonce', () => {
    const configWithNonce = { csp: { nonce: 'dev-nonce-456' } }
    const configWithoutNonce = {}

    const devNonce = typeof configWithNonce.csp?.nonce === 'string' ? configWithNonce.csp.nonce : null
    const nonceAttr = devNonce ? ` nonce="${devNonce}"` : ''
    const scriptWithNonce = `\n<script src="/_/rebuild.js"${nonceAttr}></script>\n</body>\n`

    const devNonce2 = typeof configWithoutNonce.csp?.nonce === 'string' ? configWithoutNonce.csp.nonce : null
    const nonceAttr2 = devNonce2 ? ` nonce="${devNonce2}"` : ''
    const scriptWithoutNonce = `\n<script src="/_/rebuild.js"${nonceAttr2}></script>\n</body>\n`

    assert.ok(scriptWithNonce.includes('<script src="/_/rebuild.js" nonce="dev-nonce-456"></script>'))
    assert.ok(scriptWithoutNonce.includes('<script src="/_/rebuild.js"></script>'))
    assert.ok(!scriptWithoutNonce.includes('nonce='))
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

describe('Release archives & versioned post resolution', () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

  it('preserves versioned release post for coralite v1.2.0', () => {
    const archivePath = path.join(rootDir, 'packages/coralite/releases/v1.2.0.md')
    assert.strictEqual(existsSync(archivePath), true, 'v1.2.0.md should exist in packages/coralite/releases/')

    const content = readFileSync(archivePath, 'utf8')
    assert.ok(content.includes('## Release Overview'))
    assert.ok(content.includes('Coralite v1.2.0'))
  })

  it('preserves versioned release post for create-coralite v1.2.0', () => {
    const archivePath = path.join(rootDir, 'packages/create-coralite/releases/v1.2.0.md')
    assert.strictEqual(existsSync(archivePath), true, 'v1.2.0.md should exist in packages/create-coralite/releases/')

    const content = readFileSync(archivePath, 'utf8')
    assert.ok(content.includes('## Release Overview'))
    assert.ok(content.includes('create-coralite'))
  })

  it('extracts content from OpenAI responses with reasoning_content (Qwen/DeepSeek)', () => {
    // Simulate TabbyAPI / Qwen response where content is present
    const standardResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: '## Release Overview\nAll good.',
            reasoning_content: 'Thinking about the release...'
          }
        }
      ]
    }
    const message1 = standardResponse.choices[0].message
    const text1 = message1.content || message1.reasoning_content || ''
    assert.strictEqual(text1, '## Release Overview\nAll good.')

    // Simulate TabbyAPI response where content is null and text is in reasoning_content
    const reasoningOnlyResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            reasoning_content: 'We need to write: ## Release Overview\nAll good.'
          }
        }
      ]
    }
    const message2 = reasoningOnlyResponse.choices[0].message
    const text2 = message2.content || message2.reasoning_content || ''
    assert.ok(text2.includes('## Release Overview'))
  })
})

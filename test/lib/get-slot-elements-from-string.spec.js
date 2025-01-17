import { deepStrictEqual } from 'node:assert'
import { describe, it } from 'node:test'
import { getSlotElementsFromString } from '#lib'

describe('Slots', function () {
  it('should get default slot and it\'s content', function () {
    const input = '<p><slot>My default text</slot></p>'
    const slots = getSlotElementsFromString(input)

    deepStrictEqual(slots, [
      {
        name: 'default',
        content: 'My default text',
        input
      }
    ])
  })

  it('should get named slot and it\'s content', function () {
    const input = '<p><slot name="my-text">My default text</slot></p>'
    const slots = getSlotElementsFromString(input)

    deepStrictEqual(slots, [
      {
        name: 'my-text',
        content: 'My default text',
        input
      }
    ])
  })

  it('should get named slot, default slot and their content', function () {
    const input = '<p><slot>Default slot</slot><slot name="my-text">My default text</slot></p>'
    const slots = getSlotElementsFromString(input)

    deepStrictEqual(slots, [
      {
        name: 'default',
        content: 'Default slot',
        input
      },
      {
        name: 'my-text',
        content: 'My default text',
        input: input
      }
    ])
  })

  it('should not extract duplicate default slots', function () {
    const input = '<p><slot>Default slot</slot><slot>My default text</slot></p>'
    const slots = getSlotElementsFromString(input)

    deepStrictEqual(slots, [
      {
        name: 'default',
        content: 'Default slot',
        input
      }
    ])
  })

  it('should not extract duplicate named slots', function () {
    const input = '<p><slot name="my-text">Default slot</slot><slot name="my-text">My default text</slot></p>'
    const slots = getSlotElementsFromString(input)

    deepStrictEqual(slots, [
      {
        name: 'my-text',
        content: 'Default slot',
        input
      }
    ])
  })
})

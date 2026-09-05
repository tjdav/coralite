import { createContext, ContextRequestEvent } from 'coralite'

// 1. Symbol-based context token
export const themeSymbolToken = createContext(Symbol.for('coralite.test.theme'))

// 2. Object-reference context token
export const userObjectToken = createContext({ id: 'coralite.test.user' })

// 3. String context token
export const settingStringToken = createContext('coralite.test.setting')

export { ContextRequestEvent, createContext }

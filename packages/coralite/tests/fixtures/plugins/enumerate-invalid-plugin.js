import { definePlugin } from '../../../../lib/server/plugin/define.js'

export const enumerateInvalidPlugin = (invalidValue) => definePlugin({
  name: 'enumerate-invalid-plugin',
  server: {
    onPageSet ({ page }) {
      if (page.file.filename !== '[slug].html') return
      return { paths: invalidValue }
    }
  }
})

export default enumerateInvalidPlugin

import { definePlugin } from 'coralite'

const moduleConst = 'plugin_module_const_preserved'
const moduleFn = () => 'plugin_module_fn_preserved'
const hasFileURLToPath = typeof fileURLToPath !== 'undefined'

export default definePlugin({
  name: 'scope-probe-plugin',
  client: {
    context: (pluginContext) => (instanceContext) => {
      let constVal, fnVal, fileUrlVal
      try { constVal = moduleConst } catch (e) { constVal = `ERR:${e.message}` }
      try { fnVal = moduleFn() } catch (e) { fnVal = `ERR:${e.message}` }
      try { fileUrlVal = hasFileURLToPath } catch (e) { fileUrlVal = `ERR:${e.message}` }

      console.log('[plugin-scope][client]', {
        moduleConst: constVal,
        moduleFn: fnVal,
        hasFileURLToPath: fileUrlVal
      })

      return {
        scopeProbe: {
          moduleConst: constVal,
          moduleFn: fnVal,
          hasFileURLToPath: fileUrlVal
        }
      }
    }
  }
})

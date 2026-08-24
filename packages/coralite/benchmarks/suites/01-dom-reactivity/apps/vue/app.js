import { createApp, shallowRef, ref, h } from 'vue'
import { buildData, updateData, swapRows } from '../../../../utils/data-generator.js'

const App = {
  setup () {
    const data = shallowRef([])
    const selected = ref(null)

    const run = () => {
      data.value = buildData(1000)
      selected.value = null
    }

    const runLots = () => {
      data.value = buildData(10000)
      selected.value = null
    }

    const replace = () => {
      const count = data.value.length > 0 ? data.value.length : 1000
      data.value = buildData(count)
      selected.value = null
    }

    const update = () => {
      data.value = updateData(data.value, 10)
    }

    const swap = () => {
      data.value = swapRows(data.value, 1, 998)
    }

    const clear = () => {
      data.value = []
      selected.value = null
    }

    const remove = (id) => {
      data.value = data.value.filter(item => item.id !== id)
    }

    const select = (id) => {
      selected.value = id
    }

    return () => h('div', [
      h('div', { class: 'toolbar' }, [
        h('button', {
          id: 'run',
          type: 'button',
          onClick: run
        }, 'Create 1,000 rows'),
        h('button', {
          id: 'runlots',
          type: 'button',
          onClick: runLots
        }, 'Create 10,000 rows'),
        h('button', {
          id: 'replace',
          type: 'button',
          onClick: replace
        }, 'Replace 1,000 rows'),
        h('button', {
          id: 'update',
          type: 'button',
          onClick: update
        }, 'Update every 10th row'),
        h('button', {
          id: 'swaprows',
          type: 'button',
          onClick: swap
        }, 'Swap rows (1 & 998)'),
        h('button', {
          id: 'clear',
          type: 'button',
          onClick: clear
        }, 'Clear rows')
      ]),
      h('table', { class: 'table' }, [
        h('tbody', data.value.map(item => h('tr', {
          key: item.id,
          class: selected.value === item.id ? 'danger' : '',
          'data-id': item.id
        }, [
          h('td', { class: 'col-id' }, item.id),
          h('td', { class: 'col-label' }, [
            h('a', {
              class: 'lbl',
              onClick: () => select(item.id)
            }, item.label)
          ]),
          h('td', { class: 'col-delete' }, [
            h('button', {
              class: 'btn-delete',
              type: 'button',
              onClick: () => remove(item.id)
            }, '🗑️')
          ])
        ])
        ))
      ])
    ])
  }
}

const el = document.getElementById('main')
if (el) {
  createApp(App).mount(el)
}

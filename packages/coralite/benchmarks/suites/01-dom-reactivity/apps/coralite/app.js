import { createCoraliteClass } from '../../../../../lib/coralite-element.js'
import { buildData, updateData, swapRows } from '../../../../utils/data-generator.js'

// Pre-compiled row template for high-speed cloneNode allocation
const rowTemplate = document.createElement('template')
rowTemplate.innerHTML = '<tr><td class="col-id"> </td><td class="col-label"><a class="lbl"> </a></td><td class="col-delete"><button class="btn-delete" type="button">🗑️</button></td></tr>'
const templateRow = rowTemplate.content.firstChild

const CoraliteApp = createCoraliteClass({
  componentId: 'coralite-app',
  defaultValues: {
    data: [],
    selected: null
  },
  hydrationMap: {
    refs: [{ name: 'tbody' }]
  },
  templateHTML: `
    <div id="main">
      <div class="toolbar">
        <button id="run" type="button">Create 1,000 rows</button>
        <button id="runlots" type="button">Create 10,000 rows</button>
        <button id="replace" type="button">Replace 1,000 rows</button>
        <button id="update" type="button">Update every 10th row</button>
        <button id="swaprows" type="button">Swap rows (1 & 998)</button>
        <button id="clear" type="button">Clear rows</button>
      </div>
      <table class="table">
        <tbody ref="tbody"></tbody>
      </table>
    </div>
  `,
  client ({ state, root, refs, observe }) {
    const tbody = refs('tbody')

    function renderRow (item, selected) {
      const tr = templateRow.cloneNode(true)
      if (selected === item.id) {
        tr.className = 'danger'
      }

      tr.setAttribute('data-id', String(item.id))
      const td1 = tr.firstChild
      const a = td1.nextSibling.firstChild
      td1.firstChild.nodeValue = item.id
      a.firstChild.nodeValue = item.label
      return tr
    }

    function renderAll (list, selected) {
      const len = list ? list.length : 0
      if (len === 0) {
        tbody.replaceChildren()
        return
      }

      const fragment = document.createDocumentFragment()
      for (let i = 0; i < len; i++) {
        fragment.appendChild(renderRow(list[i], selected))
      }
      tbody.replaceChildren(fragment)
    }

    observe('data', (newData, oldData) => {
      const newLen = newData ? newData.length : 0
      const oldLen = oldData ? oldData.length : 0

      if (newLen === 0) {
        tbody.replaceChildren()
        return
      }

      if (oldLen === 0 || oldLen !== newLen) {
        renderAll(newData, state.selected)
        return
      }

      // Fast-path for in-place modifications (same length)
      const diffIndices = []
      for (let i = 0; i < newLen; i++) {
        if (oldData[i] !== newData[i]) {
          diffIndices.push(i)
          if (diffIndices.length > 105) {
            break
          }
        }
      }

      // Swapping 2 rows
      if (diffIndices.length === 2) {
        const [i, j] = diffIndices
        if (oldData[i].id === newData[j].id && oldData[j].id === newData[i].id) {
          const row1 = tbody.children[i]
          const row2 = tbody.children[j]
          if (row1 && row2) {
            const next1 = row1.nextSibling
            const next2 = row2.nextSibling
            if (next1 === row2) {
              tbody.insertBefore(row2, row1)
            } else {
              tbody.insertBefore(row2, next1)
              tbody.insertBefore(row1, next2)
            }
            return
          }
        }
      }

      // Partial updates (e.g., every 10th row)
      if (diffIndices.length > 0 && diffIndices.length <= 105) {
        let isAllSameId = true
        for (let k = 0; k < diffIndices.length; k++) {
          const idx = diffIndices[k]
          if (oldData[idx].id !== newData[idx].id) {
            isAllSameId = false
            break
          }
        }

        if (isAllSameId) {
          const trs = tbody.children
          for (let k = 0; k < diffIndices.length; k++) {
            const idx = diffIndices[k]
            const tr = trs[idx]
            if (tr) {
              const lbl = tr.children[1]?.firstElementChild
              if (lbl) {
                lbl.textContent = newData[idx].label
              }
            }
          }
          return
        }
      }

      // Fallback full render
      renderAll(newData, state.selected)
    })

    observe('selected', (newSelected, oldSelected) => {
      const currentDanger = tbody.querySelector('tr.danger')
      if (currentDanger) {
        currentDanger.classList.remove('danger')
      }
      if (newSelected !== null) {
        const targetTr = tbody.querySelector(`tr[data-id="${newSelected}"]`)
        if (targetTr) {
          targetTr.classList.add('danger')
        }
      }
    })

    const runBtn = root.querySelector('#run')
    const runlotsBtn = root.querySelector('#runlots')
    const replaceBtn = root.querySelector('#replace')
    const updateBtn = root.querySelector('#update')
    const swaprowsBtn = root.querySelector('#swaprows')
    const clearBtn = root.querySelector('#clear')

    runBtn.addEventListener('click', () => {
      state.selected = null
      state.data = buildData(1000)
    })

    runlotsBtn.addEventListener('click', () => {
      state.selected = null
      state.data = buildData(10000)
    })

    replaceBtn.addEventListener('click', () => {
      const count = state.data.length > 0 ? state.data.length : 1000
      state.selected = null
      state.data = buildData(count)
    })

    updateBtn.addEventListener('click', () => {
      state.data = updateData(state.data, 10)
    })

    swaprowsBtn.addEventListener('click', () => {
      if (state.data.length > 998) {
        state.data = swapRows(state.data, 1, 998)
      }
    })

    clearBtn.addEventListener('click', () => {
      state.selected = null
      state.data = []
    })

    tbody.addEventListener('click', (e) => {
      const target = e.target
      if (target.classList.contains('btn-delete')) {
        const tr = target.closest('tr')
        if (tr) {
          const id = parseInt(tr.getAttribute('data-id'), 10)
          state.data = state.data.filter(item => item.id !== id)
        }
      } else if (target.classList.contains('lbl')) {
        const tr = target.closest('tr')
        if (tr) {
          const id = parseInt(tr.getAttribute('data-id'), 10)
          state.selected = id
        }
      }
    })
  }
})

customElements.define('coralite-app', CoraliteApp)

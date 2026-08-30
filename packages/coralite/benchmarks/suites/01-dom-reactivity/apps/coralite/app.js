import { createCoraliteClass } from '../../../../../lib/coralite-element.js'
import { buildData, updateData, swapRows } from '../../../../utils/data-generator.js'

// Pre-compiled row template for high-speed cloneNode allocation
const rowTemplate = document.createElement('template')
rowTemplate.innerHTML = '<tr><td class="col-id"></td><td class="col-label"><a class="lbl"></a></td><td class="col-delete"><button class="btn-delete" type="button">🗑️</button></td></tr>'

const CoraliteApp = createCoraliteClass({
  componentId: 'coralite-app',
  defaultValues: {
    data: [],
    selected: null
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
  client ({ state, root, observe }) {
    const tbody = root.querySelector('tbody')
    let skipValue = null

    function renderRow (item, selected) {
      const tr = rowTemplate.content.firstElementChild.cloneNode(true)
      if (selected === item.id) {
        tr.className = 'danger'
      }

      tr.setAttribute('data-id', String(item.id))
      // Invariant: children[0] = td.col-id, children[1] = td.col-label > a.lbl
      tr.children[0].textContent = String(item.id)
      tr.children[1].firstElementChild.textContent = item.label
      return tr
    }

    function renderAll () {
      const list = state.data || []
      if (list.length === 0) {
        tbody.replaceChildren()
        return
      }

      const selected = state.selected
      const fragment = document.createDocumentFragment()
      for (let i = 0; i < list.length; i++) {
        fragment.appendChild(renderRow(list[i], selected))
      }
      tbody.replaceChildren(fragment)
    }

    observe('data', () => {
      if (skipValue !== null && state.data === skipValue) {
        skipValue = null
        return
      }
      skipValue = null
      renderAll()
    })

    observe('selected', () => {
      const currentDanger = tbody.querySelector('tr.danger')
      if (currentDanger) {
        currentDanger.classList.remove('danger')
      }
      if (state.selected !== null) {
        const targetTr = tbody.querySelector(`tr[data-id="${state.selected}"]`)
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
      state.selected = null
      const count = state.data.length > 0 ? state.data.length : 1000
      state.data = buildData(count)
    })

    updateBtn.addEventListener('click', () => {
      const newData = updateData(state.data, 10)
      skipValue = newData
      state.data = newData
      const trs = tbody.children
      for (let i = 0; i < newData.length; i += 10) {
        if (trs[i]) {
          const lbl = trs[i].children[1]?.firstElementChild
          if (lbl) {
            lbl.textContent = newData[i].label
          }
        }
      }
    })

    swaprowsBtn.addEventListener('click', () => {
      if (state.data.length > 998) {
        const newData = swapRows(state.data, 1, 998)
        skipValue = newData
        state.data = newData
        const row1 = tbody.children[1]
        const row998 = tbody.children[998]
        if (row1 && row998) {
          const next1 = row1.nextSibling
          const next998 = row998.nextSibling
          if (next1 === row998) {
            tbody.insertBefore(row998, row1)
          } else {
            tbody.insertBefore(row998, next1)
            tbody.insertBefore(row1, next998)
          }
        }
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
          const newData = state.data.filter(item => item.id !== id)
          skipValue = newData
          state.data = newData
          tr.remove()
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

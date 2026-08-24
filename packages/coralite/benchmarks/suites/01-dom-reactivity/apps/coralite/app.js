import { createCoraliteClass } from '../../../../../lib/coralite-element.js'
import { buildData, updateData, swapRows } from '../../../../utils/data-generator.js'

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
  client ({ state, refs, root, observe }) {
    const tbody = refs('tbody')

    function renderRow (item) {
      const tr = document.createElement('tr')
      if (state.selected === item.id) {
        tr.className = 'danger'
      }

      tr.setAttribute('data-id', String(item.id))

      const td1 = document.createElement('td')
      td1.className = 'col-id'
      td1.textContent = String(item.id)

      const td2 = document.createElement('td')
      td2.className = 'col-label'
      const a = document.createElement('a')
      a.className = 'lbl'
      a.textContent = item.label
      td2.appendChild(a)

      const td3 = document.createElement('td')
      td3.className = 'col-delete'
      const btn = document.createElement('button')
      btn.className = 'btn-delete'
      btn.type = 'button'
      btn.textContent = '🗑️'
      td3.appendChild(btn)

      tr.appendChild(td1)
      tr.appendChild(td2)
      tr.appendChild(td3)
      return tr
    }

    function renderAll () {
      tbody.innerHTML = ''
      const fragment = document.createDocumentFragment()
      const list = state.data || []
      for (let i = 0; i < list.length; i++) {
        fragment.appendChild(renderRow(list[i]))
      }
      tbody.appendChild(fragment)
    }

    observe('data', () => {
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

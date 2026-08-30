import { buildData, updateData, swapRows } from '../../../../utils/data-generator.js'

// Pre-compiled row template for high-speed cloneNode allocation
const rowTemplate = document.createElement('template')
rowTemplate.innerHTML = '<tr><td class="col-id"> </td><td class="col-label"><a class="lbl"> </a></td><td class="col-delete"><button class="btn-delete" type="button">🗑️</button></td></tr>'
const templateRow = rowTemplate.content.firstChild

let data = []
let selected = null
const tbody = document.getElementById('tbody')

function renderRow (item, currentSelected) {
  const tr = templateRow.cloneNode(true)
  if (currentSelected === item.id) {
    tr.className = 'danger'
  }
  tr.setAttribute('data-id', String(item.id))
  const td1 = tr.firstChild
  const a = td1.nextSibling.firstChild
  td1.firstChild.nodeValue = item.id
  a.firstChild.nodeValue = item.label
  return tr
}

function renderAll () {
  if (data.length === 0) {
    tbody.replaceChildren()
    return
  }
  const fragment = document.createDocumentFragment()
  for (let i = 0; i < data.length; i++) {
    fragment.appendChild(renderRow(data[i], selected))
  }
  tbody.replaceChildren(fragment)
}

document.getElementById('run').addEventListener('click', () => {
  data = buildData(1000)
  selected = null
  renderAll()
})

document.getElementById('runlots').addEventListener('click', () => {
  data = buildData(10000)
  selected = null
  renderAll()
})

document.getElementById('replace').addEventListener('click', () => {
  const count = data.length > 0 ? data.length : 1000
  data = buildData(count)
  selected = null
  renderAll()
})

document.getElementById('update').addEventListener('click', () => {
  data = updateData(data, 10)
  const trs = tbody.children
  for (let i = 0; i < data.length; i += 10) {
    if (trs[i]) {
      const lbl = trs[i].children[1]?.firstElementChild
      if (lbl) {
        lbl.textContent = data[i].label
      }
    }
  }
})

document.getElementById('swaprows').addEventListener('click', () => {
  if (data.length > 998) {
    data = swapRows(data, 1, 998)
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

document.getElementById('clear').addEventListener('click', () => {
  data = []
  selected = null
  tbody.replaceChildren()
})

tbody.addEventListener('click', (e) => {
  const target = e.target
  if (target.classList.contains('btn-delete')) {
    const tr = target.closest('tr')
    if (tr) {
      const id = parseInt(tr.getAttribute('data-id'), 10)
      data = data.filter(item => item.id !== id)
      tr.remove()
    }
  } else if (target.classList.contains('lbl')) {
    const tr = target.closest('tr')
    if (tr) {
      const id = parseInt(tr.getAttribute('data-id'), 10)
      selected = id
      const currentDanger = tbody.querySelector('tr.danger')
      if (currentDanger) {
        currentDanger.classList.remove('danger')
      }
      tr.classList.add('danger')
    }
  }
})

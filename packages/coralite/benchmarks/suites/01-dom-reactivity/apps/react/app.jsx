import React, { useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { buildData, updateData, swapRows } from '../../../../utils/data-generator.js'

function App () {
  const [data, setData] = useState([])
  const [selected, setSelected] = useState(null)

  const run = useCallback(() => {
    setData(buildData(1000))
    setSelected(null)
  }, [])

  const runLots = useCallback(() => {
    setData(buildData(10000))
    setSelected(null)
  }, [])

  const replace = useCallback(() => {
    setData(prev => {
      const count = prev.length > 0 ? prev.length : 1000
      return buildData(count)
    })
    setSelected(null)
  }, [])

  const update = useCallback(() => {
    setData(prev => updateData(prev, 10))
  }, [])

  const swap = useCallback(() => {
    setData(prev => swapRows(prev, 1, 998))
  }, [])

  const clear = useCallback(() => {
    setData([])
    setSelected(null)
  }, [])

  const remove = useCallback((id) => {
    setData(prev => prev.filter(item => item.id !== id))
  }, [])

  const select = useCallback((id) => {
    setSelected(id)
  }, [])

  return (
    <div>
      <div className="toolbar">
        <button id="run" type="button" onClick={run}>Create 1,000 rows</button>
        <button id="runlots" type="button" onClick={runLots}>Create 10,000 rows</button>
        <button id="replace" type="button" onClick={replace}>Replace 1,000 rows</button>
        <button id="update" type="button" onClick={update}>Update every 10th row</button>
        <button id="swaprows" type="button" onClick={swap}>Swap rows (1 & 998)</button>
        <button id="clear" type="button" onClick={clear}>Clear rows</button>
      </div>
      <table className="table">
        <tbody>
          {data.map(item => (
            <tr key={item.id} className={selected === item.id ? 'danger' : ''} data-id={item.id}>
              <td className="col-id">{item.id}</td>
              <td className="col-label">
                <a className="lbl" onClick={() => select(item.id)}>{item.label}</a>
              </td>
              <td className="col-delete">
                <button className="btn-delete" type="button" onClick={() => remove(item.id)}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const rootContainer = document.getElementById('main')
if (rootContainer) {
  const root = createRoot(rootContainer)
  root.render(<App />)
}

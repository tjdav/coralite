<script>
  import { buildData, updateData, swapRows } from '../../../../utils/data-generator.js'

  let data = $state([])
  let selected = $state(null)

  function run () {
    data = buildData(1000)
    selected = null
  }

  function runLots () {
    data = buildData(10000)
    selected = null
  }

  function replace () {
    const count = data.length > 0 ? data.length : 1000
    data = buildData(count)
    selected = null
  }

  function update () {
    data = updateData(data, 10)
  }

  function swap () {
    data = swapRows(data, 1, 998)
  }

  function clear () {
    data = []
    selected = null
  }

  function remove (id) {
    data = data.filter(item => item.id !== id)
  }

  function select (id) {
    selected = id
  }
</script>

<div>
  <div class="toolbar">
    <button id="run" type="button" onclick={run}>Create 1,000 rows</button>
    <button id="runlots" type="button" onclick={runLots}>Create 10,000 rows</button>
    <button id="replace" type="button" onclick={replace}>Replace 1,000 rows</button>
    <button id="update" type="button" onclick={update}>Update every 10th row</button>
    <button id="swaprows" type="button" onclick={swap}>Swap rows (1 & 998)</button>
    <button id="clear" type="button" onclick={clear}>Clear rows</button>
  </div>
  <table class="table">
    <tbody>
      {#each data as item (item.id)}
        <tr class={selected === item.id ? 'danger' : ''} data-id={item.id}>
          <td class="col-id">{item.id}</td>
          <td class="col-label">
            <a class="lbl" href="#select" onclick={(e) => { e.preventDefault(); select(item.id) }}>{item.label}</a>
          </td>
          <td class="col-delete">
            <button class="btn-delete" type="button" onclick={() => remove(item.id)}>🗑️</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

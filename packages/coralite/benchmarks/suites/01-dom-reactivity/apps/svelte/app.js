import { mount } from 'svelte'
import App from './App.svelte'

const target = document.getElementById('main')
if (target) {
  mount(App, { target })
}

import defineProps from './defineProps.js'

export function parseProperties (args, props) {
  return new Function(defineProps + ' return defineProps.call(this,' + args + ')').call(props)
}
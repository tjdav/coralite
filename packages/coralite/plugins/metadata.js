import { createPlugin } from '#lib'

export const metadataPlugin = createPlugin({
  name: 'metadata',
  async onPageSet ({ elements, values, data }) {
    // loop through all children of the root element to process metadata in <head> tags.
    for (let i = 0; i < elements.root.children.length; i++) {
      const rootNode = elements.root.children[i]

      // traverse html children to find the head element
      if (rootNode.type === 'tag' && rootNode.name === 'html') {
        for (let i = 0; i < rootNode.children.length; i++) {
          const node = rootNode.children[i]

          // check if the current node is a <head> tag where metadata is typically found.
          if (node.type === 'tag' && node.name === 'head') {
            // iterate over the children of the head element to locate meta tags or component slots.
            for (let i = 0; i < node.children.length; i++) {
              const element = node.children[i]

              // if the element is a tag named "meta" with both name and content attributes, store its metadata.
              if (element.type === 'tag') {
                if (element.name === 'meta'
                  && element.attribs.name
                  && element.attribs.content
                ) {
                  const metaName = 'meta_' + element.attribs.name

                  values[metaName] = element.attribs.content
                } else if (element.slots) {
                  // process component slots by creating a component dynamically.
                  const component = await this.createComponent({
                    id: element.name,
                    values,
                    element,
                    document: data.result,
                    contextId: data.path.pathname + i + element.name,
                    index: i
                  })

                  // if the created component returns valid children, iterate over them to extract meta information.
                  if (component) {
                    for (let i = 0; i < component.children.length; i++) {
                      const element = component.children[i]

                      // for each child element in the component's returned HTML,
                      // check if it is a meta tag and store its metadata with a '$' prefix.
                      if (element.type === 'tag'
                        && element.name === 'meta'
                        && element.attribs.name
                        && element.attribs.content
                      ) {
                        const metaName = 'meta_' + element.attribs.name

                        values[metaName] = element.attribs.content
                      }
                    }
                  }
                }
              }
            }

            // once the <head> tag is processed, return to exit the loop.
            return
          }
        }
      }
    }
  }
})

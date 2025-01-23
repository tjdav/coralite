import { getHTML } from '#lib'
import { deepStrictEqual, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

describe('Get HTML documents', () => {
  const indexHTML = {
    parentPath: './test/fixtures/pages',
    name: 'index.html',
    content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Home page</title>\n</head>\n<body>\n  Hello\n\n  <coralite-header></coralite-header>\n\n  world\n</body>\n</html>'
  }
  const blogIndexHTML = {
    parentPath: './test/fixtures/pages/blog',
    name: 'index.html',
    content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Blog posts</title>\n  <coralite-head>\n    <meta slot="meta" name="name" content="coralite">\n    <meta slot="meta" name="description" content="look mum, no database!">\n    <span>default slot</span>\n    <span>default slot</span>\n  </coralite-head>\n</head>\n<body>\n  Hello\n\n  <coralite-header></coralite-header>\n  <coralite-posts path="blog"></coralite-posts>\n  world\n</body>\n</html>'
  }
  const blogPostOneHTML = {
    parentPath: './test/fixtures/pages/blog',
    name: 'post-1.html',
    content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n  <meta name="title" content="Post 1">\n  <meta name="author" content="Nemo">\n  <meta name="image" content="image.png">\n  <meta name="image_alt" content="Photo of a cat">\n  <meta name="description" content="short description">\n  <meta name="published_time" content="2025-01-08T20:23:07.645Z">\n</head>\n<body>\n  Hello\n\n  <coralite-header></coralite-header>\n  <coralite-author name="Nemo" datetime="2025-01-08T20:23:07.645Z"></coralite-author>\n\n  world\n</body>\n</html>'
  }
  const blogPostTwoHTML = {
    parentPath: './test/fixtures/pages/blog',
    name: 'post-2.html',
    content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n  <meta name="title" content="Post 2">\n  <meta name="author" content="Nemo">\n  <meta name="image" content="image.png">\n  <meta name="image_alt" content="Photo of a dog">\n  <meta name="description" content="short description">\n  <meta name="published_time" content="2025-01-09T20:23:07.645Z">\n</head>\n<body>\n  <coralite-header></coralite-header>\n  <coralite-author name="Nemo" datetime="2025-01-08T20:23:07.645Z"></coralite-author>\n</body>\n</html>'
  }

  it('should return all .html files matching the search pattern', async () => {
    const result = await getHTML({
      path: './test/fixtures/pages',
      recursive: false,
      exclude: []
    })

    deepStrictEqual(result, [indexHTML])
  })

  it('should respect exclusion list', async () => {
    const result = await getHTML({
      path: './test/fixtures/pages/blog',
      recursive: false,
      exclude: ['index.html']
    })

    deepStrictEqual(result, [blogPostOneHTML, blogPostTwoHTML])
  })

  it('should recursively search directories', async () => {
    // Test recursive case by searching deeper into subdirectories
    const result = await getHTML({
      path: './test/fixtures/pages',
      recursive: true,
      exclude: []
    })

    /** @TODO preserve base path */
    blogIndexHTML.parentPath = 'test/fixtures/pages/blog'
    blogPostOneHTML.parentPath = 'test/fixtures/pages/blog'
    blogPostTwoHTML.parentPath = 'test/fixtures/pages/blog'

    deepStrictEqual(result, [indexHTML, blogIndexHTML, blogPostOneHTML, blogPostTwoHTML])
  })
})

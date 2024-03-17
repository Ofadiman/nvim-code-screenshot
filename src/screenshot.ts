import puppeteer from 'puppeteer'
import { bundledLanguages, bundledThemes, getHighlighter } from 'shiki'

const template = (args: { code: string; padding: number }) => `<!doctype html>
<html>
  <head>
    <title>nvim-code-screenshot</title>
    <style>
      * {
        margin: 0;
        padding: 0;
      }

      pre {
        width: fit-content;
        padding: ${args.padding}px;
      }
    </style>
  </head>
  <body>
    ${args.code}
  </body>
</html>`

// TODO: Add feedback saying, that the screenshot was made or that something went wrong.
void (async () => {
  // TODO: It might be possible to load only 1 language and theme to improve performance. I have to validate if all languages and themes still can be used in that case.
  // NOTE: It seems like all languages are bundled by default: https://shiki.style/guide/install#fine-grained-bundle
  const highlighter = await getHighlighter({
    themes: Object.keys(bundledThemes),
    langs: Object.keys(bundledLanguages),
  })

  // TODO: Pass real code from nvim here.
  const htmlCode = highlighter.codeToHtml(
    `const highlighter = await getHighlighter({
  themes: Object.keys(bundledThemes),
  langs: Object.keys(bundledLanguages),
});`,
    {
      // TODO: Figure out correct language mapping for current file.
      lang: 'javascript',
      // TODO: Allow users to configure theme.
      theme: 'poimandres',
    },
  )

  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  // TODO: Allow people to configure code padding.
  await page.setContent(template({ padding: 10, code: htmlCode }))

  const dimensions = await page.evaluate(() => {
    const pre = document.querySelector('pre')
    if (pre === null) {
      throw new Error(`<pre> element not found on the page`)
    }

    const preDOMRect = pre.getBoundingClientRect()
    return {
      width: preDOMRect.width,
      height: preDOMRect.height,
    }
  })

  await page.setViewport({
    // NOTE: `width` and `height` are arbitrary numbers here because the `page.screenshot` method takes a screenshot of the entire <pre> element regardless of the dimensions of the page.
    width: 100,
    height: 100,
    // TODO: Allow people to adjust image quality however they want.
    deviceScaleFactor: 3,
  })

  await page.screenshot({
    // TODO: Allow users save screenshots wherever they want. Maybe I need like 3 commands for that, 1 that will copy to clipboard, 1 that will save to path and 1 that will do both.
    path: 'tmp/demo.jpeg',
    // TODO: Maybe allow users to choose image type?
    type: 'jpeg',
    quality: 100,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height,
      // TODO: Not sure if scale is required here, but if so, it will probably have to be set to the same value as `eviceScaleFactor` in `setViewport` method.
      scale: 3,
    },
  })

  await browser.close()
})()

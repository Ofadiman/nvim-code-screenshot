import consola from 'consola'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer'
import { bundledLanguages, bundledThemes, getHighlighter } from 'shiki'
import { z } from 'zod'

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

const optionsSchema = z.object({
  code: z.string(),
  filepath: z.string(),
  padding: z.number().int(),
  persist: z.object({
    enable: z.boolean(),
    path: z.string(),
  }),
  clipboard: z.object({
    enable: z.boolean(),
    program: z.string(),
  }),
  // TODO: Validate if passed theme is supported by `shiki` library.
  theme: z.string(),
  extension: z.enum(['webp', 'jpeg', 'png']),
  quality: z.number().int(),
  languages: z.record(z.string(), z.string()).default({}),
})

// TODO: Add feedback saying, that the screenshot was made or that something went wrong.
void (async () => {
  const tempFilePath = process.argv[2]
  if (tempFilePath === undefined) {
    consola.error(`Path to temporary file with script options was not passed.`)
    return
  }

  let optionsAsString: string
  try {
    optionsAsString = readFileSync(tempFilePath, { encoding: 'utf8' })
  } catch (error) {
    consola.error(`Failed to read ${tempFilePath} file.`)
    consola.error(error)
    return
  }

  let optionsAsJson: string
  try {
    optionsAsJson = JSON.parse(optionsAsString)
  } catch (error) {
    consola.error(`Invalid JSON in ${tempFilePath} file.`)
    consola.error(error)
    return
  }

  const parsedOptions = optionsSchema.safeParse(optionsAsJson)
  if (parsedOptions.success === false) {
    consola.error(`Options from ${tempFilePath} file are not matching validation schema!`)
    consola.error(parsedOptions.error.toString())
    return
  }

  // TODO: It might be possible to load only 1 language and theme to improve performance. I have to validate if all languages and themes still can be used in that case.
  // NOTE: It seems like all languages are bundled by default: https://shiki.style/guide/install#fine-grained-bundle
  const highlighter = await getHighlighter({
    themes: Object.keys(bundledThemes),
    langs: Object.keys(bundledLanguages),
  })

  const htmlCode = highlighter.codeToHtml(parsedOptions.data.code, {
    // TODO: Figure out correct language mapping for current file.
    lang: 'javascript',
    // TODO: Allow users to configure theme.
    theme: 'poimandres',
  })

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

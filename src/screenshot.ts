import consola from 'consola'
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import puppeteer from 'puppeteer'
import { bundledLanguages, bundledThemes, getHighlighter } from 'shiki'
import { z } from 'zod'
import { execaSync } from 'execa'
import util from 'node:util'
import which from 'which'

// NOTE: The function to resolve an absolute path is needed because Node.js cannot resolve paths starting with `~` by default.
const getAbsolutePath = (inputPath: string) => {
  if (inputPath.startsWith('~')) {
    return join(homedir(), inputPath.slice(1))
  } else {
    return resolve(inputPath)
  }
}

const optionsSchema = z.object({
  code: z.string(),
  filepath: z.string(),
  html: z.object({
    template: z.string().nullable().default(null),
    watermark: z.string().nullable().default(null),
    styles: z.string().nullable().default(null),
  }),
  padding: z.object({
    vertical: z.number().int(),
    horizontal: z.number().int(),
  }),
  output: z.object({
    enable: z.boolean(),
    directory: z.string(),
    filename: z.string(),
  }),
  clipboard: z.object({
    enable: z.boolean(),
    command: z.string().nullable().default(null),
  }),
  theme: z.string().refine((value) => Object.keys(bundledThemes).includes(value), {
    message: `Unsupported theme. Please pass one of the following values: ${Object.keys(bundledThemes).join(', ')}.`,
  }),
  extension: z.enum(['webp', 'jpeg', 'png']),
  quality: z.number().int(),
  languages: z.record(z.string(), z.string()).default({}),
})

type Options = z.infer<typeof optionsSchema>

const template = (args: {
  code: string
  padding: Options['padding']
  watermark: string
  styles: string
}) => `<!doctype html>
<html>
  <head>
    <title>nvim-codeshot</title>
    <style>
      * {
        margin: 0;
        padding: 0;
      }

      pre {
        width: fit-content;
        padding: ${args.padding.vertical}px ${args.padding.horizontal}px;
      }
    </style>
    ${args.styles}
  </head>
  <body style="width: fit-content; position: relative">
    ${args.code}
    ${args.watermark}
  </body>
</html>`

const CLIPBOARD_PROGRAM_COMMAND_TEMPLATES = {
  xclip: 'xclip -selection clipboard -t image/png -i %s',
} as const

void (async () => {
  const optionsFilePath = process.argv[2]
  if (optionsFilePath === undefined) {
    consola.error(`Path to options file not passed.`)
    return
  }

  let optionsAsString: string
  try {
    optionsAsString = readFileSync(optionsFilePath, { encoding: 'utf8' })
  } catch (error) {
    consola.error(`Failed to read ${optionsFilePath} file.`)
    consola.error(error)
    return
  }

  let optionsAsJson: string
  try {
    optionsAsJson = JSON.parse(optionsAsString)
  } catch (error) {
    consola.error(`Invalid JSON in ${optionsFilePath} file.`)
    consola.error(error)
    return
  }

  const parsedOptions = optionsSchema.safeParse(optionsAsJson)
  if (parsedOptions.success === false) {
    consola.error(`Options from ${optionsFilePath} file are not matching validation schema!`)
    consola.error(parsedOptions.error.toString())
    return
  }

  const absolutePersistPath = getAbsolutePath(parsedOptions.data.output.directory)
  if (parsedOptions.data.output.enable) {
    const pathExists = existsSync(absolutePersistPath)

    if (pathExists) {
      const stat = statSync(absolutePersistPath)
      if (stat.isFile()) {
        consola.error(`${parsedOptions.data.output.directory} is a file!`)
        return
      }
    } else {
      mkdirSync(absolutePersistPath, { recursive: true })
    }
  }

  const highlighter = await getHighlighter({
    themes: [parsedOptions.data.theme],
    // TODO: Load only language that is required to render current file.
    langs: Object.keys(bundledLanguages),
  })

  const htmlCode = highlighter.codeToHtml(parsedOptions.data.code, {
    // TODO: Figure out correct language mapping for current file.
    lang: 'javascript',
    theme: parsedOptions.data.theme,
  })

  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  if (parsedOptions.data.html.template === null) {
    await page.setContent(
      template({
        padding: parsedOptions.data.padding,
        code: htmlCode,
        watermark: parsedOptions.data.html.watermark ?? '',
        styles: parsedOptions.data.html.styles ?? '',
      }),
    )
  } else {
    await page.setContent(util.format(parsedOptions.data.html.template, htmlCode))
  }

  const dimensions = await page.evaluate(() => {
    const pre = document.querySelector('pre')
    if (pre === null) {
      return null
    }

    const preDOMRect = pre.getBoundingClientRect()
    return {
      width: preDOMRect.width,
      height: preDOMRect.height,
    }
  })

  if (dimensions === null) {
    consola.error('<pre> element not found in DOM!')
    await browser.close()
    return
  }

  const codeshotPath = join(
    absolutePersistPath,
    `${parsedOptions.data.output.filename}.${parsedOptions.data.extension}`,
  )
  await page.setViewport({
    // NOTE: `width` and `height` are arbitrary numbers here because the `page.screenshot` method takes a screenshot of the entire <pre> element regardless of the dimensions of the page.
    width: 100,
    height: 100,
    deviceScaleFactor: parsedOptions.data.quality,
  })

  await page.screenshot({
    path: codeshotPath,
    type: parsedOptions.data.extension,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height,
      scale: parsedOptions.data.quality,
    },
  })

  await browser.close()

  if (parsedOptions.data.clipboard.enable) {
    if (parsedOptions.data.clipboard.command === null) {
      const xclip = which.sync('xclip', { nothrow: true })
      if (xclip !== null) {
        const formattedCommand = util.format(
          CLIPBOARD_PROGRAM_COMMAND_TEMPLATES.xclip,
          codeshotPath,
        )

        const [binary, ...rest] = formattedCommand.split(' ')

        if (binary === undefined) {
          consola.error(`Command passed to clipboard.command is invalid: ${formattedCommand}`)
          return
        }

        execaSync(binary, rest, {
          stdio: 'ignore',
        })
      }
    }

    if (parsedOptions.data.clipboard.command !== null) {
      const formattedCommand = util.format(parsedOptions.data.clipboard.command, codeshotPath)
      const [binary, ...rest] = formattedCommand.split(' ')

      if (binary === undefined) {
        consola.error(`Command passed to clipboard.command is invalid: ${formattedCommand}`)
        return
      }

      execaSync(binary, rest, {
        stdio: 'ignore',
      })
    }
  }

  if (parsedOptions.data.output.enable && parsedOptions.data.clipboard.enable) {
    consola.success(`Codeshot saved to ${codeshotPath} and clipboard!`)
  } else if (parsedOptions.data.output.enable) {
    consola.success(`Codeshot saved to ${codeshotPath}!`)
  } else if (parsedOptions.data.clipboard.enable) {
    consola.success(`Codeshot saved to ${codeshotPath}!`)
  }
})()

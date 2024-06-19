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
import { cwd } from 'node:process'
import path from 'node:path'
import os from 'node:os'

const indentTabs = (args: { code: string; tabWidth: number }): string => {
  const regex = new RegExp('^\t+', '')
  return args.code
    .split('\n')
    .map((line) => line.replace(regex, (match) => ' '.repeat(match.length * args.tabWidth)))
    .join('\n')
}

const trimCode = (args: { code: string }): string => {
  const regex = new RegExp('^ +', '')
  const indentation = args.code.split('\n').reduce((acc, line) => {
    if (line === '') {
      return acc
    }

    const [match] = line.match(regex) ?? []
    if (match === undefined) {
      return 0
    }

    return Math.min(acc, match.length)
  }, Infinity)

  return args.code
    .split('\n')
    .map((line) => line.replace(' '.repeat(indentation), ''))
    .join('\n')
}

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
  breadcrumbs: z.boolean(),
  html: z.object({
    template: z.string(),
    watermark: z.string(),
    styles: z.string(),
  }),
  whitespace: z.object({
    trim: z.boolean(),
    tab_width: z.number().int(),
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
  scale: z.number().int(),
  aliases: z
    .object({
      languages: z.record(z.string(), z.string()).default({}),
      files: z.record(z.string(), z.string()).default({}),
    })
    .default({}),
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

// NOTE: This map adds support for files that do not have an extension (e.g. Makefile) but still must have language set.
const BUILT_IN_FILE_MAPPINGS: Record<string, string> = {
  Makefile: 'make',
  Dockerfile: 'dockerfile',
}

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

  let codeToHighlight = indentTabs({
    code: parsedOptions.data.code,
    tabWidth: parsedOptions.data.whitespace.tab_width,
  })

  if (parsedOptions.data.whitespace.trim === true) {
    codeToHighlight = trimCode({
      code: codeToHighlight,
    })
  }

  const highlighter = await getHighlighter({
    themes: [parsedOptions.data.theme],
    langs: Object.keys(bundledLanguages),
    langAlias: parsedOptions.data.aliases.languages,
  })

  const commentSettings = highlighter.getTheme(parsedOptions.data.theme).settings.find((o) => {
    if (o.scope === undefined) {
      return false
    }

    if (typeof o.scope === 'string') {
      return o.scope === 'comment'
    }

    if (Array.isArray(o.scope)) {
      return o.scope.includes('comment')
    }

    return false
  })

  const padEnd = codeToHighlight.split('\n').length.toString().length + 1

  // NOTE: `@shiki/cli` library uses either language passed as CLI argument or file extension (https://github.com/shikijs/shiki/blob/main/packages/cli/src/cli.ts#L22).
  const parsedPath = path.parse(parsedOptions.data.filepath)

  let lang = parsedPath.ext.slice(1)
  if (lang === '') {
    const langFromBuiltInMappings = BUILT_IN_FILE_MAPPINGS[parsedPath.base]
    if (langFromBuiltInMappings) {
      lang = langFromBuiltInMappings
    }

    const langFromUserMappings = parsedOptions.data.aliases.files[parsedPath.base]
    if (langFromUserMappings) {
      lang = langFromUserMappings
    }
  }

  let htmlCode = highlighter.codeToHtml(codeToHighlight, {
    lang,
    theme: parsedOptions.data.theme,
    transformers: [
      {
        code(node) {
          if (parsedOptions.data.breadcrumbs === false) {
            return
          }

          if (commentSettings === undefined) {
            return
          }

          node.children.unshift(
            {
              type: 'element',
              tagName: 'span',
              properties: {
                style: `color:${commentSettings.settings.foreground};`,
                class: 'line',
              },
              children: [
                { type: 'text', value: parsedOptions.data.filepath.replace(cwd() + '/', '') },
              ],
            },
            { type: 'text', value: '\n' },
            { type: 'text', value: '\n' },
          )
        },
        line(node, line) {
          if (commentSettings === undefined) {
            return
          }

          node.children.unshift({
            type: 'element',
            tagName: 'span',
            properties: {
              style: `color:${commentSettings.settings.foreground};`,
            },
            children: [{ type: 'text', value: line.toString().padEnd(padEnd, ' ') }],
          })
        },
      },
    ],
  })

  const browser = await puppeteer.launch({ product: 'chrome' })
  const page = await browser.newPage()

  if (parsedOptions.data.html.template === '') {
    await page.setContent(
      template({
        padding: parsedOptions.data.padding,
        code: htmlCode,
        watermark: parsedOptions.data.html.watermark,
        styles: parsedOptions.data.html.styles,
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

  await page.screenshot({
    path: codeshotPath,
    type: parsedOptions.data.extension,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height,
      scale: parsedOptions.data.scale,
    },
  })

  await browser.close()

  if (parsedOptions.data.clipboard.enable) {
    if (parsedOptions.data.clipboard.command === null) {
      const isMac = os.platform() === 'darwin'
      const isLinux = os.platform() === 'linux'
      const hasXclip = which.sync('xclip', { nothrow: true }) !== null

      if (isMac) {
        execaSync(
          'osascript',
          ['-e', `set the clipboard to (read (POSIX file "${codeshotPath}") as JPEG picture)`],
          {
            stdio: 'ignore',
          },
        )
      }

      if (isLinux && hasXclip) {
        const formattedCommand = util.format(
          `xclip -selection clipboard -t image/png -i %s`,
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
    } else {
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

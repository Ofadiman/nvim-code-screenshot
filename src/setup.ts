import { homedir } from 'node:os'
import { join } from 'node:path'
import { Browser, getInstalledBrowsers, install } from '@puppeteer/browsers'
import { consola } from 'consola'
import os from 'node:os'
import { z } from 'zod'

const platformSchema = z.enum(['darwin', 'linux', 'win32'])

const browserVersionSchema = z.object({
  version: z.string(),
  milestone: z.number(),
  date: z.string(),
})

const latestBrowsersSchema = z.object({
  windows: browserVersionSchema,
  mac: browserVersionSchema,
  linux: browserVersionSchema,
})

void (async () => {
  const defaultPuppeteerCacheDir = join(homedir(), '.cache', 'puppeteer')
  const installedBrowsers = await getInstalledBrowsers({
    cacheDir: defaultPuppeteerCacheDir,
  })

  const hasZeroInstalledBrowsers = installedBrowsers.length === 0
  if (hasZeroInstalledBrowsers) {
    consola.start(`Installing required browser.`)
    const platform = platformSchema.parse(os.platform())

    const response = await fetch(
      // https://github.com/berstend/chrome-versions#:~:text=Latest%20chrome%20stable%20version%20info%20for%20all%20platforms%3A
      'https://cdn.jsdelivr.net/gh/berstend/chrome-versions/data/stable/all/version/latest.json',
    )

    if (!response.ok) {
      consola.error(
        'Could not fetch the latest browsers from https://cdn.jsdelivr.net/gh/berstend/chrome-versions/data/stable/all/version/latest.json.',
      )
      return
    }

    const json = await response.json()

    const parsedLatestBrowsers = latestBrowsersSchema.safeParse(json)
    if (!parsedLatestBrowsers.success) {
      consola.error(
        'Response from https://cdn.jsdelivr.net/gh/berstend/chrome-versions/data/stable/all/version/latest.json does not match expected data schema.',
      )
      consola.error(parsedLatestBrowsers.error)
      return
    }

    let buildId: string | null = null
    if (platform === 'linux') {
      buildId = parsedLatestBrowsers.data.linux.version
    }
    if (platform === 'win32') {
      buildId = parsedLatestBrowsers.data.windows.version
    }
    if (platform === 'darwin') {
      buildId = parsedLatestBrowsers.data.mac.version
    }
    if (buildId === null) {
      consola.error(
        `buildId for platform ${platform} could not be retrieved. Available builds are:`,
      )
      console.error(JSON.stringify(parsedLatestBrowsers.data, null, 2))
      return
    }

    const installedBrowser = await install({
      cacheDir: defaultPuppeteerCacheDir,
      browser: Browser.CHROME,
      buildId: buildId,
      unpack: true,
    })

    consola.success(`The following browser has been installed:`)
    consola.info(`- ${installedBrowser.browser}@${installedBrowser.buildId}`)

    return
  }

  consola.info(`The following browsers are already installed:`)
  installedBrowsers.forEach((installedBrowser) => {
    consola.info(`- ${installedBrowser.browser}@${installedBrowser.buildId}`)
  })
})()

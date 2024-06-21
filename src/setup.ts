import { homedir } from 'node:os'
import { join } from 'node:path'
import { Browser, getInstalledBrowsers, install } from '@puppeteer/browsers'
import { consola } from 'consola'
import os from 'node:os'
import { z } from 'zod'

// https://github.com/berstend/chrome-versions#:~:text=Latest%20chrome%20stable%20version%20info%20for%20all%20platforms%3A
const LATEST_CHROME_VERSION_URL: string =
  'https://cdn.jsdelivr.net/gh/berstend/chrome-versions/data/stable/all/version/latest.json'

const platformSchema = z.enum(['darwin', 'linux', 'win32'])

const latestChromeVersionPerSystemSchema = z.object({
  version: z.string(),
  milestone: z.number(),
  date: z.string(),
})

const latestChromeVersionResponseSchema = z.object({
  windows: latestChromeVersionPerSystemSchema,
  mac: latestChromeVersionPerSystemSchema,
  linux: latestChromeVersionPerSystemSchema,
})

void (async (): Promise<void> => {
  const defaultPuppeteerCacheDir = join(homedir(), '.cache', 'puppeteer')
  const installedBrowsers = await getInstalledBrowsers({
    cacheDir: defaultPuppeteerCacheDir,
  })

  const installedChromeBrowsers = installedBrowsers.filter(
    (installedBrowser) => installedBrowser.browser === Browser.CHROME,
  )

  const hasInstalledChromeBrowsers = installedChromeBrowsers.length > 0
  if (hasInstalledChromeBrowsers) {
    consola.info(`Chrome browser is already installed.`)
    return
  }

  const parsedPlatform = platformSchema.safeParse(os.platform())
  if (!parsedPlatform.success) {
    consola.error(`Platform ${os.platform()} is not supported.`)
    return
  }

  const latestChromeVersionsResponse = await fetch(LATEST_CHROME_VERSION_URL)
  if (!latestChromeVersionsResponse.ok) {
    consola.error(`Could not fetch the latest browsers data from ${LATEST_CHROME_VERSION_URL}.`)
    return
  }

  let latestChromeVersionsJson: object = {}
  try {
    latestChromeVersionsJson = await latestChromeVersionsResponse.json()
  } catch (e) {
    consola.error(`Response from ${LATEST_CHROME_VERSION_URL} is not in JSON format.`)
    consola.error(e)
    return
  }

  const parsedLatestBrowsers = latestChromeVersionResponseSchema.safeParse(latestChromeVersionsJson)
  if (!parsedLatestBrowsers.success) {
    consola.error(`Response from ${LATEST_CHROME_VERSION_URL} does not match expected schema.`)
    consola.error(parsedLatestBrowsers.error)
    return
  }

  let buildId: string | null = null
  if (parsedPlatform.data === 'linux') {
    buildId = parsedLatestBrowsers.data.linux.version
  }
  if (parsedPlatform.data === 'win32') {
    buildId = parsedLatestBrowsers.data.windows.version
  }
  if (parsedPlatform.data === 'darwin') {
    buildId = parsedLatestBrowsers.data.mac.version
  }
  if (buildId === null) {
    consola.error(`buildId for ${parsedPlatform.data} platform could not be retrieved.`)
    consola.error(JSON.stringify(parsedLatestBrowsers.data, null, 2))
    return
  }

  let timeout: NodeJS.Timeout | undefined
  void (function notify() {
    timeout = setTimeout(() => {
      const now = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      }).format(new Date())
      consola.info(`[${now}] Browser installation in progress`)
      notify()
    }, 1000)
  })()

  try {
    await install({
      cacheDir: defaultPuppeteerCacheDir,
      browser: Browser.CHROME,
      buildId: buildId,
      unpack: true,
    })
    consola.success(`Successfully installed ${Browser.CHROME}@${buildId}.`)
  } catch (e) {
    consola.error(`Failed to install ${Browser.CHROME}@${buildId}.`)
    consola.error(e)
  } finally {
    clearTimeout(timeout)
  }
})()

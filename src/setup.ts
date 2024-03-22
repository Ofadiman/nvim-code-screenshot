import { homedir } from 'node:os'
import { join } from 'node:path'
import { Browser, getInstalledBrowsers, install } from '@puppeteer/browsers'
import { consola } from 'consola'
import os from 'node:os'
import { z } from 'zod'

const platformSchema = z.enum(['darwin', 'linux', 'win32'])

// NOTE: Latest chrome versions as of 22/03/2024. (https://github.com/berstend/chrome-versions)
const LATEST_CHROME_RELEASES = {
  darwin: '123.0.6312.59',
  win32: '123.0.6312.58',
  linux: '123.0.6312.58',
} as const satisfies Record<z.infer<typeof platformSchema>, string>

void (async () => {
  const platform = platformSchema.parse(os.platform())
  const buildId = LATEST_CHROME_RELEASES[platform]

  const defaultPuppeteerCacheDir = join(homedir(), '.cache', 'puppeteer')
  const installedBrowsers = await getInstalledBrowsers({
    cacheDir: defaultPuppeteerCacheDir,
  })

  const hasZeroInstalledBrowsers = installedBrowsers.length === 0
  if (hasZeroInstalledBrowsers) {
    consola.start(`Installing required browser.`)

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

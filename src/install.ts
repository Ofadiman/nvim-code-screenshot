import { homedir } from 'node:os'
import { join } from 'node:path'
import { Browser, getInstalledBrowsers, install } from '@puppeteer/browsers'
import { consola } from 'consola'

void (async () => {
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
      // TODO: It seems like this should be evaluated based on OS: https://github.com/berstend/chrome-versions
      buildId: '122.0.6261.128',
      unpack: true,
    })

    consola.success(`The following browser has been installed:`)
    consola.info(`${installedBrowser.browser}@${installedBrowser.buildId}`)

    return
  }

  consola.info(`The following browsers are already installed:`)
  installedBrowsers.forEach((installedBrowser) => {
    consola.info(`${installedBrowser.browser}@${installedBrowser.buildId}`)
  })
})()

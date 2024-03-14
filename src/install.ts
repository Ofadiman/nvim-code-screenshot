import { homedir } from 'node:os'
import { join } from 'node:path'
import { Browser, getInstalledBrowsers, install } from '@puppeteer/browsers'

void (async () => {
  const defaultPuppeteerCacheDir = join(homedir(), '.cache', 'puppeteer')
  const installedBrowsers = await getInstalledBrowsers({
    cacheDir: defaultPuppeteerCacheDir,
  })

  const hasZeroInstalledBrowsers = installedBrowsers.length === 0
  if (hasZeroInstalledBrowsers) {
    console.info(`Installing browser for puppeteer.`)

    const installedBrowser = await install({
      cacheDir: defaultPuppeteerCacheDir,
      browser: Browser.CHROME,
      // TODO: It seems like this should be evaluated based on OS: https://github.com/berstend/chrome-versions
      buildId: '122.0.6261.128',
      unpack: true,
    })

    console.info(`The following browser was installed:`)
    console.info(installedBrowser)
  } else {
    console.info(`The following browsers are already installed:`)
    console.info(installedBrowsers)
  }
})()

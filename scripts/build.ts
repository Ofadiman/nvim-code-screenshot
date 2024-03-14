import { build } from 'esbuild'

build({
  entryPoints: ['src/screenshot.ts', 'src/install.ts'],
  bundle: true,
  outdir: 'bin',
  platform: 'node',
})
  .then(() => {
    console.info(`build succeed`)
  })
  .catch((e) => {
    console.error(`build failed`, e)
  })

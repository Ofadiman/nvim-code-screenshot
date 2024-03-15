import { build } from 'esbuild'

build({
  entryPoints: ['src/screenshot.ts', 'src/install.ts'],
  bundle: true,
  outExtension: {
    '.js': '.cjs',
  },
  outdir: 'bin',
  platform: 'node',
  format: 'cjs',
})
  .then(() => {
    console.info(`build succeed`)
  })
  .catch((e) => {
    console.error(`build failed`, e)
  })

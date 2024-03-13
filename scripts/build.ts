import { build } from 'esbuild'

build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'bin/main.cjs',
  platform: 'node',
})
  .then(() => {
    console.info(`build succeed`)
  })
  .catch((e) => {
    console.error(`build failed`, e)
  })

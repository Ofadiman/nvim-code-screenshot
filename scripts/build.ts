import path from 'path'
import { buildSync } from 'esbuild'
import { consola } from 'consola'
import { rimrafSync } from 'rimraf'

const OUTDIR = 'bin'

rimrafSync(path.join(OUTDIR, '**'), { glob: true })

buildSync({
  entryPoints: [path.join('src', '*')],
  bundle: true,
  outExtension: {
    '.js': '.cjs',
  },
  outdir: OUTDIR,
  platform: 'node',
  format: 'cjs',
})

consola.info(`build succeed`)

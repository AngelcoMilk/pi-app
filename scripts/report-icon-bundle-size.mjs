import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = process.cwd()
const assetsDir = join(root, 'out/renderer/assets')
const files = readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => join(assetsDir, name))

function sizes(selected) {
  return selected.reduce(
    (total, file) => ({
      raw: total.raw + statSync(file).size,
      gzip: total.gzip + gzipSync(readFileSync(file)).length,
    }),
    { raw: 0, gzip: 0 },
  )
}

const total = sizes(files)
console.log(JSON.stringify({
  rendererJavaScript: { files: files.length, ...total },
  chunks: files
    .filter((file) => /(?:app-|settings-page-|index-|icon|phosphor|fluent|huge|iconoir|lucide)/i.test(relative(assetsDir, file)))
    .map((file) => ({ file: relative(assetsDir, file), ...sizes([file]) }))
    .sort((left, right) => right.raw - left.raw),
}, null, 2))

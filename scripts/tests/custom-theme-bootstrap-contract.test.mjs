import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('custom theme startup contract', () => {
  it('guards both startup styles and appends free CSS after the structured theme', () => {
    const html = readFileSync(join(root, 'src/renderer/index.html'), 'utf8')
    const guard = html.indexOf('if (!customThemeDisabled)')
    const theme = html.indexOf("themeStyle.id = 'pi-custom-theme'")
    const customCss = html.indexOf("customStyle.id = 'pi-custom-css'")

    assert.ok(guard >= 0, 'bootstrap must guard custom theme caches with preload state')
    assert.ok(theme > guard, 'structured theme must be inside the safe-mode guard')
    assert.ok(customCss > theme, 'free CSS must be appended after the structured theme')
  })

  it('passes startup state through additionalArguments before preload exposes it', () => {
    const windowSrc = readFileSync(join(root, 'src/main/window.ts'), 'utf8')
    const preloadSrc = readFileSync(join(root, 'src/preload/index.ts'), 'utf8')

    assert.match(windowSrc, /additionalArguments:\s*\[[\s\S]*customThemeRendererArgument\(\)/)
    assert.match(preloadSrc, /customThemeDisabled:\s*process\.argv\.includes/)
    assert.match(preloadSrc, /contextBridge\.exposeInMainWorld\('piDesktop', api\)/)
  })
})

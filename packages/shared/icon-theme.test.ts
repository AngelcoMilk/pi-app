import { describe, expect, it } from 'vitest'
import { DEFAULT_ICON_THEME, ICON_THEMES, normalizeIconTheme } from './icon-theme'

describe('icon theme contract', () => {
  it('defaults invalid and missing values to phosphor', () => {
    expect(DEFAULT_ICON_THEME).toBe('phosphor')
    expect(normalizeIconTheme(undefined)).toBe('phosphor')
    expect(normalizeIconTheme('unknown')).toBe('phosphor')
  })

  it('accepts exactly the five bundled themes', () => {
    expect(ICON_THEMES).toEqual(['phosphor', 'lucide', 'fluent', 'hugeicons', 'iconoir'])
    for (const theme of ICON_THEMES) expect(normalizeIconTheme(theme)).toBe(theme)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_CSS_OVERRIDE_CACHE_KEY,
  CUSTOM_CSS_OVERRIDE_STYLE_ID,
  injectCustomCssOverride,
} from '../inject-custom-css'
import { CUSTOM_THEME_STYLE_ID, injectCustomTheme } from '../inject-theme'

describe('custom CSS injection', () => {
  beforeEach(() => {
    delete window.piDesktop
    document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove()
    document.getElementById(CUSTOM_CSS_OVERRIDE_STYLE_ID)?.remove()
    localStorage.clear()
  })

  it('keeps structured theme CSS before the free-form override', () => {
    injectCustomCssOverride({ enabled: true, css: ':root { --brand: #ff0000; }' })
    injectCustomTheme(':root:not(.dark) { --brand: #007acc; }')

    const styles = Array.from(document.head.querySelectorAll('style'))
    const themeIndex = styles.findIndex((style) => style.id === CUSTOM_THEME_STYLE_ID)
    const customIndex = styles.findIndex((style) => style.id === CUSTOM_CSS_OVERRIDE_STYLE_ID)
    expect(themeIndex).toBeGreaterThanOrEqual(0)
    expect(customIndex).toBeGreaterThan(themeIndex)
    expect(document.getElementById(CUSTOM_CSS_OVERRIDE_STYLE_ID)?.textContent).toBe(
      ':root { --brand: #ff0000; }',
    )
    expect(localStorage.getItem(CUSTOM_CSS_OVERRIDE_CACHE_KEY)).toBe(
      ':root { --brand: #ff0000; }',
    )
  })

  it('uses textContent and removes the style plus cache when disabled or empty', () => {
    injectCustomCssOverride({ enabled: true, css: '</style><script>bad()</script>' })
    const style = document.getElementById(CUSTOM_CSS_OVERRIDE_STYLE_ID)
    expect(style?.textContent).toBe('</style><script>bad()</script>')
    expect(document.querySelector('script')).toBeNull()

    injectCustomCssOverride({ enabled: false, css: style?.textContent || '' })
    expect(document.getElementById(CUSTOM_CSS_OVERRIDE_STYLE_ID)).toBeNull()
    expect(localStorage.getItem(CUSTOM_CSS_OVERRIDE_CACHE_KEY)).toBeNull()
  })

  it('does not inject either layer while the startup safe mode is active', () => {
    window.piDesktop = { customThemeDisabled: true } as Window['piDesktop']
    localStorage.setItem('pi-desktop-theme-css', 'cached theme')
    localStorage.setItem(CUSTOM_CSS_OVERRIDE_CACHE_KEY, 'cached custom CSS')

    injectCustomTheme(':root { --brand: #007acc; }')
    injectCustomCssOverride({ enabled: true, css: ':root { --brand: #ff0000; }' })

    expect(document.getElementById(CUSTOM_THEME_STYLE_ID)).toBeNull()
    expect(document.getElementById(CUSTOM_CSS_OVERRIDE_STYLE_ID)).toBeNull()
    expect(localStorage.getItem('pi-desktop-theme-css')).toBe('cached theme')
    expect(localStorage.getItem(CUSTOM_CSS_OVERRIDE_CACHE_KEY)).toBe('cached custom CSS')
  })
})

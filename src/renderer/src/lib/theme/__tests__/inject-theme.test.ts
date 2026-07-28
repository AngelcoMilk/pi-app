import { beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_THEME_CSS_CACHE_KEY,
  CUSTOM_THEME_STYLE_ID,
  injectCustomTheme,
} from '../inject-theme'

describe('custom theme injection', () => {
  beforeEach(() => {
    document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove()
    localStorage.removeItem(CUSTOM_THEME_CSS_CACHE_KEY)
  })

  it('creates one style element and mirrors the CSS for startup hydration', () => {
    injectCustomTheme(':root:not(.dark) { --brand: #007acc; }')
    injectCustomTheme(':root:not(.dark) { --brand: #339cff; }')

    const styles = document.querySelectorAll(`#${CUSTOM_THEME_STYLE_ID}`)
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toBe(':root:not(.dark) { --brand: #339cff; }')
    expect(localStorage.getItem(CUSTOM_THEME_CSS_CACHE_KEY)).toBe(styles[0].textContent)
  })

  it('removes the style and cache when custom theme CSS is empty', () => {
    injectCustomTheme(':root.dark { --brand: #339cff; }')
    injectCustomTheme('')

    expect(document.getElementById(CUSTOM_THEME_STYLE_ID)).toBeNull()
    expect(localStorage.getItem(CUSTOM_THEME_CSS_CACHE_KEY)).toBeNull()
  })
})

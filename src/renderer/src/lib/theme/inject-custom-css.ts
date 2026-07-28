import {
  CUSTOM_CSS_OVERRIDE_CACHE_KEY,
  CUSTOM_CSS_OVERRIDE_STYLE_ID,
  CUSTOM_THEME_STYLE_ID,
  type CustomCssOverride,
} from '@shared/custom-theme'
import { isCustomThemeDisabled } from './theme-runtime-state'

export { CUSTOM_CSS_OVERRIDE_CACHE_KEY, CUSTOM_CSS_OVERRIDE_STYLE_ID } from '@shared/custom-theme'

export function injectCustomCssOverride(override: CustomCssOverride): void {
  const existing = document.getElementById(CUSTOM_CSS_OVERRIDE_STYLE_ID)
  const css = override.css
  if (isCustomThemeDisabled()) {
    existing?.remove()
    return
  }
  if (!override.enabled || !css) {
    existing?.remove()
    localStorage.removeItem(CUSTOM_CSS_OVERRIDE_CACHE_KEY)
    return
  }

  const style = existing ?? document.createElement('style')
  style.id = CUSTOM_CSS_OVERRIDE_STYLE_ID
  style.textContent = css
  const themeStyle = document.getElementById(CUSTOM_THEME_STYLE_ID)
  if (!style.isConnected) {
    if (themeStyle?.nextSibling) document.head.insertBefore(style, themeStyle.nextSibling)
    else document.head.appendChild(style)
  } else if (themeStyle && themeStyle.compareDocumentPosition(style) & Node.DOCUMENT_POSITION_PRECEDING) {
    themeStyle.after(style)
  }
  localStorage.setItem(CUSTOM_CSS_OVERRIDE_CACHE_KEY, css)
}

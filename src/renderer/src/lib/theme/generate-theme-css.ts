import type { CustomTheme, ThemeVariant } from '@shared/custom-theme'
import { deriveThemeVariables } from './derive-theme'

/**
 * 两个选择器互斥且特异度均为 (0,2,0)，避免未分层注入覆盖另一变体。
 * 单侧定制时仍输出另一侧空块，让生成结果始终保持明确的 light/dark 边界。
 */
const LIGHT_SELECTOR = ':root:not(.dark)'
const DARK_SELECTOR = ':root.dark'

function block(selector: string, variant?: ThemeVariant): string {
  const decls = variant
    ? deriveThemeVariables(variant)
        .map((v) => `  ${v.name}: ${v.value};`)
        .join('\n')
    : ''
  return `${selector} {${decls ? `\n${decls}\n` : ''}}`
}

/** 未定制（两槽皆空）返回空串 → 注入层移除 style 与镜像，回到默认态 */
export function generateThemeCss(theme: CustomTheme): string {
  if (!theme.light && !theme.dark) return ''
  return [block(LIGHT_SELECTOR, theme.light), block(DARK_SELECTOR, theme.dark)].join('\n')
}

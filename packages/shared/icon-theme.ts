export const ICON_THEMES = ['phosphor', 'lucide', 'fluent', 'hugeicons', 'iconoir'] as const

export type IconTheme = (typeof ICON_THEMES)[number]

export const DEFAULT_ICON_THEME: IconTheme = 'phosphor'

export function normalizeIconTheme(value: unknown): IconTheme {
  return ICON_THEMES.includes(value as IconTheme) ? (value as IconTheme) : DEFAULT_ICON_THEME
}

import { create } from 'zustand'
import { DEFAULT_ICON_THEME, normalizeIconTheme, type IconTheme } from '@shared/icon-theme'
import { ipcClient } from '@renderer/lib/ipc-client'
import type { AppIconName } from './icon-names'
import type { AppIconComponent, AppIconProps, ThemeIconMap } from './types'
import { phosphorIcons } from './themes/phosphor'
import { lucideIcons } from './themes/lucide'
import { fluentIcons } from './themes/fluent'
import { hugeiconsIcons } from './themes/hugeicons'
import { iconoirIcons } from './themes/iconoir'

interface IconThemeState {
  iconTheme: IconTheme
  setIconTheme: (iconTheme: IconTheme) => void
}

export const useIconThemeStore = create<IconThemeState>((set) => ({
  iconTheme: DEFAULT_ICON_THEME,
  setIconTheme: (iconTheme) => set({ iconTheme }),
}))

const THEME_ICONS = {
  phosphor: phosphorIcons,
  lucide: lucideIcons,
  fluent: fluentIcons,
  hugeicons: hugeiconsIcons,
  iconoir: iconoirIcons,
} satisfies Record<IconTheme, ThemeIconMap>

export function applyIconTheme(theme: IconTheme): void {
  useIconThemeStore.getState().setIconTheme(theme)
}

export async function hydrateIconThemeFromSettings(): Promise<IconTheme> {
  const response = await ipcClient
    .invoke('settings.get', { key: 'iconTheme' })
    .catch(() => ({ settings: {} }))
  const theme = normalizeIconTheme(response?.settings?.iconTheme)
  applyIconTheme(theme)
  return theme
}

function glyphProps(theme: IconTheme, name: AppIconName, props: AppIconProps): AppIconProps {
  const next: AppIconProps & Record<`data-${string}`, string> = {
    ...props,
    'data-icon-theme': theme,
  }
  const filledSquare = name === 'square' && (props.strokeWidth === 0 || props.className?.includes('fill-current'))
  if (filledSquare) {
    next['data-icon-filled'] = 'true'
    if (theme === 'phosphor') (next as AppIconProps & { weight?: string }).weight = 'fill'
    if (theme === 'hugeicons' || theme === 'iconoir') {
      next.fill = 'currentColor'
      next.strokeWidth = 0
    }
  }
  if (theme === 'phosphor' && !('weight' in next)) {
    ;(next as AppIconProps & { weight?: string }).weight = 'regular'
  }
  if ((theme === 'hugeicons' || theme === 'iconoir') && props.strokeWidth !== 0) {
    next.strokeWidth = props.strokeWidth ?? (theme === 'iconoir' ? 1.75 : 1.5)
  }
  if (theme === 'fluent') {
    delete next.strokeWidth
  }
  return next
}

export interface ThemedIconProps extends AppIconProps {
  name: AppIconName
  theme: IconTheme
}

export function ThemedIcon({ name, theme, ...props }: ThemedIconProps) {
  const Glyph = THEME_ICONS[theme][name]
  return <Glyph {...glyphProps(theme, name, props)} />
}

export function createAppIcon(name: AppIconName, displayName: string): AppIconComponent {
  function AppIcon(props: AppIconProps) {
    const theme = useIconThemeStore((state) => state.iconTheme)
    return <ThemedIcon {...props} theme={theme} name={name} />
  }
  AppIcon.displayName = displayName
  return AppIcon
}

export function resolveAppIcon(name: AppIconName): AppIconComponent {
  return createAppIcon(name, name)
}

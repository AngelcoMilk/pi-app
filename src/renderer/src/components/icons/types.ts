import type { ComponentType, SVGProps } from 'react'
import type { AppIconName } from './icon-names'

export interface AppIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
}

export type AppIconComponent = ComponentType<AppIconProps>
export type ThemeGlyph = AppIconComponent
export type ThemeIconMap = Record<AppIconName, ThemeGlyph>

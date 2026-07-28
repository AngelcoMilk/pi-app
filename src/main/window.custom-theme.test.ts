import { describe, expect, it } from 'vitest'
import {
  CUSTOM_THEME_DISABLED_RENDERER_ARGUMENT,
  CUSTOM_THEME_ENABLED_RENDERER_ARGUMENT,
  DISABLE_CUSTOM_THEME_CLI_FLAG,
} from '@shared/custom-theme'
import { customThemeRendererArgument } from './custom-theme-startup'

describe('custom theme renderer startup argument', () => {
  it('forwards one explicit read-only boolean state to preload', () => {
    expect(customThemeRendererArgument(['electron', 'app'])).toBe(CUSTOM_THEME_ENABLED_RENDERER_ARGUMENT)
    expect(customThemeRendererArgument(['electron', 'app', DISABLE_CUSTOM_THEME_CLI_FLAG])).toBe(
      CUSTOM_THEME_DISABLED_RENDERER_ARGUMENT,
    )
  })
})

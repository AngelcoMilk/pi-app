import {
  CUSTOM_THEME_DISABLED_RENDERER_ARGUMENT,
  CUSTOM_THEME_ENABLED_RENDERER_ARGUMENT,
  DISABLE_CUSTOM_THEME_CLI_FLAG,
} from '@shared/custom-theme'

export function customThemeRendererArgument(argv: readonly string[] = process.argv): string {
  return argv.includes(DISABLE_CUSTOM_THEME_CLI_FLAG)
    ? CUSTOM_THEME_DISABLED_RENDERER_ARGUMENT
    : CUSTOM_THEME_ENABLED_RENDERER_ARGUMENT
}

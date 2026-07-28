import { describe, expect, it } from 'vitest'
import type { ThemeVariant } from '@shared/custom-theme'
import { exportThemeString, parseThemeString } from '../parse-theme-string'

const USER_SAMPLE = {
  codeThemeId: 'vscode-plus',
  theme: {
    accent: '#007acc',
    contrast: 45,
    fonts: { code: null, ui: null },
    ink: '#000000',
    opaqueWindows: false,
    semanticColors: { diffAdded: '#008000', diffRemoved: '#ee0000', skill: '#0000ff' },
    variant: 'light',
    surface: '#ffffff',
  },
}

function encoded(prefix: 'pi-theme-v1' | 'codex-theme-v1', value: unknown = USER_SAMPLE): string {
  return `${prefix}:${JSON.stringify(value)}`
}

describe('parseThemeString', () => {
  it('normalizes pi and codex prefixes through the same payload path', () => {
    const pi = parseThemeString(encoded('pi-theme-v1'))
    const codex = parseThemeString(encoded('codex-theme-v1'))

    expect(pi.themeVariant).toEqual(codex.themeVariant)
    expect(pi.targetVariant).toBe('light')
    expect(codex.targetVariant).toBe('light')
    expect(pi.sourcePrefix).toBe('pi-theme-v1')
    expect(codex.sourcePrefix).toBe('codex-theme-v1')
  })

  it('imports the user sample and maps opaqueWindows plus semantic colors', () => {
    const parsed = parseThemeString(encoded('codex-theme-v1'))

    expect(parsed.themeVariant).toEqual({
      preset: null,
      accent: '#007acc',
      surface: '#ffffff',
      ink: '#000000',
      contrast: 45,
      fontUi: null,
      fontCode: null,
      translucentSidebar: true,
      diffAdded: '#008000',
      diffRemoved: '#ee0000',
    })
    expect(parsed.ignoredFieldNames).toEqual(['codeThemeId', 'theme.semanticColors.skill'])
    expect(parsed.ignoredFieldCount).toBe(2)
  })

  it('uses an explicit fallback variant only when the payload omits variant', () => {
    const value = structuredClone(USER_SAMPLE)
    delete (value.theme as { variant?: string }).variant

    expect(parseThemeString(encoded('pi-theme-v1', value), 'dark').targetVariant).toBe('dark')
    expect(() => parseThemeString(encoded('pi-theme-v1', value))).toThrow('theme.variant is required')
    expect(() =>
      parseThemeString(
        encoded('pi-theme-v1', { ...USER_SAMPLE, theme: { ...USER_SAMPLE.theme, variant: 'system' } }),
        'dark',
      ),
    ).toThrow('theme.variant must be light or dark')
  })

  it('normalizes #rgb and drops #rrggbbaa alpha', () => {
    const parsed = parseThemeString(
      encoded('pi-theme-v1', {
        theme: {
          ...USER_SAMPLE.theme,
          accent: '#0ac',
          surface: '#ffffff80',
          semanticColors: { diffAdded: '#008000ff', diffRemoved: '#e00' },
        },
      }),
    )

    expect(parsed.themeVariant).toMatchObject({
      accent: '#00aacc',
      surface: '#ffffff',
      diffAdded: '#008000',
      diffRemoved: '#ee0000',
    })
  })

  it('defaults non-numeric contrast, clamps numeric contrast, and normalizes fonts', () => {
    const defaulted = parseThemeString(
      encoded('pi-theme-v1', {
        theme: {
          ...USER_SAMPLE.theme,
          variant: 'dark',
          contrast: '80',
          fonts: { ui: '', code: '  JetBrains Mono  ' },
        },
      }),
    )
    const clamped = parseThemeString(
      encoded('pi-theme-v1', { theme: { ...USER_SAMPLE.theme, contrast: 140 } }),
    )

    expect(defaulted.themeVariant.contrast).toBe(60)
    expect(defaulted.themeVariant.fontUi).toBeNull()
    expect(defaulted.themeVariant.fontCode).toBe('JetBrains Mono')
    expect(clamped.themeVariant.contrast).toBe(100)
  })

  it('fails atomically with the invalid field path instead of returning a partial theme', () => {
    expect(() =>
      parseThemeString(
        encoded('codex-theme-v1', {
          theme: { ...USER_SAMPLE.theme, semanticColors: { diffAdded: 'green' } },
        }),
      ),
    ).toThrow('theme.semanticColors.diffAdded')
    expect(() => parseThemeString(JSON.stringify(USER_SAMPLE))).toThrow('must start with')
  })

  it('counts unsupported known and unknown fields without rejecting the payload', () => {
    const parsed = parseThemeString(
      encoded('codex-theme-v1', {
        codeThemeId: 'vscode-plus',
        futureEnvelope: true,
        theme: {
          ...USER_SAMPLE.theme,
          futureThemeField: 1,
          fonts: { ...USER_SAMPLE.theme.fonts, futureFontField: 'x' },
          semanticColors: { ...USER_SAMPLE.theme.semanticColors, futureSemantic: '#123456' },
        },
      }),
    )

    expect(parsed.ignoredFieldNames).toEqual([
      'codeThemeId',
      'futureEnvelope',
      'theme.fonts.futureFontField',
      'theme.futureThemeField',
      'theme.semanticColors.futureSemantic',
      'theme.semanticColors.skill',
    ])
    expect(parsed.ignoredFieldCount).toBe(6)
  })
})

describe('exportThemeString', () => {
  it('round-trips every supported field without exporting codeThemeId or skill', () => {
    const themeVariant: ThemeVariant = {
      preset: 'vscode-plus',
      accent: '#007acc',
      surface: '#fefefe',
      ink: '#111111',
      contrast: 48,
      fontUi: 'Segoe UI',
      fontCode: 'JetBrains Mono',
      translucentSidebar: true,
      diffAdded: '#008000',
      diffRemoved: '#ee0000',
    }

    const exported = exportThemeString(themeVariant, 'light')
    const parsed = parseThemeString(exported)

    expect(exported.startsWith('pi-theme-v1:')).toBe(true)
    expect(exported).not.toContain('codeThemeId')
    expect(exported).not.toContain('"skill"')
    expect(parsed).toMatchObject({
      targetVariant: 'light',
      themeVariant,
      ignoredFieldCount: 0,
      ignoredFieldNames: [],
      sourcePrefix: 'pi-theme-v1',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { settingsSetSchema } from './schemas'

const customTheme = {
  light: {
    preset: 'vscode-plus',
    accent: '#007acc',
    surface: '#ffffff',
    ink: '#000000',
    contrast: 45,
    fontUi: null,
    fontCode: null,
    translucentSidebar: true,
    diffAdded: '#008000',
    diffRemoved: '#ee0000',
  },
}

describe('settings custom theme schema', () => {
  it('accepts a complete custom theme value and null reset', () => {
    expect(settingsSetSchema.safeParse({ key: 'customTheme', value: customTheme }).success).toBe(true)
    expect(settingsSetSchema.safeParse({ key: 'customTheme', value: null }).success).toBe(true)
  })

  it('accepts one strict custom CSS override object', () => {
    expect(
      settingsSetSchema.safeParse({
        key: 'customCssOverride',
        value: { enabled: true, css: ':root { --brand: red; }' },
      }).success,
    ).toBe(true)
    expect(
      settingsSetSchema.safeParse({
        key: 'customCssOverride',
        value: { enabled: true, css: '', extra: true },
      }).success,
    ).toBe(false)
  })

  it('rejects partial or malformed variants before they reach config-store', () => {
    expect(
      settingsSetSchema.safeParse({
        key: 'customTheme',
        value: { light: { ...customTheme.light, accent: 'rgb(0, 122, 204)' } },
      }).success,
    ).toBe(false)
    expect(
      settingsSetSchema.safeParse({
        key: 'customTheme',
        value: { light: { ...customTheme.light, contrast: 101 } },
      }).success,
    ).toBe(false)
    expect(
      settingsSetSchema.safeParse({
        key: 'customTheme',
        value: { light: { ...customTheme.light, unknownField: true } },
      }).success,
    ).toBe(false)
    expect(
      settingsSetSchema.safeParse({
        key: 'customTheme',
        value: { light: { ...customTheme.light, fontUi: "Bad'; color: red" } },
      }).success,
    ).toBe(false)
  })
})

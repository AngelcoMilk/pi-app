import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyThemeToDocument, watchSystemTheme, type ThemeChoice } from '../settings-draft'

describe('applyThemeToDocument', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-color-scheme: dark') ? false : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  it('should_add_dark_class_when_theme_is_dark', () => {
    applyThemeToDocument('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should_remove_dark_class_when_theme_is_light', () => {
    document.documentElement.classList.add('dark')
    applyThemeToDocument('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('should_follow_system_pref_when_theme_is_system', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-color-scheme: dark'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    applyThemeToDocument('system' satisfies ThemeChoice)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should_follow_system_changes_only_while_the_applied_theme_is_system', () => {
    let onChange: (() => void) | undefined
    const media = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        onChange = listener
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
    vi.stubGlobal('matchMedia', vi.fn(() => media))

    applyThemeToDocument('system')
    const unwatch = watchSystemTheme()
    media.matches = true
    onChange?.()
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    applyThemeToDocument('light')
    media.matches = true
    onChange?.()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    unwatch()
    expect(media.removeEventListener).toHaveBeenCalledWith('change', onChange)
  })
})

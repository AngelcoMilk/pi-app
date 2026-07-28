import { describe, expect, it, vi } from 'vitest'
import {
  CUSTOM_THEME_DISABLED_RENDERER_ARGUMENT,
  CUSTOM_THEME_ENABLED_RENDERER_ARGUMENT,
} from '@shared/custom-theme'

const exposeInMainWorld = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), off: vi.fn() },
  webUtils: { getPathForFile: vi.fn() },
}))

describe('preload custom theme startup state', () => {
  it.each([
    [CUSTOM_THEME_DISABLED_RENDERER_ARGUMENT, true],
    [CUSTOM_THEME_ENABLED_RENDERER_ARGUMENT, false],
  ] as const)('exposes %s as customThemeDisabled=%s', async (argument, expected) => {
    const previousArgv = process.argv
    const previousContextIsolated = process.contextIsolated
    Object.defineProperty(process, 'argv', {
      configurable: true,
      value: ['electron', 'preload', argument],
    })
    Object.defineProperty(process, 'contextIsolated', { configurable: true, value: true })
    exposeInMainWorld.mockReset()
    vi.resetModules()

    await import('../preload/index')

    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'piDesktop',
      expect.objectContaining({ customThemeDisabled: expected }),
    )
    Object.defineProperty(process, 'argv', { configurable: true, value: previousArgv })
    Object.defineProperty(process, 'contextIsolated', {
      configurable: true,
      value: previousContextIsolated,
    })
  })
})

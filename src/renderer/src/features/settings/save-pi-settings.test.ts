import { describe, expect, it, vi } from 'vitest'
import { savePiSettingsDraft } from './save-pi-settings'

describe('savePiSettingsDraft', () => {
  it('should_persist_defaults_without_switching_the_current_session_model', async () => {
    const calls: string[] = []
    const setSettings = vi.fn(async () => {
      calls.push('set')
      return { ok: true }
    })
    const reload = vi.fn(async () => {
      calls.push('reload')
    })
    const refreshComposer = vi.fn(async () => {
      calls.push('refresh')
    })

    await savePiSettingsDraft(
      { defaultProvider: 'openai', defaultModel: 'gpt-5' },
      { setSettings, reload, refreshComposer },
    )

    expect(setSettings).toHaveBeenCalledWith({
      defaultProvider: 'openai',
      defaultModel: 'gpt-5',
    })
    expect(calls).toEqual(['set', 'reload', 'refresh'])
  })

  it('should_keep_the_existing_display_when_settings_save_fails', async () => {
    const reload = vi.fn(async () => {})
    const refreshComposer = vi.fn(async () => {})

    await expect(
      savePiSettingsDraft(
        { defaultProvider: 'openai', defaultModel: 'gpt-5' },
        {
          setSettings: vi.fn(async () => ({ ok: false, error: 'write failed' })),
          reload,
          refreshComposer,
        },
      ),
    ).rejects.toThrow('write failed')
    expect(reload).not.toHaveBeenCalled()
    expect(refreshComposer).not.toHaveBeenCalled()
  })
})

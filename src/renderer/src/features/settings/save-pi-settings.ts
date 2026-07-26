import type { PiSettingsSnapshot } from './pi-settings-shared'

export async function savePiSettingsDraft(
  draft: PiSettingsSnapshot,
  deps: {
    setSettings: (draft: PiSettingsSnapshot) => Promise<{ ok?: boolean; error?: string }>
    reload: () => Promise<void>
    refreshComposer: () => Promise<void>
  },
): Promise<void> {
  const result = await deps.setSettings(draft)
  if (result.ok === false) throw new Error(result.error || 'SAVE_FAILED')
  await deps.reload()
  await deps.refreshComposer()
}

import { describe, expect, it } from 'vitest'
import { ICON_THEMES } from '@shared/icon-theme'
import { settingsSetSchema } from './schemas'

describe('icon theme settings schema', () => {
  it('accepts every bundled icon theme', () => {
    for (const value of ICON_THEMES) {
      expect(settingsSetSchema.safeParse({ key: 'iconTheme', value }).success).toBe(true)
    }
  })

  it('rejects unknown icon themes', () => {
    expect(settingsSetSchema.safeParse({ key: 'iconTheme', value: 'system' }).success).toBe(false)
  })
})

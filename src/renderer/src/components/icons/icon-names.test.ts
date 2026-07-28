import { describe, expect, it } from 'vitest'
import { normalizeLegacyIconName } from './icon-names'

describe('legacy icon name compatibility', () => {
  it('normalizes PascalCase and historical lowercase values', () => {
    expect(normalizeLegacyIconName('Globe')).toBe('globe')
    expect(normalizeLegacyIconName('globe')).toBe('globe')
    expect(normalizeLegacyIconName('MessageCircleQuestion')).toBe('message-circle-question')
  })

  it('returns undefined for unknown values', () => {
    expect(normalizeLegacyIconName('NotARealIcon')).toBeUndefined()
    expect(normalizeLegacyIconName(null)).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { segmentsToPromptPayload } from './attachment-text'

describe('segmentsToPromptPayload line-ref', () => {
  it('emits @path:line for line-ref chips', () => {
    const payload = segmentsToPromptPayload([
      { type: 'text', text: 'fix ' },
      {
        type: 'file',
        attachment: {
          path: 'src/a.ts',
          name: 'a.ts:10',
          kind: 'line-ref',
          line: 10,
        },
      },
      { type: 'text', text: ' please' },
    ])
    expect(payload).toBe('fix @src/a.ts:10 please')
  })

  it('keeps workspace-relative spaces, Unicode, and Windows separators parseable', () => {
    const payload = segmentsToPromptPayload([
      {
        type: 'file',
        attachment: {
          path: 'src\\组件 file.ts',
          name: '组件 file.ts',
          kind: 'code',
        },
      },
    ])
    expect(payload).toBe('@"src/组件 file.ts"')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimelineItem } from '@renderer/stores/ui-store-types'

const invoke = vi.fn()

vi.mock('@renderer/lib/ipc-client', () => ({
  ipcClient: { invoke },
}))

function item(id: string): TimelineItem {
  return { id, type: 'user-message', text: id, timestamp: 1 }
}

describe('loadAuthoritativeForOpen catch-up', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('fetches older pages when totalCount exceeds first tail', async () => {
    const pageSize = 80
    const total = 150
    const tail80 = Array.from({ length: 80 }, (_, i) => item(`t${i}`))
    const older70 = Array.from({ length: 70 }, (_, i) => item(`o${i}`))

    invoke.mockImplementation(async (_ch: string, req: { offset?: number; limit?: number }) => {
      const offset = req.offset ?? 0
      const limit = req.limit ?? pageSize
      if (offset === 0) {
        return { items: tail80, totalCount: total }
      }
      if (offset === 80) {
        return { items: older70.slice(0, limit), totalCount: total }
      }
      return { items: [], totalCount: total }
    })

    const { loadAuthoritativeForOpen } = await import('./session-timeline-sync')
    const r = await loadAuthoritativeForOpen('/sess.jsonl', pageSize)
    expect(r.totalCount).toBe(150)
    expect(r.items.length).toBe(150)
    expect(r.cursor.loadedOffsetFromEnd).toBe(150)
    expect(invoke.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('should_advance_raw_offset_when_projection_collapses_rows', async () => {
    const requests: number[] = []
    invoke.mockImplementation(async (_channel: string, request: { offset?: number }) => {
      const offset = request.offset ?? 0
      requests.push(offset)
      if (offset === 0) {
        return {
          items: [
            { id: 'assistant-fragment-1', type: 'assistant-message', text: 'Hel', timestamp: 3 },
            { id: 'assistant-fragment-2', type: 'assistant-message', text: 'lo', timestamp: 4 },
          ],
          totalCount: 4,
        }
      }
      if (offset === 2) {
        return {
          items: [item('older-1'), item('older-2')],
          totalCount: 4,
        }
      }
      return { items: [], totalCount: 4 }
    })

    const { loadAuthoritativeForOpen } = await import('./session-timeline-sync')
    const result = await loadAuthoritativeForOpen('/collapsed.jsonl', 2)

    expect(requests).toEqual([0, 2])
    expect(result.cursor.loadedOffsetFromEnd).toBe(4)
  })
})
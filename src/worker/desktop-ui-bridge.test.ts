import { describe, expect, it, vi } from 'vitest'
import { createDesktopUIBridge } from './desktop-ui-bridge'

function fakeEventBus() {
  return { on: vi.fn(() => vi.fn()) } as never
}

describe('createDesktopUIBridge', () => {
  it('acknowledges only responses for a live pending request', async () => {
    const requests: Array<{ id: string }> = []
    const bridge = createDesktopUIBridge(fakeEventBus(), (request) => requests.push(request))
    const select = bridge.uiContext.select as (
      title: string,
      options: string[],
    ) => Promise<string | undefined>
    const answer = select('Pick', ['A', 'B'])

    expect(bridge.handleExtensionUIResponse({ id: 'unknown', value: 'A' })).toBe(false)
    expect(bridge.handleExtensionUIResponse({ id: requests[0].id, value: 'B' })).toBe(true)
    await expect(answer).resolves.toBe('B')
  })

  it('resolves pending dialogs and emits terminal dismissals on session replacement', async () => {
    const requests: Array<{ id: string }> = []
    const dismiss = vi.fn()
    const bridge = createDesktopUIBridge(
      fakeEventBus(),
      (request) => requests.push(request),
      dismiss,
    )
    const confirm = bridge.uiContext.confirm as (
      title: string,
      message: string,
    ) => Promise<boolean>
    const answer = confirm('Confirm', 'Continue?')

    bridge.cancelAll('session-replaced')

    await expect(answer).resolves.toBe(false)
    expect(dismiss).toHaveBeenCalledWith(requests[0].id, 'session-replaced')
  })

  it('cancels a scoped questionnaire when its tool signal aborts', async () => {
    const requests: Array<{ id: string }> = []
    const dismiss = vi.fn()
    const bridge = createDesktopUIBridge(
      fakeEventBus(),
      (request) => requests.push(request),
      dismiss,
    )
    const controller = new AbortController()
    const pending = bridge.requestQuestionnaire('tool-call-1', [], controller.signal)

    controller.abort()

    await expect(pending).resolves.toEqual({ cancelled: true, answers: [] })
    expect(dismiss).toHaveBeenCalledWith(requests[0].id, 'abort')
    expect(bridge.handleExtensionUIResponse({ id: requests[0].id, result: {} })).toBe(false)
  })
})

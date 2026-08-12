import { describe, expect, it, vi } from 'vitest'
import type { WorkerSlot } from '../worker-manager-types'
import { bindWorkerSlotToSession } from '../worker-session-binding'

function fakeSlot(): WorkerSlot {
  return {
    poolKey: 'ws:/workspace',
    cwd: '/workspace',
    runtime: { mode: 'host', distro: null },
    sessionFile: null,
    targetSessionFile: null,
    verifiedSessionFile: null,
    bindingTargetSessionFile: null,
    bindingPromise: null,
    worker: {} as WorkerSlot['worker'],
    pendingRequests: new Map(),
    requestCounter: 0,
    initResolver: null,
    initRejecter: null,
    initPromise: null,
    agentTurnActive: false,
    pendingExtensionUiCount: 0,
    lastIdleAt: 0,
    lastForegroundAt: 0,
    sdkFallback: false,
    autoRestartEnabled: true,
    stopping: false,
  }
}

describe('bindWorkerSlotToSession', () => {
  it('marks a session verified only after the worker acknowledges the same path', async () => {
    const slot = fakeSlot()
    let acknowledge: ((value: Record<string, unknown>) => void) | undefined
    const request = vi.fn(
      () => new Promise<Record<string, unknown>>((resolve) => {
        acknowledge = resolve
      }),
    )

    const binding = bindWorkerSlotToSession(slot, '/sessions/a.jsonl', request)

    expect(slot.targetSessionFile).toBe('/sessions/a.jsonl')
    expect(slot.verifiedSessionFile).toBeNull()
    acknowledge?.({ type: 'loadSession-done', sessionFile: '/sessions/a.jsonl' })
    await binding
    expect(slot.verifiedSessionFile).toBe('/sessions/a.jsonl')
    expect(slot.bindingPromise).toBeNull()
  })

  it('clears a claimed binding and rejects when the worker acknowledges another path', async () => {
    const slot = fakeSlot()
    const request = vi.fn(async () => ({
      type: 'loadSession-done',
      sessionFile: '/sessions/b.jsonl',
    }))

    await expect(
      bindWorkerSlotToSession(slot, '/sessions/a.jsonl', request),
    ).rejects.toThrow('WORKER_SESSION_BIND_MISMATCH')
    expect(slot.sessionFile).toBeNull()
    expect(slot.targetSessionFile).toBeNull()
    expect(slot.verifiedSessionFile).toBeNull()
  })

  it('reuses an already verified binding without another worker request', async () => {
    const slot = fakeSlot()
    slot.sessionFile = '/sessions/a.jsonl'
    slot.targetSessionFile = '/sessions/a.jsonl'
    slot.verifiedSessionFile = '/sessions/a.jsonl'
    const request = vi.fn()

    await bindWorkerSlotToSession(slot, '/sessions/a.jsonl', request)

    expect(request).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { WorkerSlot } from '../worker-manager-types'
import { ExtensionUIRequestRegistry } from '../extension-ui-request-registry'

function fakeSlot(sessionFile: string): WorkerSlot {
  return {
    poolKey: sessionFile,
    cwd: '/workspace',
    runtime: { mode: 'host', distro: null },
    sessionFile,
    worker: {
      kind: 'utilityProcess',
      postMessage: vi.fn(),
      onMessage: vi.fn(),
      onExit: vi.fn(),
      onStdout: vi.fn(),
      onStderr: vi.fn(),
      kill: vi.fn(),
    },
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

describe('ExtensionUIRequestRegistry', () => {
  it('keeps concurrent requests bound to their origin slots', () => {
    const registry = new ExtensionUIRequestRegistry()
    const first = fakeSlot('/sessions/a.jsonl')
    const second = fakeSlot('/sessions/b.jsonl')

    registry.register(first, '/sessions/a.jsonl', {
      id: 'request-a',
      method: 'confirm',
      title: 'A',
      message: 'A?',
    })
    registry.register(second, '/sessions/b.jsonl', {
      id: 'request-b',
      method: 'input',
      title: 'B',
    })

    expect(registry.beginResponse('request-b')?.slot).toBe(second)
    expect(registry.beginResponse('request-a')?.slot).toBe(first)
    expect(first.pendingExtensionUiCount).toBe(1)
    expect(second.pendingExtensionUiCount).toBe(1)
  })

  it('rejects a request whose reported session does not match the slot binding', () => {
    const registry = new ExtensionUIRequestRegistry()
    const slot = fakeSlot('/sessions/a.jsonl')

    expect(
      registry.register(slot, '/sessions/b.jsonl', {
        id: 'wrong-session',
        method: 'input',
        title: 'Wrong',
      }),
    ).toBeNull()
    expect(slot.pendingExtensionUiCount).toBe(0)
  })

  it('releases a slot lease only after a handled response or terminal dismissal', () => {
    const registry = new ExtensionUIRequestRegistry()
    const slot = fakeSlot('/sessions/a.jsonl')
    registry.register(slot, slot.sessionFile!, {
      id: 'request-a',
      method: 'confirm',
      title: 'A',
      message: 'A?',
    })

    registry.beginResponse('request-a')
    expect(registry.finishResponse('request-a', false)).toBeNull()
    expect(slot.pendingExtensionUiCount).toBe(1)
    registry.beginResponse('request-a')
    expect(registry.finishResponse('request-a', true)?.id).toBe('request-a')
    expect(slot.pendingExtensionUiCount).toBe(0)
  })
})

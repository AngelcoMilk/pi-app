import { beforeEach, describe, expect, it } from 'vitest'
import { useExtensionUIStore } from '../extension-ui-store'

describe('extension-ui-store session isolation', () => {
  beforeEach(() => {
    useExtensionUIStore.setState({
      pendingById: {},
      activeRequestId: null,
      activePending: null,
      suspendedById: {},
    })
  })

  it('retains both sessions while only activating the visible session', () => {
    const store = useExtensionUIStore.getState()
    store.upsertPending({
      id: 'a',
      sessionFile: '/sessions/a.jsonl',
      createdAt: 1,
      method: 'input',
      title: 'A',
    })
    store.upsertPending({
      id: 'b',
      sessionFile: '/sessions/b.jsonl',
      createdAt: 2,
      method: 'confirm',
      title: 'B',
      message: 'B?',
    })

    store.activateForSession('/sessions/a.jsonl')
    expect(useExtensionUIStore.getState().activePending?.id).toBe('a')
    store.resetForSessionContext()
    expect(Object.keys(useExtensionUIStore.getState().pendingById)).toEqual(['a', 'b'])
    store.activateForSession('/sessions/b.jsonl', true)
    expect(useExtensionUIStore.getState().activePending?.id).toBe('b')
  })

  it('restores the matching suspended request by request id', () => {
    const store = useExtensionUIStore.getState()
    store.upsertPending({
      id: 'a',
      sessionFile: '/sessions/a.jsonl',
      createdAt: 1,
      method: 'input',
      title: 'A',
    })
    store.activateForSession('/sessions/a.jsonl')
    store.suspendActive({ timelineItemId: 'tool-a' })
    expect(useExtensionUIStore.getState().activePending).toBeNull()

    store.resumeSuspended('a')
    expect(useExtensionUIStore.getState().activePending?.id).toBe('a')
  })
})

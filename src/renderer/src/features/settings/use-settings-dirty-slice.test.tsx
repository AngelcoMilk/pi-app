import { useState } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  commitAllSettingsSlices,
  getDirtySettingsSlices,
  subscribeSettingsDirty,
} from './settings-dirty-registry'
import { useSettingsDirtySlice } from './use-settings-dirty-slice'

function DirtySliceHarness({ commitError }: { commitError?: Error }) {
  const [dirty, setDirty] = useState(true)

  useSettingsDirtySlice({
    id: 'pi-models',
    label: 'Model config',
    isDirty: () => dirty,
    commit: async () => {
      if (commitError) throw commitError
      setDirty(false)
    },
    discard: () => setDirty(false),
  })

  return null
}

async function flushDirtyNotifications(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

afterEach(() => {
  cleanup()
})

describe('useSettingsDirtySlice', () => {
  it('should_notify_registry_when_commit_makes_slice_clean', async () => {
    const dirtySnapshots: string[][] = []
    const unsubscribe = subscribeSettingsDirty(() => {
      dirtySnapshots.push(getDirtySettingsSlices().map((slice) => slice.id))
    })

    render(<DirtySliceHarness />)
    await flushDirtyNotifications()
    expect(dirtySnapshots.at(-1)).toEqual(['pi-models'])

    await act(async () => {
      await commitAllSettingsSlices()
    })
    await flushDirtyNotifications()

    expect(getDirtySettingsSlices()).toEqual([])
    expect(dirtySnapshots.at(-1)).toEqual([])
    unsubscribe()
  })

  it('should_keep_slice_dirty_when_commit_fails', async () => {
    const error = new Error('write failed')
    render(<DirtySliceHarness commitError={error} />)
    await flushDirtyNotifications()

    await expect(commitAllSettingsSlices()).rejects.toThrow('write failed')
    expect(getDirtySettingsSlices().map((slice) => slice.id)).toEqual(['pi-models'])
  })

  it('should_unregister_slice_when_hook_unmounts', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSettingsDirty(listener)
    const view = render(<DirtySliceHarness />)
    await flushDirtyNotifications()

    const callsBeforeUnmount = listener.mock.calls.length
    view.unmount()
    await flushDirtyNotifications()

    expect(getDirtySettingsSlices()).toEqual([])
    expect(listener.mock.calls.length).toBeGreaterThan(callsBeforeUnmount)
    unsubscribe()
  })
})

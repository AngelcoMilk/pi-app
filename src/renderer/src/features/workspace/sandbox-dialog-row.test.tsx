import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '@renderer/stores/ui-store'
import type { SandboxEntry } from './project-sidebar-types'
import { SandboxDialogRow } from './sandbox-dialog-row'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) }
})

function sandbox(overrides?: Partial<SandboxEntry>): SandboxEntry {
  return {
    id: 'sandbox-a',
    path: '/sandboxes/a',
    label: 'Sandbox A',
    createdAt: 1,
    kind: 'sandbox',
    sessionId: 'session-a',
    sessionFile: '/sessions/a.jsonl',
    ...overrides,
  }
}

function renderRow(box: SandboxEntry, active: boolean) {
  return render(
    <SandboxDialogRow
      box={box}
      active={active}
      onOpen={vi.fn()}
      onContextMenu={vi.fn()}
    />,
  )
}

describe('SandboxDialogRow running indicator', () => {
  beforeEach(() => useUIStore.setState({ sessionRuntimeRunning: {} }))

  it('shows the indicator for the current running sandbox', () => {
    useUIStore.setState({ sessionRuntimeRunning: { '/sessions/a.jsonl': true } })
    const { container } = renderRow(sandbox(), true)
    expect(container.querySelector('.session-running-pixel-grid')).toBeInTheDocument()
  })

  it('shows the indicator for a background running sandbox with a normalized path match', () => {
    useUIStore.setState({ sessionRuntimeRunning: { 'c:\\sessions\\a.jsonl': true } })
    const { container } = renderRow(sandbox({ sessionFile: 'C:/sessions/a.jsonl' }), false)
    expect(container.querySelector('.session-running-pixel-grid')).toBeInTheDocument()
  })

  it('does not show the indicator for an idle sandbox', () => {
    useUIStore.setState({ sessionRuntimeRunning: { '/sessions/a.jsonl': false } })
    const { container } = renderRow(sandbox(), true)
    expect(container.querySelector('.session-running-pixel-grid')).not.toBeInTheDocument()
  })

  it('does not show the indicator when the sandbox has no session file', () => {
    useUIStore.setState({ sessionRuntimeRunning: { '/sessions/a.jsonl': true } })
    const { container } = renderRow(sandbox({ sessionFile: undefined }), true)
    expect(container.querySelector('.session-running-pixel-grid')).not.toBeInTheDocument()
  })
})

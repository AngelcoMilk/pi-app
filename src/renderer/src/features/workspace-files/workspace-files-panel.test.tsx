import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '@renderer/stores/ui-store'
import { WorkspaceFilesPanel } from './workspace-files-panel'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) }
})
vi.mock('sonner', () => ({ toast: { message: vi.fn(), error: vi.fn() } }))
vi.mock('@renderer/lib/ipc-client', () => ({
  ipcClient: { invoke: vi.fn(async () => ({ ok: true })) },
}))
vi.mock('./use-workspace-fs', () => ({
  useWorkspaceFs: () => ({
    listDir: vi.fn(async () => ({ ok: true, entries: [] })),
    readText: vi.fn(async () => ({ ok: true, content: '' })),
  }),
}))
vi.mock('./file-tree', () => ({ FileTree: () => <div data-testid="file-tree" /> }))
vi.mock('./file-preview-router', () => ({
  FilePreviewRouter: ({ relativePath }: { relativePath: string }) => (
    <div data-testid="file-preview">{relativePath}</div>
  ),
}))
vi.mock('./files-context-menu-portal', () => ({ FilesContextMenuPortal: () => null }))
vi.mock('./file-preview-tab-bar', () => ({
  FilePreviewTabBar: ({ trailing }: { trailing: React.ReactNode }) => <div>{trailing}</div>,
}))

function openPreview(path = 'src/a.ts'): void {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('pi-desktop:open-workspace-file', { detail: { rel: path } }),
    )
  })
}

function expandButton(): HTMLButtonElement {
  return screen.getByTitle(/chrome\.(expand|collapse)Preview/) as HTMLButtonElement
}

describe('WorkspaceFilesPanel preview expansion', () => {
  beforeEach(() => {
    useUIStore.setState({
      currentWorkspace: '/repo-a',
      activePanel: 'files',
      filesPreviewChatExpand: false,
      rightPanelCollapsed: false,
    })
  })

  it('resets preview tabs and expansion when the workspace changes', () => {
    render(<WorkspaceFilesPanel />)
    openPreview()
    fireEvent.click(expandButton())
    expect(useUIStore.getState().filesPreviewChatExpand).toBe(true)
    expect(screen.getByTestId('file-preview')).toHaveTextContent('src/a.ts')

    act(() => useUIStore.getState().setWorkspace('/repo-b'))

    expect(useUIStore.getState().filesPreviewChatExpand).toBe(false)
    expect(screen.queryByTestId('file-preview')).not.toBeInTheDocument()
  })

  it('allows a stale expanded state to collapse without an active preview path', () => {
    render(<WorkspaceFilesPanel />)
    act(() => useUIStore.setState({ filesPreviewChatExpand: true }))

    expect(expandButton()).not.toBeDisabled()
    fireEvent.click(expandButton())
    expect(useUIStore.getState().filesPreviewChatExpand).toBe(false)
  })

  it('keeps an open preview expanded across same-workspace updates', () => {
    render(<WorkspaceFilesPanel />)
    openPreview()
    fireEvent.click(expandButton())

    act(() => useUIStore.setState({ rightPanelWidth: 420 }))

    expect(useUIStore.getState().filesPreviewChatExpand).toBe(true)
    expect(screen.getByTestId('file-preview')).toHaveTextContent('src/a.ts')
  })
})

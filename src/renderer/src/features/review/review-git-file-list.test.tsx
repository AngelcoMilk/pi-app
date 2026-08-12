import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DiffFile } from '@shared/diff-model'
import { ReviewGitFileList } from './review-git-file-list'

vi.mock('@renderer/lib/ipc-client', () => ({
  ipcClient: { invoke: vi.fn(async () => ({})) },
}))

function diffFile(generated: boolean): DiffFile {
  return {
    path: 'src/a.ts',
    status: 'modified',
    changeType: 'modified',
    additions: 1,
    deletions: 0,
    hunks: [],
    binary: false,
    large: false,
    generated,
  }
}

describe('ReviewGitFileList', () => {
  it('preserves an expanded file row when its snapshot updates', () => {
    const props = {
      files: [{ path: 'src/a.ts', changeType: 'modified', staged: false }],
      mode: 'inline' as const,
      cwd: '/repo',
      expandedPath: null,
      focusPath: null,
    }
    const { rerender } = render(
      <ReviewGitFileList {...props} diffFiles={[diffFile(false)]} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /src\/a\.ts/ }))

    rerender(<ReviewGitFileList {...props} diffFiles={[diffFile(true)]} />)

    expect(screen.getByText('生成文件')).toBeInTheDocument()
  })
})

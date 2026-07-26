import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComposerFilePopover } from './composer-file-popover'

describe('ComposerFilePopover', () => {
  it('keeps pointer hover and click aligned with the selected file entry', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 400,
      left: 20,
      right: 420,
      top: 400,
      bottom: 500,
      width: 400,
      height: 100,
      toJSON: () => ({}),
    })
    const setSelectedIdx = vi.fn()
    const onAccept = vi.fn()

    render(
      <ComposerFilePopover
        show
        loading={false}
        anchorRef={{ current: anchor }}
        entries={[
          { path: 'src', name: 'src', isDirectory: true },
          { path: 'src/a.ts', name: 'a.ts', isDirectory: false },
        ]}
        selectedIdx={0}
        setSelectedIdx={setSelectedIdx}
        onAccept={onAccept}
      />,
    )

    const fileRow = screen.getByRole('button', { name: /a\.ts/ })
    fireEvent.mouseEnter(fileRow)
    expect(setSelectedIdx).toHaveBeenCalled()
    fireEvent.click(fileRow)
    expect(onAccept).toHaveBeenCalledWith({
      path: 'src/a.ts',
      name: 'a.ts',
      isDirectory: false,
    })
  })
})

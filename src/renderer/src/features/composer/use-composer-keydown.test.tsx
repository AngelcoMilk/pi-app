import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useComposerKeyDown } from './use-composer-keydown'

function keyboardEvent(key: string, composing = false) {
  return {
    key,
    keyCode: composing ? 229 : 0,
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    nativeEvent: { isComposing: composing },
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent
}

function baseOptions() {
  return {
    editorRef: { current: document.createElement('div') },
    text: '@src',
    attachments: [],
    fileCompletion: {
      show: true,
      entries: [
        { path: 'src', name: 'src', isDirectory: true },
        { path: 'src/a.ts', name: 'a.ts', isDirectory: false },
      ],
      selectedIdx: 0,
      setSelectedIdx: vi.fn(),
      acceptSelected: vi.fn(),
      dismiss: vi.fn(),
    },
    showPopover: true,
    filteredCommands: [{ id: 'x', name: '/x', description: '', category: 'builtin' as const }],
    selectedIdx: 0,
    setSelectedIdx: vi.fn(),
    showComposerStop: true,
    isRunning: true,
    makeAdapter: vi.fn(),
    inputHistory: {
      recordSent: vi.fn(),
      tryArrowUp: vi.fn(),
      tryArrowDown: vi.fn(),
      onUserEdit: vi.fn(),
      onComposerBlur: vi.fn(),
      resetNav: vi.fn(),
    },
    setContent: vi.fn(),
    clearEditor: vi.fn(),
    refreshCommands: vi.fn(),
    acceptCommand: vi.fn(),
    dismissSlashToken: vi.fn(),
    sendCurrent: vi.fn(),
    handleSend: vi.fn(),
    runComposerAbort: vi.fn(),
  }
}

describe('useComposerKeyDown file completion arbitration', () => {
  it('gives arrows, Enter, Tab, and Escape to file completion before slash/history/send', () => {
    const options = baseOptions()
    const { result } = renderHook(() => useComposerKeyDown(options))

    result.current(keyboardEvent('ArrowDown'))
    expect(options.fileCompletion.setSelectedIdx).toHaveBeenCalled()
    expect(options.setSelectedIdx).not.toHaveBeenCalled()

    result.current(keyboardEvent('Enter'))
    result.current(keyboardEvent('Tab'))
    expect(options.fileCompletion.acceptSelected).toHaveBeenCalledTimes(2)
    expect(options.handleSend).not.toHaveBeenCalled()

    result.current(keyboardEvent('Escape'))
    expect(options.fileCompletion.dismiss).toHaveBeenCalled()
    expect(options.dismissSlashToken).not.toHaveBeenCalled()
    expect(options.runComposerAbort).not.toHaveBeenCalled()
  })

  it('leaves Enter to the IME while composing', () => {
    const options = baseOptions()
    const { result } = renderHook(() => useComposerKeyDown(options))

    const event = keyboardEvent('Enter', true)
    result.current(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(options.fileCompletion.acceptSelected).not.toHaveBeenCalled()
    expect(options.handleSend).not.toHaveBeenCalled()
  })

  it('accepts files and directories through the same completion callback', () => {
    const options = baseOptions()
    const { result } = renderHook(() => useComposerKeyDown(options))

    options.fileCompletion.selectedIdx = 1
    result.current(keyboardEvent('Enter'))
    options.fileCompletion.selectedIdx = 0
    result.current(keyboardEvent('Tab'))

    expect(options.fileCompletion.acceptSelected).toHaveBeenCalledTimes(2)
    expect(options.acceptCommand).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import { serializeRichInput } from './attachments'
import {
  extractComposerFileToken,
  replaceComposerFileToken,
  type ComposerFileToken,
} from './composer-file-search'

function mountEditor(editor: HTMLDivElement) {
  document.body.appendChild(editor)
  return editor
}

function setCaret(node: Node, offset: number) {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('composer @ file token', () => {
  it('triggers at message start or whitespace and rejects identifiers', () => {
    const start = mountEditor(document.createElement('div'))
    start.textContent = '@src'
    setCaret(start.firstChild!, 4)
    expect(extractComposerFileToken(start)).toMatchObject({ query: 'src' })

    const whitespace = mountEditor(document.createElement('div'))
    whitespace.textContent = 'open @cmp now'
    setCaret(whitespace.firstChild!, 9)
    expect(extractComposerFileToken(whitespace)).toMatchObject({ query: 'cmp' })

    const email = mountEditor(document.createElement('div'))
    email.textContent = 'foo@bar'
    setCaret(email.firstChild!, 7)
    expect(extractComposerFileToken(email)).toBeNull()
  })

  it('uses the actual caret in multiline or middle-of-text content and normalizes backslashes', () => {
    const editor = mountEditor(document.createElement('div'))
    editor.append('before ')
    editor.appendChild(document.createElement('br'))
    editor.append('@src\\comp suffix')
    setCaret(editor.lastChild!, 9)

    expect(extractComposerFileToken(editor)).toMatchObject({ query: 'src/comp' })

    setCaret(editor.lastChild!, 16)
    expect(extractComposerFileToken(editor)).toBeNull()
  })

  it('replaces only the active token with an existing attachment chip and preserves caret position', () => {
    const editor = mountEditor(document.createElement('div'))
    editor.textContent = 'open @cmp please'
    setCaret(editor.firstChild!, 9)
    const token = extractComposerFileToken(editor) as ComposerFileToken

    replaceComposerFileToken(editor, token, {
      path: 'src/组件 file.ts',
      name: '组件 file.ts',
      kind: 'code',
    })

    expect(serializeRichInput(editor).payload).toBe('open @"src/组件 file.ts" please')
    expect(serializeRichInput(editor).attachments[0]?.path).toBe('src/组件 file.ts')
    expect(window.getSelection()?.anchorOffset).toBe(1)
  })

  it('continues directory search by replacing the active token with a slash-terminated prefix', () => {
    const editor = mountEditor(document.createElement('div'))
    editor.textContent = '@src\\comp'
    setCaret(editor.firstChild!, 9)
    const token = extractComposerFileToken(editor) as ComposerFileToken

    replaceComposerFileToken(editor, token, 'src/components/')

    expect(editor.textContent).toBe('@src/components/')
    expect(extractComposerFileToken(editor)).toMatchObject({ query: 'src/components/' })
  })
})

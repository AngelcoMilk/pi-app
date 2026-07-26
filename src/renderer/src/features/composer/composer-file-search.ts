import {
  createAttachmentChip,
  newAttachmentChipId,
  type AttachmentMeta,
} from './attachments'

interface ComposerDomPoint {
  node: Node
  offset: number
  index: number
}

export interface ComposerFileToken {
  query: string
  key: string
  range: Range
}

function collectComposerText(el: HTMLElement): { text: string; points: ComposerDomPoint[] } {
  let text = ''
  const points: ComposerDomPoint[] = []
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const value = child.nodeValue || ''
        for (let offset = 0; offset <= value.length; offset += 1) {
          points.push({ node: child, offset, index: text.length + offset })
        }
        text += value
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const element = child as HTMLElement
      if (element.dataset.attachmentPath) return
      if (element.tagName === 'BR') {
        text += '\n'
        return
      }
      walk(element)
    })
  }
  walk(el)
  return { text, points }
}

function pointIndex(points: ComposerDomPoint[], node: Node, offset: number): number | null {
  const exact = points.find((point) => point.node === node && point.offset === offset)
  return exact?.index ?? null
}

function domPointAt(points: ComposerDomPoint[], index: number): ComposerDomPoint | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].index === index) return points[i]
  }
  return null
}

export function extractComposerFileToken(el: HTMLElement): ComposerFileToken | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const caretRange = selection.getRangeAt(0)
  if (!caretRange.collapsed) return null
  if (!el.contains(caretRange.startContainer)) return null
  const { text, points } = collectComposerText(el)
  const caretIndex = pointIndex(points, caretRange.startContainer, caretRange.startOffset)
  if (caretIndex == null) return null
  const beforeCaret = text.slice(0, caretIndex).replace(/\u200B/g, '')
  const match = beforeCaret.match(/(?:^|\s)@([^\s@]*)$/)
  if (!match) return null
  const rawQuery = match[1]
  const atIndex = caretIndex - rawQuery.length - 1
  const start = domPointAt(points, atIndex)
  const end = domPointAt(points, caretIndex)
  if (!start || !end) return null
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  const query = rawQuery.replace(/\\/g, '/')
  return { query, key: `${atIndex}:${query}`, range }
}

function placeCaretAfter(node: Node) {
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export function replaceComposerFileToken(
  el: HTMLElement,
  token: ComposerFileToken,
  replacement: AttachmentMeta | string,
): void {
  const range = token.range.cloneRange()
  range.deleteContents()
  if (typeof replacement === 'string') {
    const node = document.createTextNode(`@${replacement.replace(/\\/g, '/')}`)
    range.insertNode(node)
    placeCaretAfter(node)
  } else {
    const before = document.createTextNode('\u200B')
    const chip = createAttachmentChip({
      ...replacement,
      path: replacement.path.replace(/\\/g, '/'),
      chipId: replacement.chipId || newAttachmentChipId(),
    })
    const after = document.createTextNode('\u200B')
    const fragment = document.createDocumentFragment()
    fragment.append(before, chip, after)
    range.insertNode(fragment)
    placeCaretAfter(after)
  }
  el.normalize()
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

import { existsSync, readFileSync } from 'node:fs'
import { extractTextFromPiMessage, type PiSessionMessage } from '@shared/worker-message'

export type SessionForkCandidate = { entryId: string; text: string }

type SessionEntry = {
  type?: string
  id?: string
  parentId?: string | null
  message?: PiSessionMessage
}

export function listForkCandidatesFromSessionFile(
  sessionFile: string,
  leafId?: string | null,
): SessionForkCandidate[] {
  if (!sessionFile || !existsSync(sessionFile) || leafId === null) return []

  const entries = readFileSync(sessionFile, 'utf8')
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line) as SessionEntry
      } catch {
        return null
      }
    })
    .filter((entry): entry is SessionEntry => entry !== null && !!entry.id && entry.type !== 'session')

  const byId = new Map(entries.map((entry) => [entry.id!, entry]))
  const path: SessionEntry[] = []
  let current = leafId ? byId.get(leafId) : entries.at(-1)
  const visited = new Set<string>()
  while (current?.id && !visited.has(current.id)) {
    visited.add(current.id)
    path.push(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  path.reverse()

  return path.flatMap((entry) => {
    if (entry.type !== 'message' || entry.message?.role !== 'user') return []
    const text = extractTextFromPiMessage(entry.message).trim()
    return text ? [{ entryId: entry.id!, text }] : []
  })
}

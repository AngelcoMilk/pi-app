import { existsSync, readFileSync } from 'fs'

export type SessionFileMeta = {
  sessionId: string
  cwd: string | null
}

export function readSessionMetaFromFile(sessionFile: string): SessionFileMeta | null {
  if (!sessionFile || !existsSync(sessionFile)) return null
  try {
    const firstLine = readFileSync(sessionFile, 'utf-8')
      .split('\n')
      .find((line) => line.trim())
    if (!firstLine) return null
    const header = JSON.parse(firstLine) as {
      type?: string
      id?: unknown
      cwd?: unknown
    }
    if (header.type !== 'session' || !header.id) return null
    const cwd = typeof header.cwd === 'string' && header.cwd.trim() ? header.cwd.trim() : null
    return {
      sessionId: String(header.id),
      cwd,
    }
  } catch {
    return null
  }
}

export function readSessionIdFromFile(sessionFile: string): string | null {
  return readSessionMetaFromFile(sessionFile)?.sessionId ?? null
}

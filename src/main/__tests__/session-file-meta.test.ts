import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readSessionMetaFromFile } from '../session-file-meta'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('session file metadata', () => {
  it('should_read_session_id_and_workspace_cwd_from_header', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pi-session-meta-'))
    temporaryDirectories.push(directory)
    const sessionFile = join(directory, 'session.jsonl')
    writeFileSync(
      sessionFile,
      `${JSON.stringify({
        type: 'session',
        version: 3,
        id: 'session-1',
        timestamp: '2026-07-20T00:00:00.000Z',
        cwd: join(directory, 'workspace-b'),
      })}\n`,
      'utf8',
    )

    expect(readSessionMetaFromFile(sessionFile)).toEqual({
      sessionId: 'session-1',
      cwd: join(directory, 'workspace-b'),
    })
  })
})

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listForkCandidatesFromSessionFile } from './session-fork-candidates'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('cold session fork candidates', () => {
  it('reads only active-branch user messages from disk without a worker', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pi-fork-candidates-'))
    temporaryDirectories.push(directory)
    const sessionFile = join(directory, 'session.jsonl')
    const entries = [
      { type: 'session', version: 3, id: 'session-1', cwd: directory },
      { type: 'message', id: 'user-root', parentId: null, message: { role: 'user', content: 'root prompt' } },
      { type: 'message', id: 'assistant-root', parentId: 'user-root', message: { role: 'assistant', content: 'root answer' } },
      { type: 'message', id: 'user-active', parentId: 'assistant-root', message: { role: 'user', content: [{ type: 'text', text: 'active prompt' }] } },
      { type: 'message', id: 'assistant-active', parentId: 'user-active', message: { role: 'assistant', content: 'active answer' } },
      { type: 'message', id: 'user-side', parentId: 'assistant-root', message: { role: 'user', content: 'side prompt' } },
      { type: 'message', id: 'assistant-side', parentId: 'user-side', message: { role: 'assistant', content: 'side answer' } },
    ]
    writeFileSync(sessionFile, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8')

    expect(listForkCandidatesFromSessionFile(sessionFile, 'assistant-active')).toEqual([
      { entryId: 'user-root', text: 'root prompt' },
      { entryId: 'user-active', text: 'active prompt' },
    ])
  })
})

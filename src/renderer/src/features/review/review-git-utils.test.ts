import { describe, expect, it } from 'vitest'
import { parseGitStatus } from './review-git-utils'

describe('parseGitStatus', () => {
  it('preserves the first character of unstaged paths', () => {
    expect(parseGitStatus('## main\n M a.ts\n')).toEqual([
      { path: 'a.ts', changeType: 'modified', staged: false },
    ])
  })

  it('parses staged and untracked paths without trimming status columns', () => {
    expect(parseGitStatus('A  added.ts\n?? new.ts\n')).toEqual([
      { path: 'added.ts', changeType: 'added', staged: true },
      { path: 'new.ts', changeType: 'added', staged: false },
    ])
  })
})

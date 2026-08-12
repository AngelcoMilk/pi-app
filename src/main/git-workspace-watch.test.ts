import { describe, expect, it, vi } from 'vitest'

vi.mock('./config-store', () => ({
  configStore: { get: vi.fn(() => undefined) },
}))

import { shouldNotifyGitWorkspaceChange } from './git-workspace-watch'

describe('git workspace watcher filtering', () => {
  it('ignores transient lock and maintenance events', () => {
    expect(shouldNotifyGitWorkspaceChange('index.lock')).toBe(false)
    expect(shouldNotifyGitWorkspaceChange('refs/heads/main.lock')).toBe(false)
    expect(shouldNotifyGitWorkspaceChange(Buffer.from('gc.log'))).toBe(false)
    expect(shouldNotifyGitWorkspaceChange('gc.pid')).toBe(false)
  })

  it('keeps meaningful repository metadata events', () => {
    expect(shouldNotifyGitWorkspaceChange('index')).toBe(true)
    expect(shouldNotifyGitWorkspaceChange('HEAD')).toBe(true)
    expect(shouldNotifyGitWorkspaceChange('refs/heads/main')).toBe(true)
    expect(shouldNotifyGitWorkspaceChange(null)).toBe(true)
  })
})

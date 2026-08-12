import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { useUIStore } from '@renderer/stores/ui-store'
import { parseGitDiff } from '@shared/diff-model'
import {
  GitBranch,
  Loader2,
  FileDiff,
  RefreshCw,
  Columns2,
  Rows2,
} from '@renderer/components/icons'
import { ReviewCommitBar, type DiffMode } from './review-diff-views'
import { ReviewGitFileList } from './review-git-file-list'
import { ReviewMetaFileList, type ReviewFileEntry } from './review-meta-file-list'
import { useReviewGitData } from './use-review-git-data'

const SCOPES = ['turn', 'session', 'git'] as const
type Scope = (typeof SCOPES)[number]

export function ReviewPanel() {
  const { t } = useTranslation()
  const [scope, setScope] = useState<Scope>('session')
  const fileChanges = useUIStore((s) => s.fileChanges)
  const workspace = useUIStore((s) => s.currentWorkspace)
  const activeRunId = useUIStore((s) => s.runState.activeRunId)
  const lastRunId = useUIStore((s) => s.runState.lastRunId)
  const running = useUIStore((s) => s.runState.status === 'running')
  const [expandedGitPath, setExpandedGitPath] = useState<string | null>(null)
  const [focusGitPath, setFocusGitPath] = useState<string | null>(null)
  const [expandedMetaPath, setExpandedMetaPath] = useState<string | null>(null)
  const [diffMode, setDiffMode] = useState<DiffMode>('inline')
  const { gitData, loading, refreshing, refresh: loadGit } = useReviewGitData({
    enabled: scope === 'git',
    workspace,
    worktreeChangeSignal: fileChanges,
  })

  const turnRunId = running ? activeRunId : lastRunId

  useEffect(() => {
    const saved = localStorage.getItem('reviewDiffMode')
    if (saved === 'split' || saved === 'inline') setDiffMode(saved)
  }, [])

  const toggleDiffMode = () => {
    const next = diffMode === 'inline' ? 'split' : 'inline'
    setDiffMode(next)
    localStorage.setItem('reviewDiffMode', next)
  }

  useEffect(() => {
    const onScope = (e: Event) => {
      const s = (e as CustomEvent<Scope>).detail
      if (s && SCOPES.includes(s)) setScope(s)
    }
    window.addEventListener('pi-desktop:review-scope', onScope)
    return () => window.removeEventListener('pi-desktop:review-scope', onScope)
  }, [])

  useEffect(() => {
    const onFocus = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path
      if (path) {
        const normalized = path.replace(/\\/g, '/')
        setFocusGitPath(normalized)
        setExpandedGitPath(normalized)
        setExpandedMetaPath(normalized)
      }
    }
    window.addEventListener('pi-desktop:review-focus-file', onFocus)
    return () => window.removeEventListener('pi-desktop:review-focus-file', onFocus)
  }, [])

  const turnFiles = useMemo(
    () => fileChanges.filter((f) => turnRunId && f.runId === turnRunId),
    [fileChanges, turnRunId],
  )

  const files: ReviewFileEntry[] =
    scope === 'git' ? gitData?.files || [] : scope === 'turn' ? turnFiles : fileChanges

  const diffFiles = useMemo(() => {
    if (scope !== 'git' || !gitData?.raw) return []
    return parseGitDiff(gitData.raw)
  }, [scope, gitData?.raw])

  const cwd = workspace || ''

  const scopeHint =
    scope === 'turn'
      ? turnRunId
        ? t('review:scopeHintTurn', { id: turnRunId.slice(0, 8) })
        : t('review:scopeHintNoTurn')
      : scope === 'session'
        ? t('review:scopeHintSession', { count: fileChanges.length })
        : gitData?.isRepo === false
          ? t('review:scopeHintNotRepo')
          : gitData?.branch
            ? t('review:scopeHintBranch', { branch: gitData.branch })
            : t('review:scopeHintGit')

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border/80">
        {SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={cn(
              'flex-1 px-2 py-2.5 text-[11px] font-medium transition-colors',
              scope === s ? 'bg-[var(--bg-active)] text-foreground' : 'text-foreground-secondary hover:bg-[var(--bg-hover)]',
            )}
          >
            {t(`review.scope.${s}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-1.5">
        <span className="truncate text-[10px] text-foreground-secondary/80">{scopeHint}</span>
        <div className="flex items-center gap-1">
          {scope === 'git' && diffFiles.length > 0 && (
            <button
              type="button"
              onClick={toggleDiffMode}
              className="chrome-icon-btn rounded p-1"
              title={diffMode === 'inline' ? t('review:toggleSplit') : t('review:toggleInline')}
            >
              {diffMode === 'inline' ? <Columns2 className="h-3 w-3" /> : <Rows2 className="h-3 w-3" />}
            </button>
          )}
          {scope === 'git' && (
            <button type="button" onClick={loadGit} className="chrome-icon-btn rounded p-1" title={t('review:refresh')}>
              <RefreshCw className={cn('h-3 w-3', (loading || refreshing) && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>
      <div className="scrollbar-overlay flex-1 overflow-y-auto">
        {scope === 'git' && gitData?.log && (
          <div className="border-b border-border/40 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-foreground-secondary/70">
              <GitBranch className="h-3 w-3" />
              {t('review:recentCommits')}
            </div>
            <pre className="max-h-28 overflow-y-auto font-mono text-[10px] leading-relaxed text-foreground-secondary/90">
              {gitData.log}
            </pre>
          </div>
        )}
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : scope === 'git' && gitData?.isRepo === false ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <GitBranch className="h-8 w-8 text-muted-foreground/25" />
            <span className="text-[12px] text-foreground-secondary">
              {gitData.message || t('review:notGitRepo')}
            </span>
            <span className="text-[11px] text-muted-foreground/50">{t('review:notGitHint')}</span>
          </div>
        ) : scope === 'git' && gitData?.error ? (
          <p className="px-3 py-4 text-[11px] text-destructive/80">{gitData.error}</p>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <FileDiff className="h-8 w-8 text-muted-foreground/25" />
            <span className="text-[11px] text-muted-foreground/40">{t('review:empty')}</span>
          </div>
        ) : scope === 'git' ? (
          <ReviewGitFileList
            files={files}
            diffFiles={diffFiles}
            mode={diffMode}
            cwd={cwd}
            expandedPath={expandedGitPath}
            focusPath={focusGitPath}
          />
        ) : (
          <ReviewMetaFileList
            files={files}
            expandedPath={expandedMetaPath}
            focusPath={focusGitPath}
            onExpandedPathChange={setExpandedMetaPath}
          />
        )}
      </div>
      {scope === 'git' && gitData?.isRepo !== false && files.length > 0 && (
        <ReviewCommitBar cwd={cwd} onCommitted={loadGit} />
      )}
    </div>
  )
}

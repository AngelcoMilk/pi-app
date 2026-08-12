import { useState } from 'react'
import { Check, Copy } from '@renderer/components/icons'
import { ChangeIcon } from './review-diff-views'

export type ReviewFileEntry = {
  path: string
  changeType: string
  staged?: boolean
  source?: string
  runId?: string
  turnId?: string
}

export function ReviewMetaFileList({
  files,
  expandedPath,
  focusPath,
  onExpandedPathChange,
}: {
  files: ReviewFileEntry[]
  expandedPath: string | null
  focusPath: string | null
  onExpandedPathChange: (path: string | null) => void
}) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const handleCopy = (path: string) => {
    void navigator.clipboard.writeText(path)
    setCopiedPath(path)
    window.setTimeout(() => setCopiedPath(null), 1500)
  }

  return (
    <div className="py-1.5">
      {files.map((entry) => {
        const normalizedPath = entry.path.replace(/\\/g, '/')
        const open =
          expandedPath === entry.path ||
          (!!focusPath &&
            (normalizedPath === focusPath || normalizedPath.endsWith(`/${focusPath}`)))
        return (
          <div key={`${entry.path}-${entry.runId || ''}`} className="group">
            <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-hover)]">
              <ChangeIcon type={entry.changeType} />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left font-mono text-[11px]"
                onClick={() => onExpandedPathChange(open ? null : entry.path)}
              >
                {entry.path}
              </button>
              <span className="text-[9px] text-foreground-secondary/50">{entry.source}</span>
              <button
                type="button"
                onClick={() => handleCopy(entry.path)}
                className="opacity-0 group-hover:opacity-100"
              >
                {copiedPath === entry.path ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
            {open && (
              <div className="border-t border-border/20 bg-[var(--bg-2)]/50 px-3 py-2 text-[10px] text-foreground-secondary">
                {entry.changeType} · {entry.source}
                {entry.runId && (
                  <span className="ml-2 font-mono">run {entry.runId.slice(0, 8)}</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

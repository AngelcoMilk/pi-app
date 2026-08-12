import type { DiffFile } from '@shared/diff-model'
import { FileDiffView, type DiffMode } from './review-diff-views'

export function ReviewGitFileList({
  files,
  diffFiles,
  mode,
  cwd,
  expandedPath,
  focusPath,
}: {
  files: { path: string; changeType: string; staged?: boolean }[]
  diffFiles: DiffFile[]
  mode: DiffMode
  cwd: string
  expandedPath: string | null
  focusPath: string | null
}) {
  const normalizedFocus = focusPath?.replace(/\\/g, '/') || null
  return (
    <div className="py-1">
      {files.map((entry) => {
        const file = diffFiles.find(
          (candidate) => candidate.path === entry.path || entry.path.endsWith(candidate.path),
        )
        const normalizedPath = entry.path.replace(/\\/g, '/')
        const defaultOpen =
          expandedPath === entry.path ||
          (normalizedFocus != null &&
            (normalizedPath === normalizedFocus || normalizedPath.endsWith(`/${normalizedFocus}`)))
        return (
          <FileDiffView
            key={entry.path}
            file={file}
            fallbackPath={entry.path}
            fallbackChangeType={entry.changeType}
            staged={entry.staged ?? false}
            mode={mode}
            cwd={cwd}
            defaultOpen={defaultOpen}
          />
        )
      })}
    </div>
  )
}

import { sessionFilesEqual } from '@renderer/lib/session-file-key'

export function isSessionRuntimeRunning(
  sessionFile: string | null | undefined,
  runtime: Record<string, boolean>,
): boolean {
  if (!sessionFile) return false
  return Object.entries(runtime).some(
    ([runtimeKey, running]) => running && sessionFilesEqual(runtimeKey, sessionFile),
  )
}

import { z } from 'zod'
import { registerHandler, registerHandlerWithSchema } from '../registry'
import { workerManager } from '../../worker-manager'
import { configStore } from '../../config-store'

export function registerExtensionUiHandlers(): void {
  registerHandlerWithSchema(
    'ipc:extension.respondUI',
    z.object({
      id: z.string().min(1),
      value: z.string().optional(),
      confirmed: z.boolean().optional(),
      cancelled: z.boolean().optional(),
      result: z.unknown().optional(),
    }),
    (req) => workerManager.respondExtensionUI(req),
  )

  registerHandler('ipc:extension.pendingUI', async () => ({
    requests: workerManager.listPendingExtensionUI(),
  }))

  registerHandler('ipc:extension.config.get', async (req) => {
    const workspaceId = req.workspaceId || workerManager.cwd || configStore.get('currentProject') || ''
    return { config: configStore.getExtensionConfig(workspaceId, req.extensionId) || {} }
  })

  registerHandler('ipc:extension.config.set', async (req) => {
    const workspaceId = req.workspaceId || workerManager.cwd || configStore.get('currentProject') || ''
    configStore.setExtensionConfig(workspaceId, req.extensionId, req.config || {})
    return { ok: true }
  })
}

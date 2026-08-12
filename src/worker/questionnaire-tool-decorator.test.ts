import { describe, expect, it, vi } from 'vitest'
import type { LoadExtensionsResult } from '@earendil-works/pi-coding-agent'
import { createDesktopUIBridge } from './desktop-ui-bridge'
import { decorateQuestionnaireTools } from './questionnaire-tool-decorator'

function extensionResult(execute: ReturnType<typeof vi.fn>, source: string) {
  const definition = {
    name: 'ask_user_question',
    label: 'Ask',
    description: 'Ask',
    parameters: {},
    execute,
  }
  return {
    extensions: [
      {
        path: source,
        resolvedPath: source,
        sourceInfo: { path: source, source, scope: 'user', origin: 'package' },
        handlers: new Map(),
        tools: new Map([['ask_user_question', { definition, sourceInfo: {} }]]),
        messageRenderers: new Map(),
        commands: new Map(),
        flags: new Map(),
        shortcuts: new Map(),
      },
    ],
    errors: [],
    runtime: {},
  } as unknown as LoadExtensionsResult
}

describe('decorateQuestionnaireTools', () => {
  it('decorates the matched adapter tool with sequential scoped UI', async () => {
    const requests: Array<Record<string, unknown>> = []
    const bridge = createDesktopUIBridge(
      { on: vi.fn(() => vi.fn()) } as never,
      (request) => requests.push(request as never),
    )
    const execute = vi.fn(async (_id, _params, _signal, _update, context) => ({
      content: [{ type: 'text', text: await context.ui.select('Pick', ['1. A', '2. B']) }],
    }))
    const decorated = decorateQuestionnaireTools(
      extensionResult(execute, '@juicesharp/rpiv-ask-user-question'),
      '/workspace',
    )
    const definition = decorated.extensions[0].tools.get('ask_user_question')!.definition
    const running = definition.execute(
      'tool-call-1',
      { questions: [{ question: 'Pick?', options: [{ label: 'A' }, { label: 'B' }] }] },
      undefined,
      undefined,
      { ui: bridge.uiContext } as never,
    )

    expect(definition.executionMode).toBe('sequential')
    expect(requests[0]).toEqual(expect.objectContaining({ toolCallId: 'tool-call-1' }))
    bridge.handleExtensionUIResponse({
      id: String(requests[0].id),
      result: {
        cancelled: false,
        answers: [{ questionIndex: 0, question: 'Pick?', kind: 'option', answer: 'B' }],
      },
    })
    await expect(running).resolves.toEqual({ content: [{ type: 'text', text: '2. B' }] })
  })

  it('leaves an unmatched extension tool unchanged', () => {
    const execute = vi.fn()
    const original = extensionResult(execute, '@example/unmatched')
    const decorated = decorateQuestionnaireTools(original, '/workspace')

    expect(decorated.extensions[0]).toBe(original.extensions[0])
  })
})

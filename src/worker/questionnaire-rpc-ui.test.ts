import { describe, expect, it, vi } from 'vitest'
import type { ExtensionUIQuestionnaireResult } from '@shared/extension-ui'
import { createQuestionnaireRpcUI } from './questionnaire-rpc-ui'

const questions = [
  {
    question: 'Pick one?',
    options: [
      { label: 'Alpha', description: 'A' },
      { label: 'Beta', description: 'B' },
    ],
  },
  {
    question: 'Pick several?',
    multiSelect: true,
    options: [
      { label: 'One', description: '1' },
      { label: 'Two', description: '2' },
      { label: 'Three', description: '3' },
    ],
  },
]

describe('createQuestionnaireRpcUI', () => {
  it('requests once per toolCall and translates native answers to RPC values', async () => {
    const result: ExtensionUIQuestionnaireResult = {
      cancelled: false,
      answers: [
        { questionIndex: 0, question: 'Pick one?', kind: 'option', answer: 'Beta' },
        {
          questionIndex: 1,
          question: 'Pick several?',
          kind: 'multi',
          answer: null,
          selected: ['One', 'Three'],
        },
      ],
    }
    const request = vi.fn(async () => result)
    const ui = createQuestionnaireRpcUI({} as never, 'tool-1', questions, undefined, request)

    await expect(ui.select('single', ['1. Alpha — A', '2. Beta — B', '3. Other'])).resolves.toBe(
      '2. Beta — B',
    )
    await expect(ui.input('multi', '1,3')).resolves.toBe('1,3')
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('tool-1', questions, undefined)
  })

  it('returns the sentinel followed by scoped custom text', async () => {
    const request = vi.fn(async () => ({
      cancelled: false,
      answers: [
        { questionIndex: 0, question: 'Pick one?', kind: 'custom' as const, answer: 'My answer' },
      ],
    }))
    const ui = createQuestionnaireRpcUI({} as never, 'tool-2', questions.slice(0, 1), undefined, request)

    await expect(ui.select('single', ['1. Alpha', '2. Beta', '3. Type something'])).resolves.toBe(
      '3. Type something',
    )
    await expect(ui.input('custom')).resolves.toBe('My answer')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not leak answers between concurrent tool calls', async () => {
    const first = createQuestionnaireRpcUI(
      {} as never,
      'tool-a',
      questions.slice(0, 1),
      undefined,
      async () => ({
        cancelled: false,
        answers: [{ questionIndex: 0, question: 'Pick one?', kind: 'option', answer: 'Alpha' }],
      }),
    )
    const second = createQuestionnaireRpcUI(
      {} as never,
      'tool-b',
      questions.slice(0, 1),
      undefined,
      async () => ({
        cancelled: false,
        answers: [{ questionIndex: 0, question: 'Pick one?', kind: 'option', answer: 'Beta' }],
      }),
    )

    await expect(first.select('first', ['1. Alpha', '2. Beta'])).resolves.toBe('1. Alpha')
    await expect(second.select('second', ['1. Alpha', '2. Beta'])).resolves.toBe('2. Beta')
  })
})

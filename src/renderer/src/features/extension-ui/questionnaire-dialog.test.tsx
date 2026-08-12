import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuestionnaireDialog } from './questionnaire-dialog'

const common = { onSuspend: vi.fn(), onCancel: vi.fn() }

describe('QuestionnaireDialog controls', () => {
  it('uses radios and immediately advances single-choice questions', () => {
    const onSubmit = vi.fn()
    render(
      <QuestionnaireDialog
        requestId="request-1"
        questions={[
          { question: 'First?', options: [{ label: 'A' }, { label: 'B' }] },
          { question: 'Second?', options: [{ label: 'C' }, { label: 'D' }] },
        ]}
        onSubmit={onSubmit}
        {...common}
      />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(2)
    fireEvent.click(screen.getByLabelText('A'))
    expect(screen.getByText('Second?')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('D'))
    expect(onSubmit).toHaveBeenCalledWith({
      cancelled: false,
      answers: [
        expect.objectContaining({ questionIndex: 0, answer: 'A', kind: 'option' }),
        expect.objectContaining({ questionIndex: 1, answer: 'D', kind: 'option' }),
      ],
    })
  })

  it('uses checkboxes and waits for explicit submit on multi-select', () => {
    const onSubmit = vi.fn()
    render(
      <QuestionnaireDialog
        requestId="request-2"
        questions={[
          {
            question: 'Several?',
            multiSelect: true,
            options: [{ label: 'One' }, { label: 'Two' }],
          },
        ]}
        onSubmit={onSubmit}
        {...common}
      />,
    )

    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    fireEvent.click(screen.getByLabelText('One'))
    fireEvent.click(screen.getByLabelText('Two'))
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(onSubmit).toHaveBeenCalledWith({
      cancelled: false,
      answers: [expect.objectContaining({ kind: 'multi', selected: ['One', 'Two'] })],
    })
  })

  it('allows a custom answer for multi-select', () => {
    const onSubmit = vi.fn()
    render(
      <QuestionnaireDialog
        requestId="request-multi-custom"
        questions={[
          {
            question: 'Several?',
            multiSelect: true,
            options: [{ label: 'One' }, { label: 'Two' }],
          },
        ]}
        onSubmit={onSubmit}
        {...common}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('自定义答案…'), {
      target: { value: 'A different answer' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(onSubmit).toHaveBeenCalledWith({
      cancelled: false,
      answers: [expect.objectContaining({ kind: 'custom', answer: 'A different answer' })],
    })
  })

  it('keeps custom answers available in preview layout', () => {
    render(
      <QuestionnaireDialog
        requestId="request-3"
        questions={[
          {
            question: 'Preview?',
            options: [
              { label: 'A', preview: 'alpha' },
              { label: 'B', preview: 'beta' },
            ],
          },
        ]}
        onSubmit={vi.fn()}
        {...common}
      />,
    )

    expect(screen.getByPlaceholderText('自定义答案…')).toBeInTheDocument()
  })
})

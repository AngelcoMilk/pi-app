import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThinkingChainBlock } from './thinking-chain-block'

describe('ThinkingChainBlock', () => {
  it('should_render_readable_independent_scroll_body_when_expanded', () => {
    const text = 'Inspect the event target before forwarding the wheel delta.'
    render(<ThinkingChainBlock text={text} />)

    fireEvent.click(screen.getByRole('button'))

    const body = screen.getByText(text)
    expect(body).toHaveAttribute('data-independent-scroll')
    expect(body).toHaveClass(
      'max-h-40',
      'overflow-y-auto',
      'overscroll-contain',
      'border-border/35',
      'text-[13px]',
      'leading-[1.6]',
      'thinking-chain-body',
    )
    expect(body).not.toHaveClass('font-mono', 'timeline-text-placeholder')
  })
})

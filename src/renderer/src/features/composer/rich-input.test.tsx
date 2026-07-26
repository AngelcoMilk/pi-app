import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RichInput } from './rich-input'

let resizeCallback: ResizeObserverCallback | undefined
let mutationCallback: MutationCallback | undefined
let scrollHeight = 40
let inputWidth = 240
let animationFrames: FrameRequestCallback[]
let scrollHeightGetter: ReturnType<typeof vi.spyOn>
let originalResizeObserver: typeof ResizeObserver
let originalMutationObserver: typeof MutationObserver
let originalRequestAnimationFrame: typeof requestAnimationFrame
let originalCancelAnimationFrame: typeof cancelAnimationFrame
let resizeDisconnect: ReturnType<typeof vi.fn<() => void>>
let mutationDisconnect: ReturnType<typeof vi.fn<() => void>>
let cancelAnimationFrameMock: ReturnType<typeof vi.fn<(handle: number) => void>>

class TestResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }

  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = resizeDisconnect
}

class TestMutationObserver implements MutationObserver {
  constructor(callback: MutationCallback) {
    mutationCallback = callback
  }

  observe = vi.fn()
  disconnect = mutationDisconnect
  takeRecords = vi.fn(() => [])
}

function resizeEntry(target: Element, width: number): ResizeObserverEntry {
  return {
    target,
    contentRect: {
      x: 0,
      y: 0,
      top: 0,
      right: width,
      bottom: 40,
      left: 0,
      width,
      height: 40,
      toJSON: () => ({}),
    },
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  }
}

function flushAnimationFrames() {
  act(() => {
    const pending = animationFrames.splice(0)
    for (const callback of pending) callback(0)
  })
}

describe('RichInput height reset', () => {
  beforeEach(() => {
    resizeCallback = undefined
    mutationCallback = undefined
    scrollHeight = 40
    inputWidth = 240
    animationFrames = []
    resizeDisconnect = vi.fn<() => void>()
    mutationDisconnect = vi.fn<() => void>()
    cancelAnimationFrameMock = vi.fn<(handle: number) => void>()

    originalResizeObserver = globalThis.ResizeObserver
    originalMutationObserver = globalThis.MutationObserver
    originalRequestAnimationFrame = globalThis.requestAnimationFrame
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame
    globalThis.ResizeObserver = TestResizeObserver
    globalThis.MutationObserver = TestMutationObserver
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    }
    globalThis.cancelAnimationFrame = cancelAnimationFrameMock
    scrollHeightGetter = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('rich-input') ? scrollHeight : 0
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.classList.contains('rich-input') ? inputWidth : 0
      return {
        x: 0,
        y: 0,
        top: 0,
        right: width,
        bottom: 40,
        left: 0,
        width,
        height: 40,
        toJSON: () => ({}),
      }
    })
  })

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver
    globalThis.MutationObserver = originalMutationObserver
    globalThis.requestAnimationFrame = originalRequestAnimationFrame
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame
    vi.restoreAllMocks()
  })

  it('shrinks after its own width grows without an input event', () => {
    scrollHeight = 88
    const { container } = render(<RichInput />)
    const input = container.querySelector('.rich-input') as HTMLDivElement
    expect(input.style.height).toBe('88px')

    inputWidth = 600
    scrollHeight = 40
    act(() => resizeCallback?.([resizeEntry(input, inputWidth)], {} as ResizeObserver))
    flushAnimationFrames()

    expect(input.style.height).toBe('40px')
  })

  it('ignores resize notifications when width did not change', () => {
    const { container } = render(<RichInput />)
    const input = container.querySelector('.rich-input') as HTMLDivElement
    const readsAfterMount = scrollHeightGetter.mock.calls.length

    act(() => resizeCallback?.([resizeEntry(input, inputWidth)], {} as ResizeObserver))
    flushAnimationFrames()

    expect(scrollHeightGetter).toHaveBeenCalledTimes(readsAfterMount)
  })

  it('refreshes height and empty state after programmatic DOM changes', () => {
    scrollHeight = 88
    const { container } = render(<RichInput />)
    const input = container.querySelector('.rich-input') as HTMLDivElement

    input.textContent = 'restored draft'
    scrollHeight = 62
    act(() => mutationCallback?.([], {} as MutationObserver))
    flushAnimationFrames()
    expect(input.style.height).toBe('62px')
    expect(input).not.toHaveClass('is-empty')

    input.replaceChildren()
    scrollHeight = 40
    act(() => mutationCallback?.([], {} as MutationObserver))
    flushAnimationFrames()
    expect(input.style.height).toBe('40px')
    expect(input).toHaveClass('is-empty')
  })

  it('cleans observers and a pending refresh on unmount', () => {
    const { container, unmount } = render(<RichInput />)
    const input = container.querySelector('.rich-input') as HTMLDivElement
    input.textContent = 'programmatic fill'
    act(() => mutationCallback?.([], {} as MutationObserver))

    unmount()

    expect(resizeDisconnect).toHaveBeenCalledOnce()
    expect(mutationDisconnect).toHaveBeenCalledOnce()
    expect(cancelAnimationFrameMock).toHaveBeenCalledOnce()
  })

  it('keeps the existing 112px height clamp', () => {
    scrollHeight = 180
    const { container } = render(<RichInput />)
    const input = container.querySelector('.rich-input') as HTMLDivElement

    expect(input.style.height).toBe('112px')
    expect(input).toHaveClass('min-h-[2.5rem]')
  })
})

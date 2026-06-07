import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createLockController } from '@/lib/lock/lock-controller'

describe('LockController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts locked when enabled', () => {
    const c = createLockController({ enabled: true, timeoutMinutes: 5 })
    expect(c.isLocked()).toBe(true)
  })

  it('starts unlocked when disabled', () => {
    const c = createLockController({ enabled: false, timeoutMinutes: 5 })
    expect(c.isLocked()).toBe(false)
  })

  it('unlock() clears the locked state and starts the inactivity timer', () => {
    const c = createLockController({ enabled: true, timeoutMinutes: 5 })
    c.unlock()
    expect(c.isLocked()).toBe(false)
  })

  it('re-locks after timeoutMinutes of inactivity', () => {
    const c = createLockController({ enabled: true, timeoutMinutes: 5 })
    c.unlock()
    vi.advanceTimersByTime(5 * 60_000 - 1)
    expect(c.isLocked()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(c.isLocked()).toBe(true)
  })

  it('activity resets the inactivity countdown', () => {
    const c = createLockController({ enabled: true, timeoutMinutes: 5 })
    c.unlock()
    vi.advanceTimersByTime(4 * 60_000)
    c.noteActivity()
    vi.advanceTimersByTime(4 * 60_000)
    expect(c.isLocked()).toBe(false) // 8 min elapsed but reset at 4
    vi.advanceTimersByTime(60_000)
    expect(c.isLocked()).toBe(true)
  })

  it('does not run a timer when disabled', () => {
    const c = createLockController({ enabled: false, timeoutMinutes: 5 })
    c.unlock()
    vi.advanceTimersByTime(60 * 60_000)
    expect(c.isLocked()).toBe(false)
  })

  it('onBackground() re-locks immediately when enabled', () => {
    const c = createLockController({ enabled: true, timeoutMinutes: 5 })
    c.unlock()
    c.onBackground()
    expect(c.isLocked()).toBe(true)
  })

  it('notifies subscribers on every state change', () => {
    const c = createLockController({ enabled: true, timeoutMinutes: 5 })
    const seen: boolean[] = []
    c.subscribe((locked) => seen.push(locked))
    c.unlock()
    c.onBackground()
    expect(seen).toEqual([false, true])
  })
})

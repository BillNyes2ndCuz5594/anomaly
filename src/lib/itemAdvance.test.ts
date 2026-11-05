import { afterEach, expect, it, vi } from 'vitest'
// @ts-expect-error Node proof helpers are plain JavaScript, outside the app build.
import { waitForNextItem } from '../../scripts/lib/itemAdvance.mjs'

afterEach(() => vi.useRealTimers())

it('waits for the replacement button before starting the cooldown margin', async () => {
  vi.useFakeTimers()
  let showButton!: () => void
  const waitForSelector = vi.fn(() => new Promise<void>((resolve) => { showButton = resolve }))
  let ready = false
  const waiting = waitForNextItem({ waitForSelector }).then(() => { ready = true })
  expect(waitForSelector).toHaveBeenCalledWith('[data-testid="next-item"]:not([disabled])')
  await vi.advanceTimersByTimeAsync(1000)
  expect(ready).toBe(false)
  showButton()
  await vi.advanceTimersByTimeAsync(449)
  expect(ready).toBe(false)
  await vi.advanceTimersByTimeAsync(51)
  await waiting
  expect(ready).toBe(true)
})

it('keeps a missing Next item as a proof failure', async () => {
  const error = new Error('Next item did not appear')
  await expect(waitForNextItem({ waitForSelector: async () => { throw error } })).rejects.toBe(error)
})

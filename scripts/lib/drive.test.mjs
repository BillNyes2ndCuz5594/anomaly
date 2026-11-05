import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { toCaseStep } from './drive.mjs'

test('toCaseStep starts fresh on repeated entry without clearing other progress', async () => {
  const key = 'anomaly.case.case.03-1'
  const storage = new Map([
    ['anomaly.case.case.02-2', 'other case checkpoint'],
    ['anomaly.case.cold.cold-1', 'cold case checkpoint'],
    ['unrelated', 'keep'],
  ])
  const kept = new Map(storage)
  let entries = 0
  const page = {
    async evaluate(fn) {
      runInNewContext(`(${fn.toString()})()`, {
        sessionStorage: { removeItem: (k) => storage.delete(k) },
        location: {
          set hash(value) {
            assert.equal(value, '#/case/03-1')
            // The checkpoint must be gone before navigation can restore it.
            assert.equal(storage.has(key), false)
            entries++
          },
        },
      })
    },
    async waitForSelector(selector) {
      assert.equal(selector, '[data-testid="briefing"]')
      assert.deepEqual(storage, kept)
    },
  }
  // Cover first entry as well as re-entry after each lab and the items step.
  await toCaseStep(page, 'briefing')
  for (const step of ['lab-a', 'lab-b', 'lab-c', 'items']) {
    storage.set(key, JSON.stringify({ step }))
    await toCaseStep(page, 'briefing')
  }
  assert.equal(entries, 5)
})

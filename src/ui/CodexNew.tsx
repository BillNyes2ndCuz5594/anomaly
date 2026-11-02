import { useEffect } from 'react'
import { useGame } from '../state/store'
import { diffNew, loadSeen, markAllSeen } from './codexNew'
import './codexNew.css'

const PANEL = '[data-testid="codex-panel"]'

/**
 * Tags codex entries that were unlocked since the codex was last opened. It finds the existing panel and its
 * li[data-testid^="codex-"] rows and sets data attributes that a stylesheet turns into a NEW tag and one scan sweep,
 * so the hub markup is untouched. Opening the panel shows the tags; closing it (or leaving the hub) marks every
 * entry as seen. Mounted only on the hub route.
 */
export default function CodexNew() {
  const codex = useGame((s) => s.codex)

  useEffect(() => {
    const panel = document.querySelector<HTMLDetailsElement>(PANEL)
    if (!panel) return
    let seen = loadSeen()
    let opened = panel.open

    const rows = () => Array.from(panel.querySelectorAll<HTMLElement>('li[data-testid^="codex-"]'))
    const idOf = (li: HTMLElement) => (li.dataset.testid ?? '').replace(/^codex-/, '')
    const apply = () => {
      const fresh = new Set(diffNew(codex, seen))
      for (const li of rows()) {
        if (fresh.has(idOf(li))) li.dataset.codexNew = 'yes'
        else delete li.dataset.codexNew
      }
      const summary = panel.querySelector<HTMLElement>('summary')
      if (summary) {
        if (fresh.size > 0 && !panel.open) summary.dataset.codexNewCount = String(fresh.size)
        else delete summary.dataset.codexNewCount
      }
    }
    const settle = () => {
      seen = markAllSeen(codex, seen)
    }
    const onToggle = () => {
      if (panel.open) {
        opened = true
        apply()
      } else if (opened) {
        settle()
        opened = false
        apply()
      }
    }

    apply()
    panel.addEventListener('toggle', onToggle)
    return () => {
      panel.removeEventListener('toggle', onToggle)
      if (opened) settle()
      for (const li of rows()) delete li.dataset.codexNew
      const summary = panel.querySelector<HTMLElement>('summary')
      if (summary) delete summary.dataset.codexNewCount
    }
  }, [codex])

  return null
}

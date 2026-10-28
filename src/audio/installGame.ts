import { controlOf, isActivationKey, isInert } from './dom'
import { createEngine, type AudioEngine, type PlayOpts } from './engine'
import { parseHash } from '../lib/router'
import { useFx, useSession } from '../state/session'
import { useGame } from '../state/store'

let installed = false

function ambientRoute(hash: string): boolean {
  const name = parseHash(hash).name
  return name === 'hub' || name === 'case' || name === 'cold'
}

/** Which UI cue a control should make, or null to stay quiet. */
export function cueForControl(el: HTMLElement): { cue: 'press' | 'toggle' | 'pickup'; up?: boolean } | null {
  if (isInert(el)) return null
  if (el instanceof HTMLInputElement) {
    if (el.type === 'range' || el.type === 'hidden') return null
    if (el.dataset.testid === 'setting-sound') return null
    if (el.type === 'checkbox' || el.type === 'radio') return { cue: 'toggle', up: !el.checked }
    return { cue: 'press' }
  }
  const test = el.dataset.testid ?? ''
  if (test.startsWith('option-')) {
    const eliminating = document.querySelector('[data-testid="eliminate-toggle"][aria-pressed="true"]')
    return eliminating ? { cue: 'toggle', up: false } : { cue: 'pickup' }
  }
  if (test.startsWith('word-') || test.startsWith('specimen-chip-')) return { cue: 'pickup' }
  if (test.startsWith('organ-') || test.startsWith('sort-') || test === 'lock-in') return null
  if (el.matches('button, [role="button"]') && el.hasAttribute('aria-pressed')) {
    return { cue: 'toggle', up: el.getAttribute('aria-pressed') !== 'true' }
  }
  return { cue: 'press' }
}

function bindUi(engine: AudioEngine): void {
  let lastEl: EventTarget | null = null
  let lastAt = 0
  const recent = (el: EventTarget) => el === lastEl && performance.now() - lastAt < 350
  const mark = (el: EventTarget) => {
    lastEl = el
    lastAt = performance.now()
  }
  const fire = (el: HTMLElement | null, fromPointer: boolean) => {
    if (!el || recent(el)) return
    const cue = cueForControl(el)
    if (!cue) return
    mark(el)
    // Pointer and key events see the old checked state. A bare click sees the new one.
    const opts: PlayOpts = { up: cue.up }
    if (!fromPointer && el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) opts.up = el.checked
    engine.play(cue.cue, opts)
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      engine.gesture()
      if (e.button !== 0) return
      fire(controlOf(e.target), true)
    },
    true,
  )
  document.addEventListener(
    'pointerup',
    (e) => {
      const el = controlOf(e.target)
      if (!(el instanceof HTMLInputElement) || el.type !== 'range' || isInert(el) || recent(el)) return
      mark(el)
      engine.play('press')
    },
    true,
  )
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType === 'touch') return
      const el = controlOf(e.target)
      if (!el || isInert(el)) return
      const from = e.relatedTarget instanceof Node ? controlOf(e.relatedTarget) : null
      if (from === el) return
      engine.play('hover')
    },
    true,
  )
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat || !isActivationKey(e.key)) return
      engine.gesture()
      const el = controlOf(e.target)
      if (!el) return
      if (el instanceof HTMLInputElement && el.type === 'range') return
      fire(el, true)
    },
    true,
  )
  document.addEventListener(
    'click',
    (e) => {
      engine.gesture()
      fire(controlOf(e.target), false)
    },
    true,
  )
  let pointerAt = 0
  document.addEventListener('pointerdown', () => { pointerAt = performance.now() }, true)
  document.addEventListener(
    'focusin',
    (e) => {
      if (performance.now() - pointerAt < 500) return
      const el = controlOf(e.target)
      if (!el || isInert(el)) return
      engine.play('hover')
    },
    true,
  )
}

function bindRoutes(engine: AudioEngine): void {
  const sync = () => engine.setAmbient(ambientRoute(location.hash))
  window.addEventListener('hashchange', () => {
    engine.play('whoosh')
    sync()
  })
  sync()
}

function bindSession(engine: AudioEngine): void {
  let caseId = useSession.getState().caseId
  let answers = useSession.getState().answers.length
  let specimen = useFx.getState().specimen
  let solvedKey = ''

  useSession.subscribe((s) => {
    if (s.caseId && s.caseId !== caseId && s.step === 'briefing') engine.play('scan')
    caseId = s.caseId
    if (s.step !== 'debrief') solvedKey = ''
    if (s.answers.length > answers) {
      const last = s.answers[s.answers.length - 1]
      engine.play(last.correct ? 'correct' : 'wrong')
    }
    answers = s.answers.length
  })

  useFx.subscribe((s) => {
    if (s.specimen && s.specimen !== specimen) engine.play('pickup')
    specimen = s.specimen
  })

  if (document.body) {
    const obs = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element) noteLab(record.target, engine)
        for (const node of record.addedNodes) noteTree(node, engine)
      }
    })
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ok'] })
  }

  // Session step is not persisted, so a saved closed case cannot stinger on load.
  const onCases = (state: ReturnType<typeof useGame.getState>, prev: ReturnType<typeof useGame.getState>) => {
    if (useSession.getState().step !== 'debrief') return
    for (const [id, status] of Object.entries(state.cases)) {
      if (!status?.closed) continue
      const before = prev.cases[id]
      if (before === status) continue
      const key = `${id}:${status.score}:${status.total}`
      if (solvedKey === key) continue
      solvedKey = key
      engine.play('solved')
      return
    }
  }
  useGame.subscribe(onCases)
}

function noteLab(el: Element, engine: AudioEngine): void {
  if (el.getAttribute('data-testid') !== 'lab-feedback') return
  const ok = el.getAttribute('data-ok')
  if (ok === 'yes') engine.play('correct')
  else if (ok === 'no') engine.play('wrong')
}

function noteTree(node: Node, engine: AudioEngine): void {
  if (!(node instanceof Element)) return
  if (node.matches('[data-testid="lab-feedback"]')) noteLab(node, engine)
  for (const el of node.querySelectorAll('[data-testid="lab-feedback"]')) noteLab(el, engine)
}

function bindPrefs(engine: AudioEngine): void {
  let ignore = true
  const apply = (silent: boolean) => {
    const s = useGame.getState().settings
    engine.setPrefs(s.sound, s.soundVolume, { silent })
  }
  useGame.subscribe((s, prev) => {
    if (ignore) return
    if (s.settings.sound === prev.settings.sound && s.settings.soundVolume === prev.settings.soundVolume) return
    engine.setPrefs(s.settings.sound, s.settings.soundVolume, { silent: s.settings.sound === prev.settings.sound })
  })
  apply(true)
  const ready = () => {
    apply(true)
    ignore = false
  }
  if (useGame.persist.hasHydrated()) ready()
  else useGame.persist.onFinishHydration(ready)
}

/** Student game: UI cues, route whooshes, lab and case stingers, hub and case hum. */
export function installGameAudio(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  const engine = createEngine({
    search: () => location.search,
    hidden: () => document.hidden,
  })
  bindPrefs(engine)
  bindUi(engine)
  bindRoutes(engine)
  bindSession(engine)
  document.addEventListener('visibilitychange', () => engine.onVisibility())
}

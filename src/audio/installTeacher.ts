import { controlOf, isActivationKey, isButtonLike, isInert } from './dom'
import { createEngine } from './engine'
import { GAME_STORAGE_KEY, readStoredSound } from '../state/settings'

let installed = false

/** Teacher HQ: button presses only. No hum, no whoosh, no case cues. */
export function installTeacherAudio(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  const engine = createEngine({
    teacher: true,
    search: () => location.search,
    hidden: () => document.hidden,
  })
  const sync = () => {
    try {
      const prefs = readStoredSound(localStorage.getItem(GAME_STORAGE_KEY))
      engine.setPrefs(prefs.sound, prefs.volume, { silent: true })
    } catch {
      engine.setPrefs(true, 0.55, { silent: true })
    }
  }
  sync()
  window.addEventListener('storage', sync)
  document.addEventListener('visibilitychange', () => engine.onVisibility())

  const press = (target: EventTarget | null) => {
    sync()
    engine.gesture()
    const el = controlOf(target)
    if (!el || !isButtonLike(el) || isInert(el)) return
    engine.play('press')
  }
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return
      press(e.target)
    },
    true,
  )
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat || !isActivationKey(e.key)) return
      press(e.target)
    },
    true,
  )
}

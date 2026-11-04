import type { MotionMode } from './motionMode'

const live = new Map<Element, { el: HTMLElement; animation?: Animation }>()

/**
 * A small "+N" chip for Intel awards. full: it flies (FLIP, 350 ms by default) from the source to the target element.
 * fade: it fades in and out in place, no transform. still: nothing at all (the static toast covers it).
 */
export function flyChip(text: string, from: Element | null, to: Element | null, mode: MotionMode, ms = 350): void {
  if (mode === 'still' || !from || typeof document === 'undefined') return
  const target = to ?? from
  const previous = live.get(target)
  previous?.animation?.cancel()
  previous?.el.remove()
  live.delete(target)
  // A bounded global budget also covers simultaneous awards to different targets.
  if (live.size >= 2) {
    const [key, oldest] = live.entries().next().value!
    oldest.animation?.cancel()
    oldest.el.remove()
    live.delete(key)
  }
  const a = from.getBoundingClientRect()
  const el = document.createElement('span')
  el.className = 'fly-chip mono'
  el.dataset.flyTarget = target.getAttribute('data-testid') ?? 'unlabelled'
  el.textContent = text
  el.setAttribute('aria-hidden', 'true')
  el.style.left = `${a.left + a.width / 2}px`
  el.style.top = `${a.top}px`
  document.body.appendChild(el)
  const entry: { el: HTMLElement; animation?: Animation } = { el }
  live.set(target, entry)
  const done = () => {
    if (entry.animation) {
      entry.animation.onfinish = null
      entry.animation.oncancel = null
      entry.animation.cancel()
    }
    el.remove()
    if (live.get(target) === entry) live.delete(target)
  }
  if (typeof el.animate !== 'function') return done()
  let anim: Animation
  if (mode === 'fade' || !to) {
    anim = el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 600, easing: 'linear' })
  } else {
    const b = to.getBoundingClientRect()
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - a.top
    anim = el.animate(
      [
        { opacity: 0, transform: 'translate(-50%, 0) scale(1)' },
        { opacity: 1, offset: 0.15 },
        { opacity: 1, transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(1.06)`, offset: 0.8 },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(0.85)` },
      ],
      { duration: ms, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
    )
  }
  entry.animation = anim
  anim.onfinish = done
  anim.oncancel = done
}

/** Called when the source screen leaves, so detached awards never outlive it. */
export function clearFlyChips(): void {
  for (const { el, animation } of live.values()) {
    animation?.cancel()
    el.remove()
  }
  live.clear()
}

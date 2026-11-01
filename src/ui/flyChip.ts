import type { MotionMode } from './motionMode'

/**
 * A small "+N" chip for Intel awards. full: it flies (FLIP, 350 ms by default) from the source to the target element.
 * fade: it fades in and out in place, no transform. still: nothing at all (the static toast covers it).
 */
export function flyChip(text: string, from: Element | null, to: Element | null, mode: MotionMode, ms = 350): void {
  if (mode === 'still' || !from || typeof document === 'undefined') return
  const a = from.getBoundingClientRect()
  const el = document.createElement('span')
  el.className = 'fly-chip mono'
  el.textContent = text
  el.setAttribute('aria-hidden', 'true')
  el.style.left = `${a.left + a.width / 2}px`
  el.style.top = `${a.top}px`
  document.body.appendChild(el)
  const done = () => el.remove()
  if (typeof el.animate !== 'function') return done()
  let anim: Animation
  if (mode === 'fade' || !to) {
    anim = el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 600, easing: 'linear' })
  } else {
    const b = to.getBoundingClientRect()
    const dx = b.left + b.width / 2 - (a.left + a.width / 2)
    const dy = b.top + b.height / 2 - a.top
    anim = el.animate([{ opacity: 0, transform: 'translate(-50%, 0)' }, { opacity: 1, offset: 0.15 }, { opacity: 1, transform: `translate(calc(-50% + ${dx}px), ${dy}px)` }], { duration: ms, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' })
  }
  anim.onfinish = done
  anim.oncancel = done
}

const CONTROL = 'button, [role="button"], a, input, select, textarea'

/** The control under a pointer or key target, including a click on a label's text. */
export function controlOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const direct = target.closest(CONTROL)
  if (direct instanceof HTMLElement) return direct
  const label = target.closest('label')
  if (label instanceof HTMLLabelElement) {
    const input = label.querySelector('input, select, textarea')
    if (input instanceof HTMLElement) return input
  }
  return null
}

export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' '
}

export function isButtonLike(el: HTMLElement): boolean {
  return el.matches('button, [role="button"], a')
}

/** Skip controls that will not do anything. */
export function isInert(el: HTMLElement): boolean {
  if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return true
  if (el instanceof HTMLInputElement && el.type === 'hidden') return true
  return false
}

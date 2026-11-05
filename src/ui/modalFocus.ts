/** Native radio groups have one Tab stop, the checked radio when one is selected. */
export function modalTabStops(elements: HTMLElement[]) {
  const enabled = elements.filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0)
  return enabled.filter((el) => {
    if (!el.matches('input[type="radio"]')) return true
    const radio = el as HTMLInputElement
    if (!radio.name) return true
    const group = enabled.filter((other) => other.matches('input[type="radio"]') &&
      (other as HTMLInputElement).name === radio.name && (other as HTMLInputElement).form === radio.form)
    return el === (group.find((other) => (other as HTMLInputElement).checked) ?? group[0])
  })
}

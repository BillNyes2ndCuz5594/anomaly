import { useState, type PointerEvent } from 'react'

/**
 * Pressed state for mouse and touch. :active is brief on some phones,
 * so the button keeps a data attribute until the pointer lifts or leaves.
 */
export function usePressed() {
  const [id, setId] = useState<string | null>(null)
  return (key: string, disabled = false) => ({
    'data-pressed': !disabled && id === key ? 'true' : undefined,
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (disabled || e.button !== 0) return
      setId(key)
    },
    onPointerUp: () => setId((cur) => (cur === key ? null : cur)),
    onPointerCancel: () => setId((cur) => (cur === key ? null : cur)),
    onPointerLeave: () => setId((cur) => (cur === key ? null : cur)),
  })
}

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { modalTabStops } from './modalFocus'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  testId?: string
  restoreFocus?: boolean
}

/** Accessible modal: labelled dialog, focus moves in, Tab is trapped, Escape closes, focus returns. */
export default function Modal({ title, onClose, children, testId, restoreFocus = true }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const restoreFocusRef = useRef(restoreFocus)

  useEffect(() => {
    restoreFocusRef.current = restoreFocus
  }, [restoreFocus])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    const first = root?.querySelector<HTMLElement>('[data-autofocus]') ?? root?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => {
      if (!restoreFocusRef.current) return
      const active = document.activeElement
      if (
        active &&
        active !== document.body &&
        !root?.contains(active) &&
        active.closest('[role="dialog"], [aria-modal="true"]')
      ) {
        return
      }
      previous?.focus?.()
    }
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    // Keep question and other page shortcuts out of the dialog. Native controls still work.
    e.stopPropagation()
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = modalTabStops([...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="modal-backdrop" onKeyDown={onKeyDown}>
      <div
        ref={ref}
        className="panel brackets modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
      >
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

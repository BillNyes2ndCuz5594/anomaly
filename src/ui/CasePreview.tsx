import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import cellsWebm from '../assets/video/backdrop-cells.webm?url'
import cellsMp4 from '../assets/video/backdrop-cells.mp4?url'
import cellsPoster from '../assets/video/backdrop-cells.webp?url'
import frostWebm from '../assets/video/backdrop-frost.webm?url'
import frostMp4 from '../assets/video/backdrop-frost.mp4?url'
import frostPoster from '../assets/video/backdrop-frost.webp?url'
import creekWebm from '../assets/video/backdrop-creek.webm?url'
import creekMp4 from '../assets/video/backdrop-creek.mp4?url'
import creekPoster from '../assets/video/backdrop-creek.webp?url'
import { activeTarget, isPreviewTarget, mediaKind, placePreview, PREVIEW_TARGETS, type PreviewClip, type PreviewState, type PreviewTarget } from './casePreviewData'
import type { MotionMode } from './motionMode'
import { useMotionMode } from './useMotionMode'
import './casePreview.css'

const CLIP_MEDIA: Record<PreviewClip, { webm: string; mp4: string; poster: string }> = {
  cells: { webm: cellsWebm, mp4: cellsMp4, poster: cellsPoster },
  creek: { webm: creekWebm, mp4: creekMp4, poster: creekPoster },
  frost: { webm: frostWebm, mp4: frostMp4, poster: frostPoster },
}

/** The crop itself. A video only in full motion; every other mode gets the poster image. */
export function PreviewMedia({ clip, mode }: { clip: PreviewClip; mode: MotionMode }) {
  const m = CLIP_MEDIA[clip]
  if (mediaKind(mode) === 'poster') return <img src={m.poster} alt="" aria-hidden="true" draggable={false} />
  return (
    <video autoPlay loop muted playsInline preload="auto" poster={m.poster} aria-hidden="true">
      <source src={m.webm} type="video/webm" />
      <source src={m.mp4} type="video/mp4" />
    </video>
  )
}

function targetOf(node: EventTarget | null): { id: PreviewTarget; el: HTMLElement } | null {
  if (!(node instanceof Element)) return null
  const el = node.closest<HTMLElement>('[data-testid]')
  const id = el?.dataset.testid
  return el && isPreviewTarget(id) ? { id, el } : null
}

/**
 * Hover or keyboard focus on a hub case card shows a small preview of that case's loop.
 * It attaches to the existing buttons by data-testid with delegated listeners and draws into a portal, so the card
 * markup and layout are untouched. Mounted only on the hub route; it unmounts the media the moment the pointer or
 * focus leaves, so nothing plays while nothing is hovered.
 */
export default function CasePreview() {
  const mode = useMotionMode()
  const [state, setState] = useState<PreviewState>({ hover: null, focus: null })
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const els = useRef<Partial<Record<PreviewTarget, HTMLElement>>>({})
  const active = activeTarget(state)

  useEffect(() => {
    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const t = targetOf(e.target)
      if (!t) return
      els.current[t.id] = t.el
      setState((s) => (s.hover === t.id ? s : { ...s, hover: t.id }))
    }
    const out = (e: PointerEvent) => {
      const t = targetOf(e.target)
      if (!t || (e.relatedTarget instanceof Node && t.el.contains(e.relatedTarget))) return
      setState((s) => (s.hover === t.id ? { ...s, hover: null } : s))
    }
    const focusIn = (e: FocusEvent) => {
      const t = targetOf(e.target)
      // Only keyboard focus. A tap focuses the button too, and that should not flash a preview.
      if (!t || !t.el.matches(':focus-visible')) return
      els.current[t.id] = t.el
      setState((s) => (s.focus === t.id ? s : { ...s, focus: t.id }))
    }
    const focusOut = (e: FocusEvent) => {
      const t = targetOf(e.target)
      if (t) setState((s) => (s.focus === t.id ? { ...s, focus: null } : s))
    }
    const clear = () => setState({ hover: null, focus: null })
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('focusin', focusIn)
    document.addEventListener('focusout', focusOut)
    window.addEventListener('blur', clear)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focusIn)
      document.removeEventListener('focusout', focusOut)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // Keep the crop beside its card while the page scrolls or resizes.
  useEffect(() => {
    const el = active ? els.current[active] : undefined
    if (!active || !el || !el.isConnected) {
      setPos(null)
      return
    }
    const place = () => setPos(placePreview(el.getBoundingClientRect(), window.innerWidth, window.innerHeight))
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [active])

  if (!active || !pos) return null
  const clip = PREVIEW_TARGETS[active]
  return createPortal(
    <div className="case-preview" data-testid="case-preview" data-clip={clip} data-for={active} data-media={mediaKind(mode)} style={{ left: pos.left, top: pos.top }} aria-hidden="true">
      <PreviewMedia clip={clip} mode={mode} />
    </div>,
    document.body,
  )
}

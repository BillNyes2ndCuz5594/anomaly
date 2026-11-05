import { useRef, useState } from 'react'
import { useReportCode } from './useReportCode'

/** Copies text. Uses the async clipboard, then falls back to selecting the text so Ctrl+C works. */
async function copyText(text: string, node: HTMLElement | null): Promise<'copied' | 'selected'> {
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    /* fall through to the selection fallback */
  }
  if (node) {
    const range = document.createRange()
    range.selectNodeContents(node)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    try {
      if (document.execCommand('copy')) return 'copied'
    } catch {
      /* selection stays so the student can press Ctrl+C */
    }
  }
  return 'selected'
}

const DEFAULT_INTRO = 'This code moves your science progress. Use the same class code if you used one. Canvas is needed only if your teacher asks for it.'

export default function ReportCodePanel({ intro = DEFAULT_INTRO }: { intro?: string }) {
  const code = useReportCode()
  const node = useRef<HTMLElement>(null)
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle')
  if (!code) return null

  async function copy() {
    setState(await copyText(code, node.current))
  }

  return (
    <div className="report-panel" data-testid="report-panel" data-state={state}>
      <div className="row report-head">
        <span className="mono label amber">REPORT CODE</span>
        <button type="button" className="btn small" data-testid="copy-code" onClick={copy}>
          Copy
        </button>
      </div>
      {intro ? <p className="muted tiny">{intro}</p> : null}
      <code className="report-code mono" data-testid="report-code" ref={node} tabIndex={0} aria-label="Your report code">
        {code}
      </code>
      <span className="muted tiny copy-status" role="status" data-testid="copy-status">
        {state === 'copied' ? 'Copied! Paste it into Canvas for your teacher.' : state === 'selected' ? 'Selected! Press Ctrl+C to copy.' : ''}
      </span>
    </div>
  )
}

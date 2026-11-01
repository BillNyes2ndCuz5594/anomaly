/**
 * L4: "vitals stable". An ECG line sweeps across the card and flatlines into a check (700 ms in full motion).
 * Mount it when the last task of a lab is done; the parent needs position: relative. fade fades the final state in,
 * still shows it static. Decorative only: the verdict line already announces the result.
 */
export default function VitalsStable() {
  return (
    <div className="vitals-stable" data-testid="vitals-stable" aria-hidden="true">
      <svg viewBox="0 0 200 24" preserveAspectRatio="none" focusable="false">
        <path className="ecg-line" pathLength="1" d="M0 12 H50 L56 12 L60 4 L66 20 L71 8 L75 12 H120 L126 12 L130 3 L136 21 L141 9 L145 12 H168" />
        <path className="ecg-check" pathLength="1" d="M170 12 L178 19 L194 4" />
      </svg>
      <span className="vitals-word mono">VITALS STABLE</span>
    </div>
  )
}

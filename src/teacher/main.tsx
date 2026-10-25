import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './teacher.css'

// Teacher HQ entry. Must never import three, R3F, or anything from src/three.
function TeacherApp() {
  return (
    <main className="teacher" data-testid="teacher-hq">
      <header>
        <span className="mono label">ANOMALY // TEACHER HQ</span>
        <h1>Teacher HQ</h1>
      </header>
      <section className="card">
        <h2>Class results</h2>
        <p>
          Paste report codes here to see your class at a glance. Codes are decoded in this browser and never uploaded.
        </p>
        <textarea
          aria-label="Report codes, one per line"
          placeholder="Report codes arrive in a later update."
          rows={6}
          disabled
        />
        <p className="muted">Coming soon: heatmap by benchmark, weakest benchmarks, and a CSV download.</p>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TeacherApp />
  </StrictMode>,
)

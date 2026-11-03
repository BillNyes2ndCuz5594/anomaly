import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installTeacherAudio } from '../audio/installTeacher'
import './teacher.css'
import TeacherApp from './TeacherApp'

installTeacherAudio()

// Text size and line spacing chosen in the game apply here too (same browser storage, read only).
function applySavedSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('anomaly.v1') ?? 'null')
    const st = raw?.state?.settings
    const scale = { 0: 1, 1: 1.15, 2: 1.3 } as Record<number, number>
    const lh = { 0: 1.5, 1: 1.75, 2: 2 } as Record<number, number>
    if (st && scale[st.textSize]) document.documentElement.style.fontSize = `${16 * scale[st.textSize]}px`
    if (st && lh[st.lineSpacing]) document.body.style.lineHeight = String(lh[st.lineSpacing])
  } catch {
    /* no saved settings, keep defaults */
  }
}
applySavedSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TeacherApp />
  </StrictMode>,
)

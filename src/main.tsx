import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installGameAudio } from './audio/installGame'
import './index.css'
import './ui/motion.css'
import App from './App.tsx'

installGameAudio()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

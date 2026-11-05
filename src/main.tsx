import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installGameAudio } from './audio/installGame'
import './index.css'
import './ui/motion.css'
import App from './App.tsx'
import { installStorageSync } from './state/storageSync'
import { reloadForNewDeploy } from './three/recovery'

installGameAudio()

// A tab left open across a deploy asks for lazy chunks that no longer exist. Reload once onto the new build.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewDeploy()) e.preventDefault()
})

installStorageSync()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

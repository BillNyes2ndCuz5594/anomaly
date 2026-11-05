import { clearOpenCheckpoints } from './agentSlots'
import { handleGameStorageEvent } from './store'

/**
 * Another tab switched agents. This tab may be mid case or mid practice for the old agent, so
 * drop its open checkpoints and practice saves, then restart at the title screen as the new agent.
 * A fresh load is the only way to be sure no old in-memory session writes into the new agent.
 */
export function adoptOtherTabAgent(win: Pick<Window, 'location'> = window): void {
  clearOpenCheckpoints()
  win.location.hash = '#/'
  win.location.reload()
}

export function installStorageSync(win: Window = window): () => void {
  const onStorage = (e: StorageEvent) => handleGameStorageEvent(e, () => adoptOtherTabAgent(win))
  win.addEventListener('storage', onStorage)
  return () => win.removeEventListener('storage', onStorage)
}

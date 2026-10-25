import { createContext, useContext } from 'react'

/** Pixels of the canvas covered by HUD panels. The 3D scene is fitted into what is left. */
export interface Insets {
  right: number
  top: number
  bottom: number
}

export const NO_INSETS: Insets = { right: 0, top: 0, bottom: 0 }
export const InsetsContext = createContext<Insets>(NO_INSETS)
export const useInsets = () => useContext(InsetsContext)

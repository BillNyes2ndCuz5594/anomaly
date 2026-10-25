/** ?still=1 pins every turning model to a fixed three quarter pose. Used by the proof run so screenshots are repeatable. */
export const STILL = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('still') === '1'
/** The yaw of a pinned specimen: a readable three quarter view with the head turned toward the camera. */
export const STILL_YAW = (typeof window !== 'undefined' && Number(new URLSearchParams(window.location.search).get('yaw'))) || -0.62

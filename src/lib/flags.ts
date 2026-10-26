/** ?still=1 pins every turning model to a fixed three quarter pose. Used by the proof run so screenshots are repeatable. */
export const STILL = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('still') === '1'
/** The yaw of a pinned specimen: a readable three quarter view with the head turned toward the camera. */
export const STILL_YAW = (typeof window !== 'undefined' && Number(new URLSearchParams(window.location.search).get('yaw'))) || -0.62

/**
 * QA deep link: ?qaitems=L315-03,L142-02 makes the next case play exactly those evidence items, in that order.
 * Used only by the proof and mobile runs to reach specimen items in the real player. Ignored unless every id exists
 * (see session.start), and nothing in the UI links to it.
 */
export const QA_ITEMS: string[] =
  typeof window === 'undefined'
    ? []
    : (new URLSearchParams(window.location.search).get('qaitems') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^[A-Z0-9]{1,4}-\d{2}$/.test(s))
        .slice(0, 8)

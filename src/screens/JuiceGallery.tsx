import { CLIPS } from '../three/scenes/LoopSky'
import { ALERT_CLIP } from '../ui/residueAlertState'
import ResidueAlert from '../ui/ResidueAlert'
import { useMotionMode } from '../ui/useMotionMode'
import stingWebm from '../assets/video/seal-sting.webm?url'
import stingMp4 from '../assets/video/seal-sting.mp4?url'
import stingPoster from '../assets/video/seal-sting.webp?url'
import feedWebm from '../assets/video/briefing-feed.webm?url'
import feedMp4 from '../assets/video/briefing-feed.mp4?url'
import feedPoster from '../assets/video/briefing-feed.webp?url'
import warpWebm from '../assets/video/warp-streak.webm?url'
import warpMp4 from '../assets/video/warp-streak.mp4?url'
import warpPoster from '../assets/video/warp-streak.webp?url'
import creepWebm from '../assets/video/cold-frost-creep.webm?url'
import creepMp4 from '../assets/video/cold-frost-creep.mp4?url'
import frostFrame from '../assets/textures/cold-frost-frame.webp?url'
import thawWebm from '../assets/video/cold-thaw.webm?url'
import thawMp4 from '../assets/video/cold-thaw.mp4?url'
import thawHold from '../assets/video/cold-thaw-hold.webp?url'

// QA gallery for every juice clip (#/visuals/juice). Each row plays the clip, shows its poster, and shows what
// the fade (Low tier) and still (reduced motion, ?still=1) modes display. Overlay clips sit on pure black and are
// shown over a dark panel with screen blending, the way the game composites them. In still mode no <video>
// element is mounted, so the clip column shows the poster only.

type Row = { id: string; note: string; webm: string; mp4: string; poster: string; loop: boolean; screen: boolean }

const LOOP_NOTES: Record<string, string> = {
  swamp: 'briefing sky',
  cells: 'lab A sky',
  canopy: 'lab B sky',
  water: 'lab C sky',
  frost: 'cold case sky',
  title: 'title sky',
  debrief: 'debrief and results sky (main case)',
}

const ROWS: Row[] = [
  ...Object.entries(CLIPS).map(([id, c]) => ({ id: `loop ${id}`, note: LOOP_NOTES[id] ?? '', ...c, loop: true, screen: false })),
  { id: 'residue-alert', note: 'cold card, review due (H3)', ...ALERT_CLIP, loop: false, screen: true },
  { id: 'seal-sting', note: 'verdict seal (D2)', webm: stingWebm, mp4: stingMp4, poster: stingPoster, loop: false, screen: true },
  { id: 'briefing-feed', note: 'case 03-1 briefing feed', webm: feedWebm, mp4: feedMp4, poster: feedPoster, loop: true, screen: false },
  { id: 'warp-streak', note: 'hub to case warp', webm: warpWebm, mp4: warpMp4, poster: warpPoster, loop: false, screen: true },
  { id: 'cold-frost-creep', note: 'cold scan frost (poster is the frost frame)', webm: creepWebm, mp4: creepMp4, poster: frostFrame, loop: false, screen: true },
  { id: 'cold-thaw', note: 'cold results thaw (poster is the hold frame)', webm: thawWebm, mp4: thawMp4, poster: thawHold, loop: false, screen: true },
]

export default function JuiceGallery() {
  const mode = useMotionMode()
  return (
    <div className="visuals-grid juice" data-testid="visuals-juice" data-motion-mode={mode}>
      <p className="mono tiny muted juice-head">
        Motion mode now: {mode}. Fade shows the poster with an opacity fade. Still shows the poster and mounts no video.
      </p>
      {ROWS.map((r) => (
        <div key={r.id} className="juice-row" data-testid={`juice-${r.id.replace(/\s+/g, '-')}`}>
          <div className="juice-name mono">
            <strong>{r.id}</strong>
            <span className="tiny muted">{r.note}</span>
          </div>
          <figure className="juice-cell" data-screen={r.screen ? 'yes' : 'no'}>
            {mode === 'still' ? (
              <img src={r.poster} alt="" />
            ) : (
              <video muted playsInline preload="auto" loop={r.loop} autoPlay aria-hidden="true" tabIndex={-1}>
                <source src={r.webm} type="video/webm" />
                <source src={r.mp4} type="video/mp4" />
              </video>
            )}
            <figcaption className="mono tiny muted">clip</figcaption>
          </figure>
          <figure className="juice-cell" data-screen={r.screen ? 'yes' : 'no'}>
            <img src={r.poster} alt="" loading="lazy" />
            <figcaption className="mono tiny muted">poster</figcaption>
          </figure>
          <figure className="juice-cell" data-screen={r.screen ? 'yes' : 'no'}>
            <img className="juice-fade" src={r.poster} alt="" loading="lazy" />
            <figcaption className="mono tiny muted">fade and still</figcaption>
          </figure>
        </div>
      ))}
      <div className="juice-row" data-testid="juice-residue-live">
        <div className="juice-name mono">
          <strong>residue-alert modes</strong>
          <span className="tiny muted">the real component forced to fade and to still</span>
        </div>
        <figure className="juice-cell juice-live">
          <ResidueAlert forceMode="fade" />
          <figcaption className="mono tiny muted">fade</figcaption>
        </figure>
        <figure className="juice-cell juice-live">
          <ResidueAlert forceMode="still" />
          <figcaption className="mono tiny muted">still</figcaption>
        </figure>
      </div>
    </div>
  )
}

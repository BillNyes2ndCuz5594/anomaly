import swampWebm from '../../assets/video/backdrop-swamp.webm?url'
import swampMp4 from '../../assets/video/backdrop-swamp.mp4?url'
import swampPoster from '../../assets/video/backdrop-swamp.webp?url'
import cellsWebm from '../../assets/video/backdrop-cells.webm?url'
import cellsMp4 from '../../assets/video/backdrop-cells.mp4?url'
import cellsPoster from '../../assets/video/backdrop-cells.webp?url'
import canopyWebm from '../../assets/video/backdrop-canopy.webm?url'
import canopyMp4 from '../../assets/video/backdrop-canopy.mp4?url'
import canopyPoster from '../../assets/video/backdrop-canopy.webp?url'
import waterWebm from '../../assets/video/backdrop-water.webm?url'
import waterMp4 from '../../assets/video/backdrop-water.mp4?url'
import waterPoster from '../../assets/video/backdrop-water.webp?url'
import frostWebm from '../../assets/video/backdrop-frost.webm?url'
import frostMp4 from '../../assets/video/backdrop-frost.mp4?url'
import frostPoster from '../../assets/video/backdrop-frost.webp?url'
import debriefWebm from '../../assets/video/backdrop-debrief.webm?url'
import debriefMp4 from '../../assets/video/backdrop-debrief.mp4?url'
import debriefPoster from '../../assets/video/backdrop-debrief.webp?url'
import titleWebm from '../../assets/video/backdrop-title.webm?url'
import titleMp4 from '../../assets/video/backdrop-title.mp4?url'
import titlePoster from '../../assets/video/backdrop-title.webp?url'
import creekWebm from '../../assets/video/backdrop-creek.webm?url'
import creekMp4 from '../../assets/video/backdrop-creek.mp4?url'
import creekPoster from '../../assets/video/backdrop-creek.webp?url'

// Ambient loops painted into the sky dome. Each clip is a 3.2 s seamless loop (start and end frames matched at
// generation, then a 0.8 s crossfade at the seam), 960x540 (the dome window is soft, and 1280x720 decode slowed
// the next 3D compile on weak GPUs), VP9 WebM with an H.264 MP4 fallback, 100 to 480 KB. Posters are 960x540 WebP.
// The clip lives inside the dome shader: a soft window in a band above the horizon, graded toward the navy and
// cyan palette and faded into the sky gradient on every edge, so it never reads as a box. The poster frame (the
// first frame of the loop, precached) shows first and the video crossfades in after its first decoded frame, so
// there is no flash or black frame. Low tier and reduced motion get the poster only, with no video element.

// The title-attract replacement is a continuous 4 s, silent 960x540 take.
// TitleScreen uses this same contract for its poster-first, cover-cropped backdrop.
export type LoopClip = 'swamp' | 'cells' | 'canopy' | 'water' | 'frost' | 'title' | 'debrief' | 'creek'

export const CLIPS: Record<LoopClip, { webm: string; mp4: string; poster: string }> = {
  swamp: { webm: swampWebm, mp4: swampMp4, poster: swampPoster },
  cells: { webm: cellsWebm, mp4: cellsMp4, poster: cellsPoster },
  canopy: { webm: canopyWebm, mp4: canopyMp4, poster: canopyPoster },
  water: { webm: waterWebm, mp4: waterMp4, poster: waterPoster },
  frost: { webm: frostWebm, mp4: frostMp4, poster: frostPoster },
  title: { webm: titleWebm, mp4: titleMp4, poster: titlePoster },
  debrief: { webm: debriefWebm, mp4: debriefMp4, poster: debriefPoster },
  creek: { webm: creekWebm, mp4: creekMp4, poster: creekPoster },
}


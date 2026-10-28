// Crisp SVG diagrams for scene visuals, styled to match the hologram look.
// Art is drawn in a 400x220 space and the viewBox grows to the panel aspect (no letterboxing).
// Labels are laid out by diagramText.ts so they scale with the text size setting.
// Medium tier and up paint real imagery under the live labels: NASA photos of the Sun and planets
// (public domain, see docs/ART.md), a painted coast plate, cloud and seedling pot. Low tier keeps the
// flat vector art, which also sits under each image so a failed image load still shows a diagram.
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { resolveTier } from '../../state/quality'
import { useRuntime } from '../../state/runtime'
import { TEXT_SCALE } from '../../state/settings'
import { useGame } from '../../state/store'
import cloudUrl from '../../assets/diagrams/cloud.webp'
import coastUrl from '../../assets/diagrams/coast.webp'
import earthUrl from '../../assets/diagrams/earth.webp'
import jupiterUrl from '../../assets/diagrams/jupiter.webp'
import marsUrl from '../../assets/diagrams/mars.webp'
import mercuryUrl from '../../assets/diagrams/mercury.webp'
import neptuneUrl from '../../assets/diagrams/neptune.webp'
import potUrl from '../../assets/diagrams/pot.webp'
import saturnUrl from '../../assets/diagrams/saturn.webp'
import sunUrl from '../../assets/diagrams/sun.webp'
import uranusUrl from '../../assets/diagrams/uranus.webp'
import venusUrl from '../../assets/diagrams/venus.webp'
import { AMBER, BELT, COMET, INNER_OUTER, PLATE, SOLAR, cometSun, sceneLabelSpecs } from './diagramLabels'
import { baseScale, labelSize, layoutLabels, viewBoxFor, type PlacedLabel } from './diagramText'

const CY = '#3ee6ff'
const AM = AMBER
const TXT = '#e6f1ff'

function Labels({ placed }: { placed: PlacedLabel[] }) {
  return (
    <g fontWeight="700" fontFamily="var(--font-mono)" strokeLinejoin="round" paintOrder="stroke" stroke="#0a1426" data-labels="">
      {placed.map((p) => (
        <text key={p.key} x={p.x} y={p.y} textAnchor={p.anchor} fill={p.fill ?? TXT} fontSize={p.size} letterSpacing={p.size * 0.04} strokeWidth={p.size * 0.3} data-label={p.key}>
          {p.lines.map((l, i) => (
            <tspan key={i} x={p.x} dy={i === 0 ? 0 : p.lineHeight}>
              {l}
            </tspan>
          ))}
        </text>
      ))}
    </g>
  )
}

function Sun({ x, y, r = 18 }: { x: number; y: number; r?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2)
  return (
    <g>
      <circle cx={x} cy={y} r={r * 2.6} fill="url(#sd-glow)" />
      {rays.map((a, i) => (
        <line key={i} x1={x + Math.cos(a) * (r + 4)} y1={y + Math.sin(a) * (r + 4)} x2={x + Math.cos(a) * (r + (i % 2 ? 9 : 13))} y2={y + Math.sin(a) * (r + (i % 2 ? 9 : 13))} stroke={AM} strokeWidth="2.5" strokeLinecap="round" />
      ))}
      <circle cx={x} cy={y} r={r} fill="url(#sd-sun)" />
    </g>
  )
}

/** Space Sun: the SDO visible light disc (sunspots and limb darkening) in a soft corona. */
function SunDisc({ x, y, r, glow = 1.6 }: { x: number; y: number; r: number; glow?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * glow} fill="url(#sd-glow)" />
      <circle cx={x} cy={y} r={r * 1.12} fill="url(#sd-corona)" />
      <circle cx={x} cy={y} r={r} fill="url(#sd-sun)" />
      <image href={sunUrl} x={x - r} y={y - r} width={r * 2} height={r * 2} preserveAspectRatio="none" />
    </g>
  )
}

/** Sky Sun for the painted Earth scenes: a bright disc in warm haze, no cartoon rays. */
function SkySun({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 3.4} fill="url(#sd-haze)" />
      <circle cx={x} cy={y} r={r} fill="url(#sd-psun)" />
    </g>
  )
}

/** The painted coast (ocean, beach, lake, river, glacier) shared by the two water scenes. */
function Plate() {
  return <image href={coastUrl} x={PLATE.x} y={PLATE.y} width={PLATE.w} height={PLATE.h} preserveAspectRatio="none" />
}

function Waves({ x, y, w, rows = 3 }: { x: number; y: number; w: number; rows?: number }) {
  const paths = []
  for (let r = 0; r < rows; r++) {
    let d = `M ${x + (r % 2) * 8} ${y + r * 12}`
    for (let i = 0; i < w / 24; i++) d += ` q 6 -7 12 0 t 12 0`
    paths.push(<path key={r} d={d} fill="none" stroke="#7fe3ff" strokeWidth="2" strokeLinecap="round" opacity={0.95 - r * 0.2} />)
  }
  return <g>{paths}</g>
}

/** Wavy rising lines with an arrowhead on top. `h` is the rise in px. */
function Vapor({ x, y, n = 3, gap = 26, h = 70, color = '#d4f4ff' }: { x: number; y: number; n?: number; gap?: number; h?: number; color?: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.92">
      {Array.from({ length: n }, (_, i) => {
        const px = x + i * gap
        const top = y - h - (i % 2) * 8
        const half = (y - top) / 2
        return (
          <g key={i}>
            <path d={`M ${px} ${y} q 8 ${-half / 2} 0 ${-half} t 0 ${-half}`} />
            <path d={`M ${px - 5} ${top + 8} L ${px} ${top - 2} L ${px + 5} ${top + 8}`} />
          </g>
        )
      })}
    </g>
  )
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g fill="#dff1ff">
        <ellipse cx="0" cy="8" rx="48" ry="16" />
        <circle cx="-20" cy="-2" r="18" />
        <circle cx="8" cy="-11" r="23" />
        <circle cx="32" cy="2" r="16" />
      </g>
      <ellipse cx="2" cy="16" rx="42" ry="7" fill="#9fc3e6" opacity="0.55" />
    </g>
  )
}

const PHOTO: Record<string, string> = { '#b9b0a6': mercuryUrl, '#e8c47a': venusUrl, '#3f90d8': earthUrl, '#d9663f': marsUrl, '#d8b07a': jupiterUrl, '#8ad0e6': uranusUrl, '#3b5fd0': neptuneUrl }
// Saturn photo: the planet's centre and radius as fractions of the image (Cassini, 2004).
const SAT = { cx: 0.5013, cy: 0.5083, r: 0.2127, aspect: 153 / 384 }

/** A planet photo, shaded from the Sun's side (always to the left in these diagrams). */
function PhotoPlanet({ x, y, r, fill, ring }: { x: number; y: number; r: number; fill: string; ring?: boolean }) {
  if (ring) {
    const w = r / SAT.r
    const h = w * SAT.aspect
    return (
      <g>
        <circle cx={x} cy={y} r={r * 0.98} fill={fill} />
        <image href={saturnUrl} x={x - w * SAT.cx} y={y - h * SAT.cy} width={w} height={h} preserveAspectRatio="none" />
      </g>
    )
  }
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} />
      <image href={PHOTO[fill]} x={x - r} y={y - r} width={r * 2} height={r * 2} preserveAspectRatio="none" />
      <circle cx={x} cy={y} r={r} fill="url(#sd-term)" />
    </g>
  )
}

function Planet({ x, y, r, fill, ring, bands, art }: { x: number; y: number; r: number; fill: string; ring?: boolean; bands?: boolean; art?: boolean }) {
  const id = `pc-${x}-${y}`
  if (art && (ring || PHOTO[fill])) return <PhotoPlanet x={x} y={y} r={r} fill={fill} ring={ring} />
  return (
    <g>
      {ring ? <ellipse cx={x} cy={y} rx={r * 1.85} ry={r * 0.42} fill="none" stroke="#2a2218" strokeWidth="4.5" opacity="0.5" transform={`rotate(-16 ${x} ${y})`} /> : null}
      <clipPath id={id}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <circle cx={x} cy={y} r={r} fill={fill} />
      {bands ? (
        <g clipPath={`url(#${id})`} opacity="0.55">
          <rect x={x - r} y={y - r * 0.55} width={r * 2} height={r * 0.2} fill="#8a5a3a" />
          <rect x={x - r} y={y - r * 0.1} width={r * 2} height={r * 0.22} fill="#f3e2c4" />
          <rect x={x - r} y={y + r * 0.35} width={r * 2} height={r * 0.2} fill="#8a5a3a" />
          <ellipse cx={x + r * 0.35} cy={y + r * 0.2} rx={r * 0.2} ry={r * 0.12} fill="#c4492f" />
        </g>
      ) : null}
      <circle cx={x} cy={y} r={r} fill="url(#sd-shade)" />
      {ring ? (
        <ellipse cx={x} cy={y} rx={r * 1.85} ry={r * 0.42} fill="none" stroke="#f1dfae" strokeWidth="2.2" transform={`rotate(-16 ${x} ${y})`} opacity="0.95" />
      ) : null}
    </g>
  )
}

/** Thin concentric orbit arcs around the Sun at (sx, sy). */
function Orbits({ sx, sy, radii }: { sx: number; sy: number; radii: number[] }) {
  return (
    <g fill="none" stroke={CY} strokeOpacity="0.22" strokeWidth="1" strokeDasharray="3 5">
      {radii.map((r) => (
        <circle key={r} cx={sx} cy={sy} r={r} />
      ))}
    </g>
  )
}

type Labels = string[]

/** Down arrow streaks of rain under the cloud. */
function Rain({ xs, y, h }: { xs: number[]; y: number; h: number }) {
  return (
    <g stroke="#cfeaff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.9">
      {xs.map((x, i) => (
        <g key={x}>
          <line x1={x} y1={y + (i % 2) * 4} x2={x - 4} y2={y + h + (i % 2) * 4} />
          <path d={`M ${x - 8} ${y + h - 6 + (i % 2) * 4} L ${x - 4} ${y + h + 1 + (i % 2) * 4} L ${x} ${y + h - 6 + (i % 2) * 4}`} />
        </g>
      ))}
    </g>
  )
}

/** Painted water cycle: evaporation off the sea, condensation into the cloud, rain on the hills, runoff back. */
function WaterCycleArt() {
  return (
    <>
      <Plate />
      <SkySun x={176} y={30} r={11} />
      <Vapor x={22} y={150} n={4} gap={32} h={60} color="#eefaff" />
      <path d="M150 84 Q190 50 236 52" fill="none" stroke="#eefaff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M228 45 L238 52 L228 59" fill="none" stroke="#eefaff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <image href={cloudUrl} x={240} y={14} width={110} height={77.5} preserveAspectRatio="none" />
      <Rain xs={[266, 280, 294, 308, 322]} y={90} h={22} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M300 124 Q262 136 232 158 T182 182" stroke="#0a1426" strokeOpacity="0.45" strokeWidth="6.5" />
        <path d="M191 169 L181 182 L197 186" stroke="#0a1426" strokeOpacity="0.45" strokeWidth="6.5" />
        <path d="M300 124 Q262 136 232 158 T182 182" stroke="#7fd0ff" strokeWidth="3.2" />
        <path d="M191 169 L181 182 L197 186" stroke="#7fd0ff" strokeWidth="3.2" />
      </g>
    </>
  )
}

/** Painted coast for evaporation: vapor rises off the sea and the lake in the Sun. */
function OceanEvaporationArt() {
  return (
    <>
      <Plate />
      <SkySun x={304} y={38} r={13} />
      <Vapor x={18} y={152} n={5} gap={38} h={72} color="#eefaff" />
      <Vapor x={250} y={164} n={2} gap={22} h={40} color="#eefaff" />
    </>
  )
}

function WaterCycle() {
  return (
    <>
      <Sun x={360} y={34} r={14} />
      {/* ocean and land */}
      <path d="M-800 150 H206 V900 H-800 Z" fill="#0b3c66" />
      <path d="M-800 150 H206 V160 H-800 Z" fill="#0072B2" opacity="0.65" />
      <Waves x={-120} y={158} w={310} rows={3} />
      <path d="M206 156 Q250 150 292 112 Q312 96 330 112 Q365 140 400 146 H900 V900 H206 Z" fill="#27415f" />
      <path d="M292 112 Q312 96 330 112 L318 120 L304 114 Z" fill="#dff3ff" opacity="0.85" />
      {/* evaporation: up from the ocean */}
      <Vapor x={44} y={146} n={3} gap={30} h={58} />
      {/* condensation: vapor drifts into the cloud */}
      <path d="M118 86 Q150 56 192 62" fill="none" stroke="#d4f4ff" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M184 54 L194 62 L183 69" fill="none" stroke="#d4f4ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <Cloud x={238} y={64} s={1.15} />
      {/* precipitation: down from the cloud */}
      <g stroke="#7fd0ff" strokeWidth="2.6" strokeLinecap="round" fill="none">
        {[222, 246, 270].map((x, i) => (
          <g key={x}>
            <line x1={x} y1={96 + i * 2} x2={x - 5} y2={116 + i * 2} />
            <path d={`M ${x - 10} ${108 + i * 2} L ${x - 5} ${118 + i * 2} L ${x} ${108 + i * 2}`} />
          </g>
        ))}
      </g>
      {/* runoff: back down the slope to the ocean */}
      <path d="M296 126 Q268 140 236 150 T206 158" fill="none" stroke="#56B4E9" strokeWidth="4" strokeLinecap="round" />
      <path d="M218 148 L205 158 L220 163" fill="none" stroke="#56B4E9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

function OceanEvaporation() {
  return (
    <>
      <Sun x={338} y={40} r={18} />
      <path d="M-800 150 H900 V900 H-800 Z" fill="#0b2a4a" />
      <path d="M-800 150 H196 V900 H-800 Z" fill="#0072B2" opacity="0.55" />
      <Waves x={-120} y={158} w={296} rows={4} />
      {/* lake, river and glacier on the land side */}
      <path d="M196 150 H900 V900 H196 Z" fill="#27415f" />
      <ellipse cx="252" cy="184" rx="34" ry="11" fill="#0072B2" opacity="0.7" />
      <path d="M300 164 q30 10 54 30 t46 22" fill="none" stroke="#56B4E9" strokeWidth="6" strokeLinecap="round" />
      <path d="M326 150 L350 100 L372 134 L388 110 L400 128 L430 112 L470 150 Z" fill="#e6f5ff" />
      <path d="M350 100 L342 118 L352 112 L360 122 Z" fill="#b6d8f2" />
      <Vapor x={36} y={150} n={5} gap={34} h={76} />
      <Vapor x={240} y={172} n={2} gap={26} h={46} />
    </>
  )
}

const ROW = [
  { name: 'Mercury', r: 9, fill: '#b9b0a6' },
  { name: 'Venus', r: 14, fill: '#e8c47a' },
  { name: 'Earth', r: 15, fill: '#3f90d8' },
  { name: 'Mars', r: 11, fill: '#d9663f' },
]

function SolarRow({ labels, art }: { labels: Labels; art: boolean }) {
  const names = labels.slice(1)
  const { xs, sun } = SOLAR
  return (
    <>
      <Orbits sx={sun.x} sy={sun.y} radii={xs.map((x) => x - sun.x)} />
      {art ? (
        <SunDisc x={sun.x} y={sun.y} r={sun.r} glow={1.55} />
      ) : (
        <>
          <circle cx={sun.x} cy={sun.y} r={sun.r * 1.55} fill="url(#sd-glow)" />
          <circle cx={sun.x} cy={sun.y} r={sun.r} fill="url(#sd-sun)" />
        </>
      )}
      {xs.map((x, i) => {
        const missing = names[i] === '?'
        return (
          <g key={i}>
            {missing ? (
              <>
                <circle cx={x} cy={110} r={19} fill="#0a1426" stroke={AM} strokeWidth="2.5" strokeDasharray="5 5" />
                <text x={x} y={119} textAnchor="middle" fill={AM} fontSize="22" fontWeight="700" fontFamily="var(--font-mono)" stroke="#0a1426" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">?</text>
              </>
            ) : (
              <Planet x={x} y={110} r={ROW[i].r} fill={ROW[i].fill} art={art} />
            )}
          </g>
        )
      })}
    </>
  )
}

const INNER = [
  { x: 98, r: 8, fill: '#b9b0a6' },
  { x: 128, r: 12, fill: '#e8c47a' },
  { x: 160, r: 13, fill: '#3f90d8' },
  { x: 192, r: 9, fill: '#d9663f' },
]
const OUTER = [
  { x: 244, r: 27, fill: '#d8b07a', bands: true, ring: false },
  { x: 298, r: 22, fill: '#e6d29a', bands: false, ring: true },
  { x: 342, r: 16, fill: '#8ad0e6', bands: false, ring: false },
  { x: 380, r: 15, fill: '#3b5fd0', bands: false, ring: false },
]

function InnerOuter({ art }: { art: boolean }) {
  const { sun } = INNER_OUTER
  return (
    <>
      <Orbits sx={sun.x} sy={sun.y} radii={[...INNER, ...OUTER].map((p) => p.x - sun.x)} />
      {art ? (
        <SunDisc x={sun.x} y={sun.y} r={sun.r} glow={1.5} />
      ) : (
        <>
          <circle cx={sun.x} cy={sun.y} r={sun.r * 1.5} fill="url(#sd-glow)" />
          <circle cx={sun.x} cy={sun.y} r={sun.r} fill="url(#sd-sun)" />
        </>
      )}
      {INNER.map((p) => <Planet key={p.x} x={p.x} y={104} r={p.r} fill={p.fill} art={art} />)}
      {OUTER.map((p) => <Planet key={p.x} x={p.x} y={104} r={p.r} fill={p.fill} ring={p.ring} bands={p.bands} art={art} />)}
      <path d="M86 148 v8 h116 v-8" fill="none" stroke={CY} strokeWidth="2" />
      <path d="M216 148 v8 h176 v-8" fill="none" stroke={AM} strokeWidth="2" />
    </>
  )
}

/** Comet on a long oval with the Sun at one focus. The tail always points away from the Sun. */
function CometOrbit({ art }: { art: boolean }) {
  const { cx, cy, rx, ry } = COMET
  const sun = cometSun()
  const t = Math.PI - 0.8
  const comet = { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }
  const dx = comet.x - sun.x
  const dy = comet.y - sun.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const L = 52
  const tip = { x: comet.x + ux * L, y: comet.y + uy * L }
  const dust = `M ${comet.x + px * 8} ${comet.y + py * 8} Q ${comet.x + ux * L * 0.6 + px * 20} ${comet.y + uy * L * 0.6 + py * 20} ${tip.x + px * 30} ${tip.y + py * 30} Q ${tip.x + ux * 4} ${tip.y + uy * 4} ${tip.x - px * 6} ${tip.y - py * 6} Q ${comet.x + ux * L * 0.5 - px * 6} ${comet.y + uy * L * 0.5 - py * 6} ${comet.x - px * 8} ${comet.y - py * 8} Z`
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={CY} strokeWidth="2" strokeDasharray="7 6" opacity="0.85" />
      {art ? (
        <>
          <SunDisc x={sun.x} y={sun.y} r={13} glow={2.8} />
          {/* Two tails, both pointing away from the Sun: a curved pale dust tail and a straight blue ion tail. */}
          <g filter="url(#sd-soft)" fill="none" strokeLinecap="round">
            {[
              [24, 0.14, 1.1],
              [14, 0.24, 1],
              [6, 0.45, 0.9],
            ].map(([sw, op, f]) => (
              <path
                key={sw}
                d={`M ${comet.x} ${comet.y} Q ${comet.x + ux * L * 0.7 + px * 16 * f} ${comet.y + uy * L * 0.7 + py * 16 * f} ${comet.x + ux * L * 1.15 * f + px * 34 * f} ${comet.y + uy * L * 1.15 * f + py * 34 * f}`}
                stroke="#fff1d6"
                strokeWidth={sw}
                opacity={op}
              />
            ))}
            <line x1={comet.x} y1={comet.y} x2={comet.x + ux * L * 1.45} y2={comet.y + uy * L * 1.45} stroke="#8fd8ff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
          </g>
          <line x1={comet.x} y1={comet.y} x2={comet.x + ux * L * 1.3} y2={comet.y + uy * L * 1.3} stroke="#d6f3ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.75" />
          <circle cx={comet.x} cy={comet.y} r="13" fill="url(#sd-coma)" />
          <circle cx={comet.x} cy={comet.y} r="2.6" fill="#ffffff" />
        </>
      ) : (
        <>
          <circle cx={sun.x} cy={sun.y} r="36" fill="url(#sd-glow)" />
          <circle cx={sun.x} cy={sun.y} r="13" fill="url(#sd-sun)" />
          <path d={dust} fill="url(#sd-tail)" opacity="0.85" />
          <line x1={comet.x} y1={comet.y} x2={tip.x + ux * 12} y2={tip.y + uy * 12} stroke="#9fe6ff" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
          <circle cx={comet.x} cy={comet.y} r="15" fill="#bfefff" opacity="0.3" />
          <circle cx={comet.x} cy={comet.y} r="7" fill="#ffffff" />
        </>
      )}
    </>
  )
}


/** A lumpy rock outline: asteroids are not round. */
function rock(x: number, y: number, r: number, seed: number) {
  const n = 7
  const pts = Array.from({ length: n }, (_, i) => {
    const j = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453
    const f = 0.62 + (j - Math.floor(j)) * 0.5
    const a = (i / n) * Math.PI * 2 + seed
    return `${(x + Math.cos(a) * r * f).toFixed(1)} ${(y + Math.sin(a) * r * f * 0.85).toFixed(1)}`
  })
  return `M ${pts.join(' L ')} Z`
}

function AsteroidBelt({ art }: { art: boolean }) {
  const { sun } = BELT
  const rnd = (n: number) => {
    const a = Math.sin(n * 91.7) * 43758.5
    return a - Math.floor(a)
  }
  // The belt is a ring around the Sun, seen as an arc between Mars and Jupiter.
  const dots = Array.from({ length: 70 }, (_, i) => {
    const ang = (rnd(i + 1) - 0.5) * 1.9
    const rad = 192 + rnd(i + 101) * 36
    return { x: sun.x + Math.cos(ang) * rad, y: sun.y + Math.sin(ang) * rad, r: 1.3 + rnd(i + 201) * 2.4 }
  })
  const inner = [
    { x: 70, r: 6, fill: '#b9b0a6' },
    { x: 100, r: 9, fill: '#e8c47a' },
    { x: 132, r: 9, fill: '#3f90d8' },
    { x: 164, r: 7, fill: '#d9663f' },
  ]
  return (
    <>
      <Orbits sx={sun.x} sy={sun.y} radii={[42, 72, 104, 136]} />
      {art ? (
        <SunDisc x={sun.x} y={sun.y} r={sun.r} glow={1.9} />
      ) : (
        <>
          <circle cx={sun.x} cy={sun.y} r={sun.r * 1.9} fill="url(#sd-glow)" />
          <circle cx={sun.x} cy={sun.y} r={sun.r} fill="url(#sd-sun)" />
        </>
      )}
      {inner.map((p) => <Planet key={p.x} x={p.x} y={110} r={p.r} fill={p.fill} art={art} />)}
      {art
        ? dots.map((d, i) => <path key={i} d={rock(d.x, d.y, d.r * 1.15, i)} fill={i % 3 ? '#a89f94' : '#7f776e'} stroke="#3b362f" strokeWidth="0.5" />)
        : dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i % 3 ? '#b5aca2' : '#8f877e'} />)}
      <Planet x={286} y={110} r={24} fill="#d8b07a" bands art={art} />
      <Planet x={346} y={110} r={19} fill="#e6d29a" ring art={art} />
      <Planet x={388} y={110} r={11} fill="#8ad0e6" art={art} />
    </>
  )
}

// Painted seedling pot sprite: 300x595, rim top at row 310, soil at row 330.
const POT = { w: 78, h: 78 * (595 / 300), top: 22 }
const POT_SOIL = POT.top + POT.h * (330 / 595)

function PlantPotsArt({ labels }: { labels: Labels }) {
  const pot = (cx: number, deco: 'warm' | 'cool' | null, extra: { food: boolean; water: boolean }, flip: boolean) => (
    <g key={cx}>
      <image
        href={potUrl}
        x={cx - POT.w / 2}
        y={POT.top}
        width={POT.w}
        height={POT.h}
        preserveAspectRatio="none"
        transform={flip ? `translate(${cx * 2} 0) scale(-1 1)` : undefined}
      />
      {deco === 'warm' ? <SkySun x={cx + 56} y={40} r={11} /> : null}
      {deco === 'cool' ? (
        <g stroke="#dff4ff" strokeWidth="2.4" strokeLinecap="round">
          {[0, 60, 120].map((a) => (
            <line key={a} x1={cx + 56 - Math.cos((a * Math.PI) / 180) * 13} y1={40 - Math.sin((a * Math.PI) / 180) * 13} x2={cx + 56 + Math.cos((a * Math.PI) / 180) * 13} y2={40 + Math.sin((a * Math.PI) / 180) * 13} />
          ))}
        </g>
      ) : null}
      {extra.water ? (
        <g fill="#7fc8f0">
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M ${cx - 50 + i * 9} ${58 + i * 14} q 4.5 7 0 10.5 q -4.5 -3.5 0 -10.5 z`} />
          ))}
        </g>
      ) : null}
      {extra.food ? (
        <g fill="#efe6c4" stroke="#6b5a3a" strokeWidth="0.5">
          {[-22, -13, -4, 7, 15, 23].map((o, i) => <circle key={o} cx={cx + o} cy={POT_SOIL + (i % 2) * 1.4} r="1.9" />)}
        </g>
      ) : null}
    </g>
  )
  const deco = (l: string): 'warm' | 'cool' | null => (/warm/i.test(l) ? 'warm' : /cool/i.test(l) ? 'cool' : null)
  const a = labels[0] ?? ''
  const b = labels[1] ?? ''
  const thermal = deco(a) || deco(b)
  return (
    <>
      {!thermal ? <SkySun x={200} y={34} r={12} /> : null}
      {pot(110, deco(a), { food: /food/i.test(a), water: /water/i.test(a) && !thermal }, false)}
      {pot(290, deco(b), { food: /food/i.test(b), water: /water/i.test(b) && !thermal }, true)}
    </>
  )
}

function PlantPots({ labels }: { labels: Labels }) {
  const pot = (cx: number, deco: 'warm' | 'cool' | null, extra: { food: boolean; water: boolean }) => (
    <g key={cx}>
      {deco === 'warm' ? (
        <>
          <Sun x={cx} y={38} r={13} />
          <g stroke={AM} strokeWidth="2" strokeLinecap="round" opacity="0.6">
            {[-16, 0, 16].map((o) => <line key={o} x1={cx + o} y1={64} x2={cx + o} y2={76} />)}
          </g>
        </>
      ) : null}
      {deco === 'cool' ? (
        <g stroke="#bfefff" strokeWidth="2.5" strokeLinecap="round">
          {[0, 60, 120].map((a) => (
            <line key={a} x1={cx - Math.cos((a * Math.PI) / 180) * 15} y1={38 - Math.sin((a * Math.PI) / 180) * 15} x2={cx + Math.cos((a * Math.PI) / 180) * 15} y2={38 + Math.sin((a * Math.PI) / 180) * 15} />
          ))}
        </g>
      ) : null}
      {extra.water ? (
        <g fill="#56B4E9">
          {[-18, 0, 18].map((o) => (
            <path key={o} d={`M ${cx + o} 52 q 5 8 0 12 q -5 -4 0 -12 z`} />
          ))}
        </g>
      ) : null}
      <path d={`M${cx - 40} 124 H${cx + 40} L${cx + 32} 178 H${cx - 32} Z`} fill="url(#sd-pot)" />
      <rect x={cx - 45} y="114" width="90" height="13" rx="3" fill="#cf7240" />
      <ellipse cx={cx} cy="114" rx="40" ry="5" fill="#3a2a1c" />
      {extra.food ? (
        <g fill="#7ad37f">
          {[-24, -12, 4, 16, 26].map((o, i) => <circle key={o} cx={cx + o} cy={113 + (i % 2)} r="2" />)}
        </g>
      ) : null}
      <path d={`M${cx} 114 V80`} stroke="#3f9e5a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx={cx - 15} cy="82" rx="15" ry="7" fill="#4fbf6b" transform={`rotate(-25 ${cx - 15} 82)`} />
      <ellipse cx={cx + 15} cy="76" rx="15" ry="7" fill="#58cf77" transform={`rotate(25 ${cx + 15} 76)`} />
    </g>
  )
  const deco = (l: string): 'warm' | 'cool' | null => (/warm/i.test(l) ? 'warm' : /cool/i.test(l) ? 'cool' : null)
  const a = labels[0] ?? ''
  const b = labels[1] ?? ''
  const thermal = deco(a) || deco(b)
  return (
    <>
      {!thermal ? <Sun x={200} y={34} r={13} /> : null}
      {pot(110, deco(a), { food: /food/i.test(a), water: /water/i.test(a) && !thermal })}
      {pot(290, deco(b), { food: /food/i.test(b), water: /water/i.test(b) && !thermal })}
    </>
  )
}

const STARS = Array.from({ length: 70 }, (_, i) => {
  const a = Math.sin(i * 57.3) * 4375.85
  const b = Math.sin(i * 21.7) * 9137.31
  return { x: (a - Math.floor(a)) * 640 - 120, y: (b - Math.floor(b)) * 360 - 70, r: 0.5 + ((i * 7) % 5) * 0.18 }
})
const SPACE = new Set(['solar-system', 'inner-outer-planets', 'comet-orbit', 'asteroid-belt'])

export const SCENE_IDS = ['water-cycle', 'ocean-evaporation', 'solar-system', 'inner-outer-planets', 'comet-orbit', 'asteroid-belt', 'plant-pots'] as const

export default function SceneDiagram({ id, labels }: { id: string; labels: string[] }) {
  const svg = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState({ w: 400, h: 220 })
  const textSize = useGame((s) => s.settings.textSize)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const art = resolveTier(quality, autoTier) !== 'low'
  // Measure the panel so the viewBox matches its aspect and labels get their real rendered size.
  useLayoutEffect(() => {
    const el = svg.current
    if (!el) return
    const read = () => {
      const r = el.getBoundingClientRect()
      setBox((b) => (Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { w: r.width, h: r.height }))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const vb = useMemo(() => viewBoxFor(box.w, box.h), [box])
  const size = labelSize(baseScale(box.w, box.h), TEXT_SCALE[textSize])
  const placed = useMemo(() => layoutLabels(sceneLabelSpecs(id, labels, art), size, vb), [id, labels, art, size, vb])
  let body: ReactNode
  switch (id) {
    case 'water-cycle':
      body = art ? <WaterCycleArt /> : <WaterCycle />
      break
    case 'ocean-evaporation':
      body = art ? <OceanEvaporationArt /> : <OceanEvaporation />
      break
    case 'solar-system':
      body = <SolarRow labels={labels} art={art} />
      break
    case 'inner-outer-planets':
      body = <InnerOuter art={art} />
      break
    case 'comet-orbit':
      body = <CometOrbit art={art} />
      break
    case 'asteroid-belt':
      body = <AsteroidBelt art={art} />
      break
    case 'plant-pots':
      body = art ? <PlantPotsArt labels={labels} /> : <PlantPots labels={labels} />
      break
    default:
      body = null
  }
  const { x, y, w, h } = vb
  const k = 14
  return (
    <svg ref={svg} className="scene-svg" viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet" data-scene={id} data-label-size={size.toFixed(2)}>
      <defs>
        <linearGradient id="sd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12244a" />
          <stop offset="1" stopColor="#0a1426" />
        </linearGradient>
        <radialGradient id="sd-glow">
          <stop offset="0" stopColor="#ffb547" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sd-sun" cx="0.4" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#fff2c2" />
          <stop offset="0.45" stopColor="#ffc15c" />
          <stop offset="1" stopColor="#f08a1c" />
        </radialGradient>
        <radialGradient id="sd-shade" cx="0.36" cy="0.34" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.5" />
        </radialGradient>
        <linearGradient id="sd-tail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#dff6ff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#bfefff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sd-pot" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b5532a" />
          <stop offset="0.5" stopColor="#d06a38" />
          <stop offset="1" stopColor="#8e3f20" />
        </linearGradient>
        <linearGradient id="sd-term" x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.5" stopColor="#000000" stopOpacity="0.05" />
          <stop offset="1" stopColor="#020611" stopOpacity="0.62" />
        </linearGradient>
        <radialGradient id="sd-corona">
          <stop offset="0.8" stopColor="#fff0c8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sd-haze">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.75" />
          <stop offset="0.35" stopColor="#ffe2a0" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sd-psun">
          <stop offset="0" stopColor="#fffdf2" />
          <stop offset="0.7" stopColor="#fff0c4" />
          <stop offset="1" stopColor="#ffd98a" />
        </radialGradient>
        <radialGradient id="sd-coma">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.3" stopColor="#d9f4ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#9fdcff" stopOpacity="0" />
        </radialGradient>
        <filter id="sd-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>
      <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} fill="url(#sd-sky)" />
      {SPACE.has(id) ? STARS.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#cfe9ff" opacity="0.55" />) : null}
      {body}
      <g fill="none" stroke={CY} strokeOpacity="0.5" strokeWidth="1.5">
        <path d={`M${x + 2} ${y + k} V${y + 2} H${x + k}`} />
        <path d={`M${x + w - 2} ${y + k} V${y + 2} H${x + w - k}`} />
        <path d={`M${x + 2} ${y + h - k} V${y + h - 2} H${x + k}`} />
        <path d={`M${x + w - 2} ${y + h - k} V${y + h - 2} H${x + w - k}`} />
      </g>
      <Labels placed={placed} />
    </svg>
  )
}

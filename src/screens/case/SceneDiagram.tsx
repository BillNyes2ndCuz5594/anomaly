// Crisp SVG diagrams for scene visuals. Stylized to match the hologram look. S4 may polish.
import type { ReactNode } from 'react'

const CY = '#3ee6ff'
const AM = '#ffb547'
const TXT = '#e6f1ff'

function Text({ x, y, children, anchor = 'middle', fill = TXT, size = 13 }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; fill?: string; size?: number }) {
  // Labels with a colon wrap onto two lines, e.g. "Group 1: water only".
  const lines = typeof children === 'string' && children.includes(': ') ? [children.split(': ')[0], children.split(': ').slice(1).join(': ')] : [children]
  return (
    <text x={x} y={y} textAnchor={anchor} fill={fill} fontSize={size} fontWeight="700" fontFamily="var(--font-mono)" letterSpacing="0.5" stroke="#0a1426" strokeWidth="3" paintOrder="stroke">
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 16}>
          {l}
        </tspan>
      ))}
    </text>
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

function Planet({ x, y, r, fill, ring, bands }: { x: number; y: number; r: number; fill: string; ring?: boolean; bands?: boolean }) {
  const id = `pc-${x}-${y}`
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

function WaterCycle({ labels }: { labels: Labels }) {
  return (
    <>
      <Sun x={360} y={34} r={14} />
      {/* ocean and land */}
      <path d="M0 150 H206 V220 H0 Z" fill="#0b3c66" />
      <path d="M0 150 H206 V160 H0 Z" fill="#0072B2" opacity="0.65" />
      <Waves x={6} y={158} w={190} rows={3} />
      <path d="M206 156 Q250 150 292 112 Q312 96 330 112 Q365 140 400 146 V220 H206 Z" fill="#27415f" />
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
      <Text x={86} y={206}>{labels[0] ?? ''}</Text>
      <Text x={72} y={58}>{labels[1] ?? ''}</Text>
      <Text x={238} y={26}>{labels[2] ?? ''}</Text>
    </>
  )
}

function OceanEvaporation({ labels }: { labels: Labels }) {
  const water = labels.find((l) => /lagoon|ocean|lake/i.test(l))
  const sun = labels.find((l) => /sun/i.test(l))
  return (
    <>
      <Sun x={338} y={40} r={18} />
      <path d="M0 150 H400 V220 H0 Z" fill="#0b2a4a" />
      <path d="M0 150 H196 V220 H0 Z" fill="#0072B2" opacity="0.55" />
      <Waves x={6} y={158} w={176} rows={4} />
      {/* lake, river and glacier on the land side */}
      <path d="M196 150 H400 V220 H196 Z" fill="#27415f" />
      <ellipse cx="258" cy="190" rx="34" ry="12" fill="#0072B2" opacity="0.7" />
      <path d="M300 164 q30 10 54 30 t46 22" fill="none" stroke="#56B4E9" strokeWidth="6" strokeLinecap="round" />
      <path d="M326 150 L350 100 L372 134 L388 110 L400 128 V150 Z" fill="#e6f5ff" />
      <path d="M350 100 L342 118 L352 112 L360 122 Z" fill="#b6d8f2" />
      <Vapor x={36} y={150} n={5} gap={34} h={76} />
      <Vapor x={246} y={176} n={2} gap={26} h={50} />
      {sun ? <Text x={338} y={84}>{sun}</Text> : null}
      {water ? <Text x={92} y={208}>{water}</Text> : null}
    </>
  )
}

const ROW = [
  { name: 'Mercury', r: 9, fill: '#b9b0a6' },
  { name: 'Venus', r: 14, fill: '#e8c47a' },
  { name: 'Earth', r: 15, fill: '#3f90d8' },
  { name: 'Mars', r: 11, fill: '#d9663f' },
]

function SolarRow({ labels }: { labels: Labels }) {
  const names = labels.slice(1)
  const xs = [120, 190, 260, 335]
  return (
    <>
      <Orbits sx={10} sy={110} radii={xs.map((x) => x - 10)} />
      <circle cx="10" cy="110" r="64" fill="url(#sd-glow)" />
      <circle cx="10" cy="110" r="42" fill="url(#sd-sun)" />
      <Text x={30} y={186} anchor="start">{labels[0] ?? ''}</Text>
      {xs.map((x, i) => {
        const missing = names[i] === '?'
        return (
          <g key={i}>
            {missing ? (
              <>
                <circle cx={x} cy={110} r={19} fill="#0a1426" stroke={AM} strokeWidth="2.5" strokeDasharray="5 5" />
                <Text x={x} y={119} fill={AM} size={22}>?</Text>
              </>
            ) : (
              <Planet x={x} y={110} r={ROW[i].r} fill={ROW[i].fill} />
            )}
            {!missing ? <Text x={x} y={156 + (i % 2) * 22}>{names[i] ?? ''}</Text> : null}
          </g>
        )
      })}
    </>
  )
}

const INNER = [
  { x: 96, r: 8, fill: '#b9b0a6' },
  { x: 126, r: 12, fill: '#e8c47a' },
  { x: 158, r: 13, fill: '#3f90d8' },
  { x: 190, r: 9, fill: '#d9663f' },
]
const OUTER = [
  { x: 244, r: 27, fill: '#d8b07a', bands: true, ring: false },
  { x: 298, r: 22, fill: '#e6d29a', bands: false, ring: true },
  { x: 342, r: 16, fill: '#8ad0e6', bands: false, ring: false },
  { x: 380, r: 15, fill: '#3b5fd0', bands: false, ring: false },
]

function InnerOuter({ labels }: { labels: Labels }) {
  return (
    <>
      <Orbits sx={10} sy={104} radii={[...INNER, ...OUTER].map((p) => p.x - 10)} />
      <circle cx="10" cy="104" r="76" fill="url(#sd-glow)" />
      <circle cx="10" cy="104" r="50" fill="url(#sd-sun)" />
      {INNER.map((p) => <Planet key={p.x} x={p.x} y={104} r={p.r} fill={p.fill} />)}
      {OUTER.map((p) => <Planet key={p.x} x={p.x} y={104} r={p.r} fill={p.fill} ring={p.ring} bands={p.bands} />)}
      <path d="M84 148 v8 h116 v-8" fill="none" stroke={CY} strokeWidth="2" />
      <path d="M216 148 v8 h176 v-8" fill="none" stroke={AM} strokeWidth="2" />
      <Text x={22} y={182} anchor="start">{labels[0] ?? ''}</Text>
      <Text x={142} y={180}>{labels[1] ?? ''}</Text>
      <Text x={304} y={180}>{labels[2] ?? ''}</Text>
    </>
  )
}

/** Comet on a long oval with the Sun at one focus. The tail always points away from the Sun. */
function CometOrbit({ labels }: { labels: Labels }) {
  const cx = 212
  const cy = 112
  const rx = 166
  const ry = 66
  const c = Math.sqrt(rx * rx - ry * ry)
  const sun = { x: cx - c, y: cy }
  const t = Math.PI - 0.8
  const comet = { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) }
  const dx = comet.x - sun.x
  const dy = comet.y - sun.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const L = 46
  const tip = { x: comet.x + ux * L, y: comet.y + uy * L }
  const dust = `M ${comet.x + px * 6} ${comet.y + py * 6} Q ${tip.x + px * 6 + ux * 8} ${tip.y + py * 6 + uy * 8} ${tip.x + px * 30} ${tip.y + py * 30} Q ${comet.x + ux * L * 0.5 + px * 3} ${comet.y + uy * L * 0.5 + py * 3} ${comet.x - px * 6} ${comet.y - py * 6} Z`
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={CY} strokeWidth="2" strokeDasharray="7 6" opacity="0.85" />
      <circle cx={sun.x} cy={sun.y} r="36" fill="url(#sd-glow)" />
      <circle cx={sun.x} cy={sun.y} r="13" fill="url(#sd-sun)" />
      <path d={dust} fill="url(#sd-tail)" opacity="0.85" />
      <line x1={comet.x} y1={comet.y} x2={tip.x + ux * 18} y2={tip.y + uy * 18} stroke="#9fe6ff" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
      <circle cx={comet.x} cy={comet.y} r="15" fill="#bfefff" opacity="0.3" />
      <circle cx={comet.x} cy={comet.y} r="7" fill="#ffffff" />
      <Text x={sun.x} y={sun.y - 24}>{labels[0] ?? ''}</Text>
      <Text x={272} y={cy + ry + 34}>{labels[1] ?? ''}</Text>
    </>
  )
}

function AsteroidBelt({ labels }: { labels: Labels }) {
  const rnd = (n: number) => {
    const a = Math.sin(n * 91.7) * 43758.5
    return a - Math.floor(a)
  }
  // The belt is a ring around the Sun, seen as an arc between Mars and Jupiter.
  const dots = Array.from({ length: 70 }, (_, i) => {
    const ang = (rnd(i + 1) - 0.5) * 1.9
    const rad = 190 + rnd(i + 101) * 36
    return { x: 10 + Math.cos(ang) * rad, y: 110 + Math.sin(ang) * rad, r: 1.3 + rnd(i + 201) * 2.4 }
  })
  const inner = [
    { x: 66, r: 6, fill: '#b9b0a6' },
    { x: 96, r: 9, fill: '#e8c47a' },
    { x: 128, r: 9, fill: '#3f90d8' },
    { x: 160, r: 7, fill: '#d9663f' },
  ]
  return (
    <>
      <Orbits sx={10} sy={110} radii={[56, 86, 118, 150]} />
      <circle cx="10" cy="110" r="64" fill="url(#sd-glow)" />
      <circle cx="10" cy="110" r="36" fill="url(#sd-sun)" />
      {inner.map((p) => <Planet key={p.x} x={p.x} y={110} r={p.r} fill={p.fill} />)}
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i % 3 ? '#b5aca2' : '#8f877e'} />)}
      <Planet x={286} y={110} r={24} fill="#d8b07a" bands />
      <Planet x={346} y={110} r={19} fill="#e6d29a" ring />
      <Planet x={388} y={110} r={11} fill="#8ad0e6" />
      <Text x={218} y={206}>{labels[0] ?? ''}</Text>
    </>
  )
}

function PlantPots({ labels }: { labels: Labels }) {
  const pot = (cx: number, label: string, deco: 'warm' | 'cool' | null, extra: { food: boolean; water: boolean }) => (
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
      <Text x={cx} y={196}>{label}</Text>
    </g>
  )
  const deco = (l: string): 'warm' | 'cool' | null => (/warm/i.test(l) ? 'warm' : /cool/i.test(l) ? 'cool' : null)
  const a = labels[0] ?? ''
  const b = labels[1] ?? ''
  const thermal = deco(a) || deco(b)
  return (
    <>
      {!thermal ? <Sun x={200} y={34} r={13} /> : null}
      {pot(110, a, deco(a), { food: /food/i.test(a), water: /water/i.test(a) && !thermal })}
      {pot(290, b, deco(b), { food: /food/i.test(b), water: /water/i.test(b) && !thermal })}
    </>
  )
}

const STARS = Array.from({ length: 34 }, (_, i) => {
  const a = Math.sin(i * 57.3) * 4375.85
  const b = Math.sin(i * 21.7) * 9137.31
  return { x: (a - Math.floor(a)) * 400, y: (b - Math.floor(b)) * 220, r: 0.5 + ((i * 7) % 5) * 0.18 }
})
const SPACE = new Set(['solar-system', 'inner-outer-planets', 'comet-orbit', 'asteroid-belt'])

export const SCENE_IDS = ['water-cycle', 'ocean-evaporation', 'solar-system', 'inner-outer-planets', 'comet-orbit', 'asteroid-belt', 'plant-pots'] as const

export default function SceneDiagram({ id, labels }: { id: string; labels: string[] }) {
  let body: ReactNode
  switch (id) {
    case 'water-cycle':
      body = <WaterCycle labels={labels} />
      break
    case 'ocean-evaporation':
      body = <OceanEvaporation labels={labels} />
      break
    case 'solar-system':
      body = <SolarRow labels={labels} />
      break
    case 'inner-outer-planets':
      body = <InnerOuter labels={labels} />
      break
    case 'comet-orbit':
      body = <CometOrbit labels={labels} />
      break
    case 'asteroid-belt':
      body = <AsteroidBelt labels={labels} />
      break
    case 'plant-pots':
      body = <PlantPots labels={labels} />
      break
    default:
      body = <Text x={200} y={110}>{id}</Text>
  }
  return (
    <svg className="scene-svg" viewBox="0 0 400 220" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet" data-scene={id}>
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
      </defs>
      <rect width="400" height="220" fill="url(#sd-sky)" />
      {SPACE.has(id) ? STARS.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#cfe9ff" opacity="0.55" />) : null}
      {body}
      <g fill="none" stroke={CY} strokeOpacity="0.5" strokeWidth="1.5">
        <path d="M2 14 V2 H14" />
        <path d="M398 14 V2 H386" />
        <path d="M2 206 V218 H14" />
        <path d="M398 206 V218 H386" />
      </g>
    </svg>
  )
}

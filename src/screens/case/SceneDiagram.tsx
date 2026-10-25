// Crisp SVG diagrams for scene visuals. Stylized to match the hologram look. S4 may polish.
import type { ReactNode } from 'react'

const CY = '#3ee6ff'
const AM = '#ffb547'
const TXT = '#e6f1ff'

function Text({ x, y, children, anchor = 'middle', fill = TXT }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; fill?: string }) {
  // Labels with a colon wrap onto two lines, e.g. "Group 1: water only".
  const lines = typeof children === 'string' && children.includes(': ') ? [children.split(': ')[0], children.split(': ').slice(1).join(': ')] : [children]
  return (
    <text x={x} y={y} textAnchor={anchor} fill={fill} fontSize="13" fontWeight="700" fontFamily="var(--font-mono)" letterSpacing="0.5" stroke="#0a1426" strokeWidth="3" paintOrder="stroke">
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 16}>
          {l}
        </tspan>
      ))}
    </text>
  )
}

function Sun({ x, y, r = 18 }: { x: number; y: number; r?: number }) {
  const rays = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2)
  return (
    <g>
      <circle cx={x} cy={y} r={r + 10} fill={AM} opacity="0.14" />
      {rays.map((a, i) => (
        <line key={i} x1={x + Math.cos(a) * (r + 4)} y1={y + Math.sin(a) * (r + 4)} x2={x + Math.cos(a) * (r + 12)} y2={y + Math.sin(a) * (r + 12)} stroke={AM} strokeWidth="2.5" strokeLinecap="round" />
      ))}
      <circle cx={x} cy={y} r={r} fill={AM} />
    </g>
  )
}

function Waves({ x, y, w, rows = 3 }: { x: number; y: number; w: number; rows?: number }) {
  const paths = []
  for (let r = 0; r < rows; r++) {
    let d = `M ${x} ${y + r * 12}`
    for (let i = 0; i < w / 24; i++) d += ` q 6 -7 12 0 t 12 0`
    paths.push(<path key={r} d={d} fill="none" stroke={CY} strokeWidth="2" opacity={0.9 - r * 0.2} />)
  }
  return <g>{paths}</g>
}

function Vapor({ x, y, n = 3, gap = 26, h = 70 }: { x: number; y: number; n?: number; gap?: number; h?: number }) {
  return (
    <g fill="none" stroke="#bfefff" strokeWidth="2.2" strokeLinecap="round" opacity="0.85">
      {Array.from({ length: n }, (_, i) => {
        const px = x + i * gap
        return (
          <g key={i}>
            <path d={`M ${px} ${y} q 8 -${h / 4} 0 -${h / 2} t 0 -${h / 2}`} />
            <path d={`M ${px - 4} ${y - h - 4} l 4 -8 l 4 8`} />
          </g>
        )
      })}
    </g>
  )
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#cfe9ff" opacity="0.92">
      <ellipse cx="0" cy="8" rx="46" ry="16" />
      <circle cx="-18" cy="-2" r="18" />
      <circle cx="8" cy="-10" r="22" />
      <circle cx="30" cy="2" r="15" />
    </g>
  )
}

function Planet({ x, y, r, fill, ring }: { x: number; y: number; r: number; fill: string; ring?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} />
      <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.45} fill="#fff" opacity="0.18" />
      {ring ? <ellipse cx={x} cy={y} rx={r * 1.7} ry={r * 0.4} fill="none" stroke="#f4e2b0" strokeWidth="2" transform={`rotate(-14 ${x} ${y})`} /> : null}
    </g>
  )
}

type Labels = string[]

function WaterCycle({ labels }: { labels: Labels }) {
  return (
    <>
      <Sun x={340} y={42} r={16} />
      <path d="M0 160 H400 V220 H0 Z" fill="#0072B2" opacity="0.35" />
      <Waves x={6} y={166} w={250} />
      <path d="M290 160 L330 110 L360 140 L385 100 L400 120 V160 Z" fill="#2d4a6e" />
      <Vapor x={70} y={158} n={3} gap={34} h={100} />
      <Cloud x={200} y={80} s={1.1} />
      <g stroke="#7fd0ff" strokeWidth="2.5" strokeLinecap="round">
        <line x1="190" y1="108" x2="186" y2="128" />
        <line x1="210" y1="110" x2="206" y2="130" />
        <line x1="230" y1="108" x2="226" y2="128" />
      </g>
      <Text x={60} y={210}>{labels[0] ?? ''}</Text>
      <Text x={150} y={150} anchor="start">{labels[1] ?? ''}</Text>
      <Text x={200} y={34}>{labels[2] ?? ''}</Text>
    </>
  )
}

function OceanEvaporation({ labels }: { labels: Labels }) {
  const water = labels.find((l) => /lagoon|ocean|lake/i.test(l))
  const sun = labels.find((l) => /sun/i.test(l))
  return (
    <>
      <Sun x={64} y={44} r={18} />
      <path d="M0 150 H400 V220 H0 Z" fill="#0b2a4a" />
      <path d="M0 150 H190 V220 H0 Z" fill="#0072B2" opacity="0.5" />
      <Waves x={6} y={158} w={170} rows={4} />
      <ellipse cx="262" cy="190" rx="32" ry="12" fill="#0072B2" opacity="0.55" />
      <path d="M300 168 q30 10 60 30 t40 20" fill="none" stroke="#56B4E9" strokeWidth="6" strokeLinecap="round" />
      <path d="M330 150 L352 104 L372 136 L388 112 L400 130 V150 Z" fill="#dff3ff" opacity="0.92" />
      <Vapor x={40} y={150} n={5} gap={34} h={80} />
      <Vapor x={246} y={174} n={2} gap={30} h={50} />
      {sun ? <Text x={64} y={90}>{sun}</Text> : null}
      {water ? <Text x={92} y={208}>{water}</Text> : null}
    </>
  )
}

function SolarRow({ labels }: { labels: Labels }) {
  const names = labels.slice(1)
  const xs = [120, 190, 260, 335]
  const size = [9, 14, 15, 11]
  const col = ['#b9b0a6', '#e8c47a', '#4aa3df', '#d9663f']
  return (
    <>
      <line x1="10" y1="110" x2="395" y2="110" stroke={CY} strokeOpacity="0.25" strokeDasharray="4 6" />
      <circle cx="10" cy="110" r="52" fill={AM} opacity="0.2" />
      <circle cx="10" cy="110" r="42" fill={AM} />
      <Text x={40} y={196} anchor="start">{labels[0] ?? ''}</Text>
      {xs.map((x, i) => {
        const missing = names[i] === '?'
        return (
          <g key={i}>
            {missing ? (
              <>
                <circle cx={x} cy={110} r={18} fill="none" stroke={AM} strokeWidth="2.5" strokeDasharray="5 5" />
                <Text x={x} y={117} fill={AM}>?</Text>
              </>
            ) : (
              <Planet x={x} y={110} r={size[i]} fill={col[i]} />
            )}
            {!missing ? <Text x={x} y={160 + (i % 2) * 22}>{names[i] ?? ''}</Text> : null}
          </g>
        )
      })}
    </>
  )
}

function InnerOuter({ labels }: { labels: Labels }) {
  const inner = [[96, 8, '#b9b0a6'], [124, 12, '#e8c47a'], [154, 12, '#4aa3df'], [186, 9, '#d9663f']] as const
  const outer = [[240, 26, '#d8b07a', true], [292, 22, '#e6d29a', true], [338, 17, '#8ad0e6', false], [378, 16, '#4f6fd8', false]] as const
  return (
    <>
      <circle cx="10" cy="104" r="62" fill={AM} opacity="0.2" />
      <circle cx="10" cy="104" r="50" fill={AM} />
      {inner.map(([x, r, c]) => <Planet key={x} x={x} y={104} r={r} fill={c} />)}
      {outer.map(([x, r, c, ring]) => <Planet key={x} x={x} y={104} r={r} fill={c} ring={ring} />)}
      <path d="M86 150 v8 h110 v-8" fill="none" stroke={CY} strokeWidth="2" />
      <path d="M216 150 v8 h180 v-8" fill="none" stroke={AM} strokeWidth="2" />
      <Text x={30} y={182} anchor="start">{labels[0] ?? ''}</Text>
      <Text x={141} y={180}>{labels[1] ?? ''}</Text>
      <Text x={306} y={180}>{labels[2] ?? ''}</Text>
    </>
  )
}

function CometOrbit({ labels }: { labels: Labels }) {
  return (
    <>
      <ellipse cx="215" cy="110" rx="170" ry="62" fill="none" stroke={CY} strokeWidth="2" strokeDasharray="7 6" opacity="0.8" />
      <circle cx="90" cy="110" r="34" fill={AM} opacity="0.25" />
      <circle cx="90" cy="110" r="22" fill={AM} />
      <g transform="rotate(-24 150 78)">
        <path d="M160 78 L240 66 L240 90 Z" fill="#cfe9ff" opacity="0.22" />
        <path d="M160 78 L300 72 L300 84 Z" fill="#cfe9ff" opacity="0.12" />
      </g>
      <circle cx="152" cy="80" r="9" fill="#fff" />
      <circle cx="152" cy="80" r="15" fill="#bfefff" opacity="0.35" />
      <Text x={90} y={188}>{labels[0] ?? ''}</Text>
      <Text x={300} y={188}>{labels[1] ?? ''}</Text>
    </>
  )
}

function AsteroidBelt({ labels }: { labels: Labels }) {
  const dots = Array.from({ length: 44 }, (_, i) => {
    const a = Math.sin(i * 91.7) * 43758.5
    const r = a - Math.floor(a)
    const b = Math.sin(i * 12.9) * 9371.3
    const q = b - Math.floor(b)
    return { x: 216 + r * 34, y: 40 + q * 140, r: 1.5 + q * 2.2 }
  })
  return (
    <>
      <circle cx="10" cy="110" r="46" fill={AM} opacity="0.2" />
      <circle cx="10" cy="110" r="36" fill={AM} />
      {[[70, 6, '#b9b0a6'], [100, 9, '#e8c47a'], [132, 9, '#4aa3df'], [166, 7, '#d9663f']].map(([x, r, c]) => (
        <Planet key={String(x)} x={Number(x)} y={110} r={Number(r)} fill={String(c)} />
      ))}
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#a9a29a" />)}
      {[[274, 22, '#d8b07a', true], [330, 18, '#e6d29a', true], [372, 13, '#8ad0e6', false]].map(([x, r, c, ring]) => (
        <Planet key={String(x)} x={Number(x)} y={110} r={Number(r)} fill={String(c)} ring={Boolean(ring)} />
      ))}
      <Text x={233} y={204}>{labels[0] ?? ''}</Text>
    </>
  )
}

function PlantPots({ labels }: { labels: Labels }) {
  const pot = (cx: number, label: string, deco: 'warm' | 'cool' | null) => (
    <g key={cx}>
      {deco === 'warm' ? <Sun x={cx} y={36} r={13} /> : null}
      {deco === 'cool' ? (
        <g stroke="#bfefff" strokeWidth="2.5" strokeLinecap="round">
          {[0, 60, 120].map((a) => (
            <line key={a} x1={cx - Math.cos((a * Math.PI) / 180) * 14} y1={36 - Math.sin((a * Math.PI) / 180) * 14} x2={cx + Math.cos((a * Math.PI) / 180) * 14} y2={36 + Math.sin((a * Math.PI) / 180) * 14} />
          ))}
        </g>
      ) : null}
      <path d={`M${cx - 40} 120 H${cx + 40} L${cx + 32} 176 H${cx - 32} Z`} fill="#b5532a" />
      <rect x={cx - 44} y="112" width="88" height="12" rx="3" fill="#c96a3a" />
      <path d={`M${cx} 112 V78`} stroke="#3f9e5a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx={cx - 14} cy="80" rx="14" ry="7" fill="#4fbf6b" transform={`rotate(-25 ${cx - 14} 80)`} />
      <ellipse cx={cx + 14} cy="74" rx="14" ry="7" fill="#4fbf6b" transform={`rotate(25 ${cx + 14} 74)`} />
      <Text x={cx} y={202}>{label}</Text>
    </g>
  )
  const deco = (l: string): 'warm' | 'cool' | null => (/warm/i.test(l) ? 'warm' : /cool/i.test(l) ? 'cool' : null)
  const a = labels[0] ?? ''
  const b = labels[1] ?? ''
  return (
    <>
      {pot(110, a, deco(a))}
      {pot(290, b, deco(b))}
    </>
  )
}

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
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1d36" />
          <stop offset="1" stopColor="#0a1426" />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill="url(#sky)" />
      {body}
    </svg>
  )
}

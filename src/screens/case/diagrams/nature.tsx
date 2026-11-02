// Nature of Science diagrams (S7 section 4): a fair test, a bar graph, the lab tools.
import { AM, BLUE, CY, INK, NAVY, PALE, SKY, STEEL, YELLOW, type Diagram } from './kit'
import { Ground, HandLens, Pot, Sprig, Sun, Thermometer } from './parts'

function WaterCan({ x, base }: { x: number; base: number }) {
  return (
    <g>
      <path d={`M ${x + 12} ${base - 16} L ${x + 30} ${base - 34}`} stroke={SKY} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx={x + 32} cy={base - 36} rx="5" ry="7" fill={SKY} transform={`rotate(45 ${x + 32} ${base - 36})`} />
      <path d={`M ${x - 10} ${base - 28} q 10 -16 20 0`} fill="none" stroke={SKY} strokeWidth="4" />
      <rect x={x - 15} y={base - 30} width="30" height="30" rx="5" fill={BLUE} stroke={SKY} strokeWidth="2.5" />
      <line x1={x - 9} y1={base - 22} x2={x - 9} y2={base - 6} stroke={PALE} strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}

/** Two identical pots: one on a sunny sill under a window, one in the shade; the same can of water beside each. */
export function FairTestPlants() {
  return (
    <>
      {/* window and sun on the left */}
      <rect x="28" y="12" width="150" height="104" rx="4" fill="#1f3d6b" stroke={CY} strokeWidth="3" />
      <Sun x={72} y={46} r={13} />
      <path d="M103 12 V116 M28 64 H178" stroke={CY} strokeWidth="3" />
      <path d="M40 116 L150 116 L170 176 L58 176 Z" fill={AM} opacity="0.13" />
      {/* the shaded half */}
      <rect x="204" y="-800" width="1000" height="1800" fill={INK} opacity="0.5" />
      <line x1="202" y1="-800" x2="202" y2="1000" stroke={CY} strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 6" />
      <Ground y={177} fill="#3a2f2a" edge={AM} />
      {[100, 300].map((cx) => (
        <g key={cx}>
          <Sprig x={cx} base={130} h={46} leaves={2} />
          <Pot cx={cx} y={128} w={70} />
          <WaterCan x={cx + 64} base={177} />
        </g>
      ))}
    </>
  )
}

const BARS = [
  { x: 140, h: 70 },
  { x: 202, h: 48 },
  { x: 264, h: 96 },
  { x: 326, h: 132 },
]

/** A bar chart with four bars on a grid, axis lines and no numbers. The tallest bar (the last) is amber. */
export function BarGraph() {
  const tall = Math.max(...BARS.map((b) => b.h))
  return (
    <>
      <rect x="100" y="30" width="270" height="150" fill={NAVY} opacity="0.6" />
      <g stroke={CY} strokeOpacity="0.22" strokeWidth="1.2">
        {[150, 120, 90, 60, 30].map((y) => (
          <line key={y} x1="100" y1={y} x2="370" y2={y} />
        ))}
      </g>
      {BARS.map((b) => (
        <rect key={b.x} x={b.x - 20} y={180 - b.h} width="40" height={b.h} fill={b.h === tall ? AM : SKY} stroke={b.h === tall ? '#fff2c2' : BLUE} strokeWidth="2.5" />
      ))}
      <g stroke={CY} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M100 24 V180 H376" />
        {[150, 120, 90, 60, 30].map((y) => (
          <line key={y} x1="93" y1={y} x2="100" y2={y} />
        ))}
      </g>
    </>
  )
}

/** Ruler, pan balance, thermometer, graduated cylinder and hand lens on a bench, left to right. */
export function LabTools() {
  return (
    <>
      <Ground y={170} fill="#3a2f2a" edge={AM} />
      {/* ruler */}
      <path d="M14 168 L92 168 L100 152 L22 152 Z" fill={YELLOW} stroke={INK} strokeWidth="1.5" />
      <g stroke={INK} strokeWidth="1.6">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={26 + i * 8.6} y1={153} x2={25 + i * 8.6} y2={i % 2 ? 158 : 162} />
        ))}
      </g>
      {/* pan balance */}
      <path d="M116 170 L154 170 L148 160 L122 160 Z" fill={STEEL} />
      <line x1="135" y1="160" x2="135" y2="96" stroke={STEEL} strokeWidth="5" />
      <line x1="96" y1="96" x2="174" y2="96" stroke={CY} strokeWidth="4" strokeLinecap="round" />
      <circle cx="135" cy="96" r="5" fill={AM} />
      <g stroke={CY} strokeWidth="2">
        <path d="M98 96 L88 132 M98 96 L108 132 M172 96 L162 132 M172 96 L182 132" />
      </g>
      <path d="M82 132 H114 Q98 146 82 132 Z" fill={STEEL} stroke={CY} strokeWidth="2" />
      <path d="M156 132 H188 Q172 146 156 132 Z" fill={STEEL} stroke={CY} strokeWidth="2" />
      {/* thermometer */}
      <Thermometer x={208} y0={58} y1={168} fill={0.5} w={14} />
      {/* graduated cylinder */}
      <path d="M244 170 H298 L292 160 H250 Z" fill={STEEL} />
      <path d="M258 104 H284 V160 H258 Z" fill={SKY} opacity="0.75" />
      <line x1="258" y1="104" x2="284" y2="104" stroke="#bfe8ff" strokeWidth="2" />
      <path d="M256 54 L252 48 M256 54 V160 H286 V54" fill="#cfe9ff" fillOpacity="0.1" stroke={CY} strokeWidth="3" strokeLinejoin="round" />
      <g stroke={PALE} strokeOpacity="0.7" strokeWidth="1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <line key={i} x1="276" y1={64 + i * 14} x2="286" y2={64 + i * 14} />
        ))}
      </g>
      {/* hand lens */}
      <HandLens x={346} y={118} r={24} a={62} />
    </>
  )
}

// oxlint-disable-next-line react/only-export-components -- the id map is the registry SceneDiagram dispatches on
export const NATURE_DIAGRAMS: Record<string, Diagram> = {
  'fair-test-plants': FairTestPlants,
  'bar-graph': BarGraph,
  'lab-tools': LabTools,
}

// Life science diagrams (S7 section 4): plant parts, life cycles, food chains and webs, beaks,
// seasons, a changed habitat, inherited and learned traits.
import type { ReactNode } from 'react'
import { AM, CY, GREEN, INK, LEAF, ORANGE, PALE, PURPLE, SKY, SOIL, STEEL, VERM, YELLOW, blob, rnd, type Diagram } from './kit'
import { ArcArrow, Arrow, Ground, Sprig, Sun } from './parts'

const DEG = Math.PI / 180

/** A flowering plant: roots, stem, leaves, a flower and a fruit. */
export function PlantParts() {
  return (
    <>
      <Ground y={160} fill={SOIL} edge={AM} />
      <g fill="none" stroke="#e8d3a8" strokeWidth="3.5" strokeLinecap="round">
        <path d="M 200 160 Q 196 182 186 204 M 198 176 Q 176 184 166 200 M 200 172 Q 222 182 236 202 M 202 186 Q 214 196 212 212" />
      </g>
      <path d="M 200 160 V 56" stroke="#3f9e5a" strokeWidth="6" strokeLinecap="round" />
      {[
        [126, -1],
        [126, 1],
        [94, -1],
        [94, 1],
      ].map(([y, s]) => (
        <ellipse key={`${y}${s}`} cx={200 + s * 24} cy={y} rx="24" ry="9" fill={LEAF} stroke="#2f7a46" strokeWidth="1.5" transform={`rotate(${s * -24} ${200 + s * 24} ${y})`} />
      ))}
      {/* fruit on a side stalk */}
      <path d="M 200 112 Q 236 102 252 112" fill="none" stroke="#3f9e5a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="256" cy="126" r="14" fill={VERM} />
      <path d="M 250 118 q 4 -4 9 -2" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" />
      {/* flower */}
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={200 + Math.cos(a * DEG) * 14} cy={44 + Math.sin(a * DEG) * 14} rx="11" ry="7" fill={PURPLE} transform={`rotate(${a} ${200 + Math.cos(a * DEG) * 14} ${44 + Math.sin(a * DEG) * 14})`} />
      ))}
      <circle cx="200" cy="44" r="9" fill={YELLOW} />
    </>
  )
}

function Flower({ x, y, r = 8 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={x + Math.cos(a * DEG) * r} cy={y + Math.sin(a * DEG) * r} r={r * 0.8} fill={PURPLE} />
      ))}
      <circle cx={x} cy={y} r={r * 0.6} fill={YELLOW} />
    </g>
  )
}

/** Seed in soil, sprout, seedling, flowering plant and seed pod, in a row with straight arrows. */
export function SeedToPlant() {
  const xs = [40, 120, 200, 280, 360]
  return (
    <>
      <Ground y={140} fill={SOIL} edge={AM} />
      {/* seed */}
      <ellipse cx={xs[0]} cy={160} rx="10" ry="7" fill="#c49a5a" stroke={INK} strokeWidth="1.2" />
      {/* sprout */}
      <ellipse cx={xs[1]} cy={162} rx="9" ry="6" fill="#c49a5a" stroke={INK} strokeWidth="1.2" />
      <path d={`M ${xs[1]} 168 q -2 8 -6 12 M ${xs[1]} 168 q 3 6 6 10`} fill="none" stroke="#e8d3a8" strokeWidth="2" />
      <path d={`M ${xs[1]} 156 Q ${xs[1] + 2} 140 ${xs[1] - 4} 126`} fill="none" stroke="#3f9e5a" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx={xs[1] - 10} cy={124} rx="7" ry="3.5" fill={LEAF} transform={`rotate(-20 ${xs[1] - 10} 124)`} />
      {/* seedling */}
      <Sprig x={xs[2]} base={140} h={46} leaves={2} s={0.9} />
      {/* flowering plant */}
      <Sprig x={xs[3]} base={140} h={78} leaves={3} />
      <Flower x={xs[3]} y={56} />
      {/* plant with a seed pod */}
      <Sprig x={xs[4]} base={140} h={72} leaves={3} />
      <path d={`M ${xs[4]} 70 Q ${xs[4] + 4} 54 ${xs[4] + 16} 48`} fill="none" stroke="#3f9e5a" strokeWidth="3" />
      <path d={`M ${xs[4] + 8} 54 Q ${xs[4] + 26} 30 ${xs[4] + 34} 40 Q ${xs[4] + 28} 60 ${xs[4] + 8} 54 Z`} fill="#a88a4a" stroke={INK} strokeWidth="1.2" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={xs[4] + 16 + i * 5} cy={50 - i * 4} r="2.4" fill="#5a3d26" />
      ))}
      {xs.slice(0, 4).map((x) => (
        <Arrow key={x} x1={x + 20} y1={124} x2={x + 58} y2={124} color={AM} w={3.5} />
      ))}
    </>
  )
}

// Ring of four stages: top left, top right, bottom right, bottom left (clockwise), on one ellipse.
const RING = { cx: 200, cy: 107, rx: 141, ry: 64 }
const RING_A = [225, 315, 405, 495].map((d) => d * DEG)
const RING_AT = RING_A.map((a) => ({ x: RING.cx + Math.cos(a) * RING.rx, y: RING.cy + Math.sin(a) * RING.ry }))

/** Four stages in a ring with curved arrows from each stage to the next. */
function Ring({ stages }: { stages: ReactNode[] }) {
  const g = 24 * DEG
  return (
    <>
      {RING_A.map((a, i) => (
        <ArcArrow key={i} cx={RING.cx} cy={RING.cy} rx={RING.rx} ry={RING.ry} a0={a + g} a1={(RING_A[i + 1] ?? RING_A[0] + 2 * Math.PI) - g} color={AM} w={3.5} s={10} />
      ))}
      {stages.map((s, i) => (
        <g key={i} transform={`translate(${RING_AT[i].x.toFixed(1)} ${RING_AT[i].y.toFixed(1)})`}>
          {s}
        </g>
      ))}
    </>
  )
}

/** Butterfly life cycle: egg on a leaf, caterpillar, chrysalis, adult, in a ring. */
export function ButterflyCycle() {
  const egg = (
    <g>
      <path d="M -34 8 Q -6 -22 34 -4 Q 6 24 -34 8 Z" fill={LEAF} stroke="#2f7a46" strokeWidth="1.5" />
      <path d="M -30 7 Q 0 2 30 -3" fill="none" stroke="#2f7a46" strokeWidth="1.5" />
      <ellipse cx="2" cy="-4" rx="5" ry="6.5" fill="#f3ead2" stroke={INK} strokeWidth="1" />
    </g>
  )
  const caterpillar = (
    <g>
      {Array.from({ length: 7 }, (_, i) => {
        const x = -30 + i * 9.5
        const y = Math.sin(i * 0.9) * 4
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="7.5" fill={i === 6 ? INK : i % 2 ? YELLOW : PALE} stroke={INK} strokeWidth="1.5" />
            {i < 6 ? <line x1={x} y1={y - 7} x2={x} y2={y + 7} stroke={INK} strokeWidth="2.2" /> : null}
          </g>
        )
      })}
      <path d="M 30 -4 q 4 -10 10 -10 M 28 -6 q -1 -10 4 -13" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    </g>
  )
  const chrysalis = (
    <g>
      <line x1="-24" y1="-24" x2="24" y2="-24" stroke="#7a5236" strokeWidth="4" strokeLinecap="round" />
      <line x1="0" y1="-24" x2="0" y2="-18" stroke={INK} strokeWidth="2" />
      <path d="M 0 -18 Q 14 -12 12 4 Q 8 22 0 26 Q -8 22 -12 4 Q -14 -12 0 -18 Z" fill="#3aa864" stroke="#2f7a46" strokeWidth="1.5" />
      {[-6, 0, 6].map((x) => (
        <circle key={x} cx={x} cy={-6} r="1.6" fill={AM} />
      ))}
    </g>
  )
  const adult = (
    <g>
      <path d="M -2 -2 Q -34 -32 -36 -6 Q -34 4 -2 2 Z" fill={ORANGE} stroke={INK} strokeWidth="2" />
      <path d="M 2 -2 Q 34 -32 36 -6 Q 34 4 2 2 Z" fill={ORANGE} stroke={INK} strokeWidth="2" />
      <path d="M -2 2 Q -28 6 -24 24 Q -10 24 -2 6 Z" fill={ORANGE} stroke={INK} strokeWidth="2" />
      <path d="M 2 2 Q 28 6 24 24 Q 10 24 2 6 Z" fill={ORANGE} stroke={INK} strokeWidth="2" />
      <g fill={PALE}>
        <circle cx="-28" cy="-10" r="2" />
        <circle cx="28" cy="-10" r="2" />
        <circle cx="-20" cy="18" r="1.8" />
        <circle cx="20" cy="18" r="1.8" />
      </g>
      <ellipse cx="0" cy="2" rx="3" ry="14" fill={INK} />
      <path d="M -1 -11 q -4 -10 -10 -12 M 1 -11 q 4 -10 10 -12" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  )
  return <Ring stages={[egg, caterpillar, chrysalis, adult]} />
}

/** A grasshopper facing right at scale s; nymphs have wing buds, the adult full wings. */
function Hopper({ s, wings }: { s: number; wings: 'none' | 'buds' | 'full' }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M -8 2 L -20 -14 L -30 10" fill="none" stroke="#2f7a46" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="0" cy="0" rx="26" ry="8" fill={GREEN} />
      {wings === 'full' ? <path d="M -24 -2 Q 0 -14 18 -4 Q 0 -4 -24 -2 Z" fill="#5fbf7f" stroke="#2f7a46" strokeWidth="1.2" /> : null}
      {wings === 'buds' ? <ellipse cx="4" cy="-6" rx="7" ry="3" fill="#5fbf7f" /> : null}
      <circle cx="26" cy="-2" r="8" fill={GREEN} />
      <circle cx="29" cy="-4" r="2.2" fill={INK} />
      <path d="M 28 -9 Q 36 -22 44 -24" fill="none" stroke="#2f7a46" strokeWidth="2" strokeLinecap="round" />
      <path d="M 14 6 L 18 16 M 6 6 L 4 16" stroke="#2f7a46" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}

/** Grasshopper life cycle: eggs, small nymph, larger nymph, adult, in a ring. */
export function GrasshopperCycle() {
  const eggs = (
    <g>
      <path d="M -36 -6 H 36" stroke={AM} strokeOpacity="0.6" strokeWidth="2" />
      <ellipse cx="0" cy="10" rx="34" ry="16" fill={SOIL} />
      <ellipse cx="0" cy="10" rx="18" ry="9" fill="#3a2a1c" />
      {[-10, -4, 2, 8, -7, -1, 5].map((x, i) => (
        <ellipse key={i} cx={x + (i > 3 ? 1 : 0)} cy={i > 3 ? 14 : 7} rx="2.8" ry="4.2" fill="#e8d9a8" />
      ))}
    </g>
  )
  return <Ring stages={[eggs, <Hopper key="n1" s={0.68} wings="none" />, <Hopper key="n2" s={0.88} wings="buds" />, <Hopper key="a" s={1.1} wings="full" />]} />
}

function Tadpole({ legs }: { legs: boolean }) {
  return (
    <g>
      <path d="M 4 0 Q 24 -10 36 -2 Q 26 -4 20 4 Q 24 6 36 4 Q 20 10 4 2 Z" fill="#3b6b4f" />
      <ellipse cx="-6" cy="0" rx="14" ry="10" fill="#2f5d44" />
      <circle cx="-12" cy="-3" r="2" fill={PALE} />
      {legs ? <path d="M 4 6 L 10 16 L 16 16 M 2 -6 L 8 -16 L 14 -16" fill="none" stroke="#2f5d44" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </g>
  )
}

/** Frog life cycle: eggs in water, tadpole, tadpole with legs, adult frog, in a ring. */
export function FrogCycle() {
  const water = (body: ReactNode) => (
    <g>
      <ellipse cx="0" cy="4" rx="40" ry="18" fill={SKY} opacity="0.35" />
      <path d="M -34 -8 q 8 -5 16 0 t 16 0 t 16 0 t 16 0" fill="none" stroke={SKY} strokeWidth="2" />
      {body}
    </g>
  )
  const eggs = water(
    <g>
      {[
        [-14, 4],
        [-4, 0],
        [6, 5],
        [16, 1],
        [-8, 12],
        [2, 13],
        [12, 11],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="6" fill="#e6f6ff" fillOpacity="0.5" stroke={PALE} strokeWidth="1" />
          <circle cx={x} cy={y} r="2.2" fill={INK} />
        </g>
      ))}
    </g>,
  )
  const frog = (
    <g>
      <path d="M -26 14 Q -34 4 -20 -2 M 26 14 Q 34 4 20 -2" fill="none" stroke="#2f7a46" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="0" cy="4" rx="24" ry="16" fill={GREEN} />
      <ellipse cx="0" cy="-8" rx="18" ry="11" fill={GREEN} />
      <circle cx="-9" cy="-17" r="6" fill={GREEN} />
      <circle cx="9" cy="-17" r="6" fill={GREEN} />
      <circle cx="-9" cy="-18" r="3" fill={INK} />
      <circle cx="9" cy="-18" r="3" fill={INK} />
      <path d="M -10 -4 Q 0 2 10 -4" fill="none" stroke="#2f7a46" strokeWidth="2" />
      <path d="M -10 18 L -14 22 M 10 18 L 14 22" stroke="#2f7a46" strokeWidth="4" strokeLinecap="round" />
    </g>
  )
  return <Ring stages={[eggs, water(<Tadpole legs={false} />), water(<Tadpole legs />), frog]} />
}

/** A wading heron facing left, standing at (x, base). */
function Heron({ x, base }: { x: number; base: number }) {
  return (
    <g>
      <path d={`M ${x - 2} ${base} L ${x} ${base - 34} M ${x + 8} ${base} L ${x + 6} ${base - 34}`} stroke="#c9b26a" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx={x + 6} cy={base - 44} rx="20" ry="12" fill="#8fa9c4" transform={`rotate(-18 ${x + 6} ${base - 44})`} />
      <path d={`M ${x - 8} ${base - 50} Q ${x - 18} ${base - 64} ${x - 6} ${base - 74} Q ${x + 2} ${base - 84} ${x - 6} ${base - 92}`} fill="none" stroke="#b9cbe0" strokeWidth="6" strokeLinecap="round" />
      <circle cx={x - 7} cy={base - 94} r="6" fill="#b9cbe0" />
      <path d={`M ${x - 12} ${base - 95} L ${x - 34} ${base - 90} L ${x - 12} ${base - 91} Z`} fill={AM} />
      <circle cx={x - 6} cy={base - 96} r="1.5" fill={INK} />
    </g>
  )
}

/** Sun, sawgrass, grasshopper, frog and heron in a row, straight arrows showing where energy goes. */
export function FoodChainFlorida() {
  const xs = [40, 120, 200, 280, 360]
  return (
    <>
      <Ground y={140} fill="#2a4a3a" edge={GREEN} />
      <rect x="-800" y="148" width="2000" height="12" fill={SKY} opacity="0.25" />
      <Sun x={xs[0]} y={96} r={15} />
      <g fill="#8fae4a" stroke="#5f7a2e" strokeWidth="1">
        {[-14, -8, -2, 4, 10].map((o, i) => (
          <path key={o} d={`M ${xs[1] + o - 3} 140 L ${xs[1] + o + (i - 2) * 5} ${74 + Math.abs(i - 2) * 12} L ${xs[1] + o + 3} 140 Z`} />
        ))}
      </g>
      <g transform={`translate(${xs[2]} 112)`}>
        <Hopper s={0.85} wings="full" />
      </g>
      <g transform={`translate(${xs[3]} 116) scale(0.9)`}>
        <path d="M -26 14 Q -34 4 -20 -2 M 26 14 Q 34 4 20 -2" fill="none" stroke="#2f7a46" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="0" cy="4" rx="24" ry="16" fill={GREEN} />
        <ellipse cx="0" cy="-8" rx="18" ry="11" fill={GREEN} />
        <circle cx="-9" cy="-17" r="6" fill={GREEN} />
        <circle cx="9" cy="-17" r="6" fill={GREEN} />
        <circle cx="-9" cy="-18" r="3" fill={INK} />
        <circle cx="9" cy="-18" r="3" fill={INK} />
      </g>
      <Heron x={xs[4] + 8} base={140} />
      {xs.slice(0, 4).map((x, i) => (
        <Arrow key={x} x1={x + (i === 0 ? 26 : 22)} y1={i === 0 ? 96 : 104} x2={x + 56} y2={i === 0 ? 96 : 104} color={AM} w={3.5} />
      ))}
    </>
  )
}

function Fish({ x, y, s = 1, color = SKY, flip = false }: { x: number; y: number; s?: number; color?: string; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M 14 0 L 28 -10 L 28 10 Z" fill={color} />
      <ellipse cx="0" cy="0" rx="18" ry="9" fill={color} />
      <circle cx="-10" cy="-2" r="2" fill={INK} />
    </g>
  )
}

/** A small estuary web: sea grass and algae feed a shrimp, a crab and a small fish, which feed a bass and a pelican. */
export function FoodWebEstuary() {
  return (
    <>
      <rect x="-800" y="58" width="2000" height="1000" fill="#0b3c66" />
      <path d="M -800 58 H 1200" stroke={SKY} strokeWidth="2.5" />
      {/* sea grass and algae bed */}
      <rect x="-800" y="196" width="2000" height="900" fill="#4a3c2c" />
      <g fill="#5fbf7f">
        {Array.from({ length: 24 }, (_, i) => {
          const x = 8 + i * 16.5
          const h = 18 + rnd(i + 30) * 20
          return <path key={i} d={`M ${x} 198 Q ${x - 4} ${198 - h / 2} ${x + 3} ${198 - h} Q ${x + 2} ${198 - h / 2} ${x + 5} 198 Z`} />
        })}
      </g>
      <g fill="#7a8a3a">
        {[30, 110, 190, 270, 350].map((x, i) => (
          <path key={x} d={blob(x, 198, 10, 5, i + 20, 7)} />
        ))}
      </g>
      {/* shrimp */}
      <g transform="translate(80 140)">
        <path d="M -16 -4 Q 0 -16 16 -6 Q 20 4 10 8 Q 4 0 -4 6 Q -14 6 -16 -4 Z" fill="#f29d8a" stroke={INK} strokeWidth="1" />
        <path d="M -16 -4 Q -26 -16 -34 -14 M -16 -2 Q -28 -6 -34 -2" fill="none" stroke="#f29d8a" strokeWidth="1.5" />
        <circle cx="-12" cy="-6" r="1.6" fill={INK} />
      </g>
      {/* crab on the bottom */}
      <g transform="translate(300 182)">
        <path d="M -14 4 L -24 12 M -12 8 L -20 16 M 14 4 L 24 12 M 12 8 L 20 16" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="0" cy="0" rx="18" ry="11" fill={ORANGE} stroke={INK} strokeWidth="1" />
        <path d="M -12 -6 L -20 -16 M 12 -6 L 20 -16" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" />
        <circle cx="-21" cy="-18" r="5" fill={ORANGE} />
        <circle cx="21" cy="-18" r="5" fill={ORANGE} />
      </g>
      <Fish x={330} y={138} s={0.85} color={SKY} />
      {/* bass */}
      <Fish x={110} y={86} s={1.5} color="#5f8f4a" flip />
      {/* pelican above the water */}
      <g transform="translate(316 34)">
        <ellipse cx="6" cy="6" rx="20" ry="11" fill="#d9d2c4" />
        <path d="M -8 -2 Q -14 -16 -6 -20" fill="none" stroke="#d9d2c4" strokeWidth="6" strokeLinecap="round" />
        <circle cx="-6" cy="-21" r="6" fill="#d9d2c4" />
        <path d="M -10 -22 L -36 -14 L -12 -14 Z" fill={AM} />
        <path d="M -12 -14 Q -24 -6 -34 -13" fill="#e0b060" />
        <circle cx="-5" cy="-23" r="1.5" fill={INK} />
        <path d="M 10 0 Q 30 -14 40 -4" fill="none" stroke="#b9b0a6" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* who eats whom: arrows point from the food to the eater */}
      <g opacity="0.95">
        <Arrow x1={80} y1={186} x2={80} y2={156} color={CY} w={2.5} s={7} />
        <Arrow x1={248} y1={196} x2={278} y2={188} color={CY} w={2.5} s={7} />
        <Arrow x1={352} y1={186} x2={340} y2={154} color={CY} w={2.5} s={7} />
        <Arrow x1={88} y1={126} x2={104} y2={102} color={AM} w={2.5} s={7} />
        <Arrow x1={306} y1={134} x2={148} y2={92} color={AM} w={2.5} s={7} />
        <Arrow x1={282} y1={170} x2={140} y2={100} color={AM} w={2.5} s={7} />
        <Arrow x1={326} y1={124} x2={318} y2={56} color={AM} w={2.5} s={7} />
      </g>
    </>
  )
}

/** Three bird heads: a long thin beak (nectar), a hooked beak (fish), a short cone beak (seeds). */
export function BeakShapes() {
  const head = (x: number, color: string, beak: ReactNode, food: ReactNode) => (
    <g>
      {food}
      <circle cx={x} cy={70} r="26" fill={color} />
      <path d={`M ${x - 24} ${80} Q ${x - 10} ${106} ${x + 8} ${96}`} fill={color} />
      <circle cx={x + 8} cy={62} r="5" fill={PALE} />
      <circle cx={x + 9} cy={62} r="2.6" fill={INK} />
      {beak}
    </g>
  )
  return (
    <>
      <Ground y={186} fill="#24402f" edge={GREEN} />
      {head(
        64,
        '#2f8f55',
        <path d="M 88 66 L 132 116 L 84 76 Z" fill="#3b3f48" />,
        <g>
          <path d="M 150 186 V 140" stroke="#3f9e5a" strokeWidth="3" />
          <path d="M 130 116 L 150 112 L 156 140 L 146 142 Z" fill={PURPLE} stroke="#e7b3cf" strokeWidth="1.5" />
        </g>,
      )}
      {head(
        200,
        '#7a5236',
        <path d="M 222 58 Q 246 58 248 78 Q 246 90 238 92 Q 240 80 222 78 Z" fill={YELLOW} stroke={INK} strokeWidth="1.2" />,
        <g transform="translate(212 150)">
          <path d="M 14 0 L 28 -10 L 28 10 Z" fill={SKY} />
          <ellipse cx="0" cy="0" rx="18" ry="9" fill={SKY} />
          <circle cx="-10" cy="-2" r="2" fill={INK} />
        </g>,
      )}
      {head(
        334,
        VERM,
        <path d="M 356 60 L 378 72 L 356 84 Z" fill={ORANGE} stroke={INK} strokeWidth="1.2" />,
        <g fill="#d6b47a" stroke="#7a5a36" strokeWidth="1">
          {[
            [352, 160],
            [366, 168],
            [380, 158],
            [372, 176],
            [358, 176],
          ].map(([x, y]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4.5" ry="3" />
          ))}
        </g>,
      )}
    </>
  )
}

/** A Florida live oak in leaf under the Sun, and a northern maple bare in the snow. */
export function SeasonsFloridaNorth() {
  const branch = (x: number, y: number, a: number, len: number, depth: number): ReactNode[] => {
    const x2 = x + Math.cos(a) * len
    const y2 = y + Math.sin(a) * len
    const out: ReactNode[] = [<line key={`${x}-${y}-${a}`} x1={x} y1={y} x2={x2} y2={y2} stroke="#6b4a2e" strokeWidth={depth * 2 + 1} strokeLinecap="round" />]
    if (depth > 0) out.push(...branch(x2, y2, a - 0.42, len * 0.72, depth - 1), ...branch(x2, y2, a + 0.42, len * 0.72, depth - 1))
    return out
  }
  return (
    <>
      <rect x="200" y="-800" width="1000" height="1800" fill="#bfe8ff" opacity="0.08" />
      <Ground y={176} fill="#2f5a3a" edge={GREEN} />
      <rect x="200" y="176" width="1000" height="900" fill="#e8f2fb" />
      <line x1="200" y1="-800" x2="200" y2="1000" stroke={CY} strokeOpacity="0.4" strokeWidth="2" strokeDasharray="6 6" />
      {/* live oak */}
      <Sun x={40} y={36} r={13} />
      <path d="M 110 176 V 120 M 110 136 L 76 110 M 110 130 L 146 106" stroke="#6b4a2e" strokeWidth="10" strokeLinecap="round" />
      {[
        [110, 84, 34],
        [74, 96, 26],
        [146, 94, 28],
        [54, 112, 18],
        [170, 110, 18],
        [92, 70, 22],
        [130, 68, 22],
      ].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={r > 25 ? '#2f7a46' : '#3a8f55'} />
      ))}
      {/* bare maple in the snow */}
      <g>{branch(300, 176, -Math.PI / 2, 46, 4)}</g>
      <g fill="#ffffff">
        <path d="M 270 98 q 8 -4 14 0 q -7 3 -14 0 Z" />
        <path d="M 316 92 q 8 -4 14 0 q -7 3 -14 0 Z" />
        <ellipse cx="300" cy="178" rx="60" ry="6" />
      </g>
      <g stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round">
        {[
          [236, 40],
          [262, 66],
          [350, 34],
          [372, 80],
          [240, 120],
          [356, 132],
          [290, 26],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <line x1={x - 4} y1={y} x2={x + 4} y2={y} />
            <line x1={x - 2} y1={y - 3.5} x2={x + 2} y2={y + 3.5} />
            <line x1={x - 2} y1={y + 3.5} x2={x + 2} y2={y - 3.5} />
          </g>
        ))}
      </g>
    </>
  )
}

function Egret({ x, base, flip }: { x: number; base: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M -2 0 L 0 -22 M 6 0 L 4 -22" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="2" cy="-28" rx="13" ry="8" fill="#f4f6f8" />
      <path d="M -8 -32 Q -14 -42 -6 -50" fill="none" stroke="#f4f6f8" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="-6" cy="-51" r="4.5" fill="#f4f6f8" />
      <path d="M -10 -52 L -24 -49 L -10 -49 Z" fill={YELLOW} />
    </g>
  )
}

/** A wetland half drained for a road: wading birds on the wet side, a bulldozer on the dry side. */
export function EnvironmentChange() {
  return (
    <>
      {/* wet side */}
      <rect x="-800" y="120" width="1004" height="900" fill="#0b4a73" />
      <g fill="none" stroke={SKY} strokeWidth="2" opacity="0.8">
        {[136, 156, 176].map((y, i) => (
          <path key={y} d={`M ${-40 + i * 10} ${y} q 10 -5 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0`} />
        ))}
      </g>
      <g>
        {[18, 34, 150, 178].map((x, i) => (
          <g key={x}>
            <path d={`M ${x} 150 Q ${x + 2} 110 ${x - 2} 86`} fill="none" stroke="#5f7a2e" strokeWidth="3" />
            <rect x={x - 5} y={88 + (i % 2) * 8} width="8" height="18" rx="4" fill="#7a5236" />
          </g>
        ))}
      </g>
      <Egret x={70} base={150} />
      <Egret x={118} base={160} flip />
      {/* dry side: bare ground, a road and a bulldozer */}
      <path d="M 204 120 L 196 140 L 206 160 L 198 180 L 204 1000 L 1200 1000 L 1200 120 Z" fill="#8a6a44" />
      <path d="M 204 120 L 196 140 L 206 160 L 198 180 L 204 1000" fill="none" stroke={AM} strokeWidth="2" />
      <rect x="204" y="176" width="1000" height="26" fill="#4a5262" />
      <line x1="210" y1="189" x2="1200" y2="189" stroke={YELLOW} strokeWidth="2.5" strokeDasharray="12 10" />
      <g transform="translate(300 150)">
        <rect x="-34" y="10" width="64" height="16" rx="8" fill="#2b2f3a" stroke={STEEL} strokeWidth="2" />
        {[-24, -8, 8, 22].map((x) => (
          <circle key={x} cx={x} cy={18} r="4.5" fill={STEEL} />
        ))}
        <rect x="-30" y="-8" width="52" height="18" rx="2" fill={YELLOW} stroke={INK} strokeWidth="1.5" />
        <rect x="-18" y="-30" width="26" height="22" rx="2" fill={YELLOW} stroke={INK} strokeWidth="1.5" />
        <rect x="-13" y="-25" width="16" height="11" fill={SKY} opacity="0.7" />
        <path d="M 22 0 L 40 4 L 42 26 L 52 26 L 52 -6 L 44 -6" fill="none" stroke={INK} strokeWidth="3" />
        <path d="M 46 -8 Q 58 8 46 26" fill={STEEL} stroke={INK} strokeWidth="1.5" />
      </g>
    </>
  )
}

/** A patterned dog with its puppy (same coat pattern), and the puppy learning to sit on a hand signal. */
export function InheritedLearned() {
  const coat = '#ece4d6'
  const spot = '#5a3d26'
  return (
    <>
      <Ground y={178} />
      {/* adult dog standing, facing right */}
      <g>
        <path d="M 52 116 Q 30 100 36 84" fill="none" stroke={coat} strokeWidth="7" strokeLinecap="round" />
        {[62, 78, 128, 144].map((x) => (
          <rect key={x} x={x - 5} y="128" width="11" height="50" rx="4" fill={coat} />
        ))}
        <ellipse cx="102" cy="118" rx="56" ry="24" fill={coat} />
        <ellipse cx="88" cy="108" rx="22" ry="13" fill={spot} />
        <ellipse cx="128" cy="124" rx="11" ry="8" fill={spot} />
        <circle cx="162" cy="90" r="22" fill={coat} />
        <ellipse cx="182" cy="98" rx="14" ry="9" fill={coat} />
        <circle cx="194" cy="96" r="4" fill={INK} />
        <ellipse cx="166" cy="86" rx="8" ry="7" fill={spot} />
        <circle cx="167" cy="85" r="2.6" fill={INK} />
        <path d="M 150 72 Q 136 80 142 104 Q 150 100 154 80 Z" fill={spot} />
      </g>
      {/* puppy sitting */}
      <g>
        <path d="M 270 168 Q 254 172 252 160" fill="none" stroke={coat} strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="282" cy="150" rx="22" ry="27" fill={coat} />
        <ellipse cx="274" cy="166" rx="18" ry="11" fill={coat} />
        <ellipse cx="276" cy="140" rx="11" ry="7" fill={spot} />
        <rect x="290" y="146" width="9" height="32" rx="4" fill={coat} />
        <circle cx="294" cy="114" r="17" fill={coat} />
        <ellipse cx="309" cy="120" rx="10" ry="7" fill={coat} />
        <circle cx="318" cy="118" r="3" fill={INK} />
        <ellipse cx="297" cy="110" rx="6.5" ry="5.5" fill={spot} />
        <circle cx="298" cy="109" r="2.2" fill={INK} />
        <path d="M 284 100 Q 272 106 276 124 Q 284 120 287 104 Z" fill={spot} />
      </g>
      {/* hand signal: palm down above the puppy */}
      <g>
        <path d="M 370 44 L 340 52" stroke="#d9a37a" strokeWidth="14" strokeLinecap="round" />
        <path d="M 300 46 Q 300 38 310 38 H 346 Q 354 40 352 50 Q 350 58 342 58 H 310 Q 300 58 300 50 Z" fill="#d9a37a" stroke={INK} strokeWidth="1.5" />
        <path d="M 310 44 H 338 M 308 51 H 338" stroke="#b07c58" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <Arrow x1={316} y1={66} x2={316} y2={90} color={AM} w={3.5} s={8} />
    </>
  )
}

// oxlint-disable-next-line react/only-export-components -- the id map is the registry SceneDiagram dispatches on
export const LIFE_DIAGRAMS: Record<string, Diagram> = {
  'plant-parts': PlantParts,
  'seed-to-plant': SeedToPlant,
  'butterfly-cycle': ButterflyCycle,
  'grasshopper-cycle': GrasshopperCycle,
  'frog-cycle': FrogCycle,
  'food-chain-florida': FoodChainFlorida,
  'food-web-estuary': FoodWebEstuary,
  'beak-shapes': BeakShapes,
  'seasons-florida-north': SeasonsFloridaNorth,
  'environment-change': EnvironmentChange,
  'inherited-learned': InheritedLearned,
}

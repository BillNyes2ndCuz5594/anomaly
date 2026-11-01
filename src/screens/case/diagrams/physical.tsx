// Physical science diagrams (S7 section 4): matter, mixtures, energy, light, circuits, heat, static,
// forces, friction, gravity, magnets and a speed graph.
import { AM, BLUE, CY, GREEN, INK, ORANGE, PALE, PURPLE, SKY, SLATE, STEEL, VERM, YELLOW, blob, head, rnd, type Diagram } from './kit'
import { Arrow, Bulb, Glass, Ground, Vapor } from './parts'

const DEG = Math.PI / 180
const BENCH = '#3a2f2a'

/** A block of ice, a glass of water and a kettle with steam rising. */
export function MatterThreeStates() {
  return (
    <>
      <Ground y={178} fill={BENCH} edge={AM} />
      {/* ice block */}
      <path d="M 44 128 L 60 114 H 112 L 96 128 Z" fill="#e6fbff" />
      <path d="M 96 128 L 112 114 V 164 L 96 178 Z" fill="#8fd8f0" />
      <rect x="44" y="128" width="52" height="50" fill="#bfefff" />
      <path d="M 52 136 L 64 136 M 52 136 L 52 150" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M 44 128 L 60 114 H 112 V 164 L 96 178 H 44 Z M 96 128 V 178 M 96 128 L 112 114" fill="none" stroke={CY} strokeWidth="2" strokeLinejoin="round" />
      {/* glass of water */}
      <Glass cx={200} y0={98} y1={178} w={66} level={120} />
      {/* kettle on a hot ring, steam from the spout */}
      <rect x="282" y="172" width="84" height="6" rx="3" fill={VERM} />
      <path d="M 292 172 Q 284 128 324 122 Q 364 128 356 172 Z" fill={STEEL} stroke={CY} strokeWidth="2.5" />
      <path d="M 300 138 Q 282 132 268 112" stroke={STEEL} strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M 304 124 Q 324 92 346 124" fill="none" stroke="#5c6b7c" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="324" cy="122" rx="12" ry="4" fill="#5c6b7c" />
      <Vapor x={262} y={104} n={3} gap={18} h={62} />
    </>
  )
}

/** A tray of sand, iron filings and pebbles, a magnet above it and a sieve beside it. */
export function MixtureSeparation() {
  const sand = Array.from({ length: 60 }, (_, i) => ({ x: 120 + rnd(i + 1) * 160, y: 156 + rnd(i + 61) * 18 }))
  const filings = Array.from({ length: 22 }, (_, i) => ({ x: 124 + rnd(i + 201) * 150, y: 156 + rnd(i + 301) * 18, a: rnd(i + 401) * 180 }))
  return (
    <>
      <Ground y={182} fill={BENCH} edge={AM} />
      {/* tray */}
      <path d="M 108 148 H 292 L 284 182 H 116 Z" fill="#c9b07a" stroke={CY} strokeWidth="2.5" strokeLinejoin="round" />
      <g fill="#e0c88e">
        {sand.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.6" />
        ))}
      </g>
      <g fill="#8a8f98" stroke={INK} strokeWidth="1">
        {[136, 176, 226, 262].map((x, i) => (
          <path key={x} d={blob(x, 166 + (i % 2) * 4, 9, 6, i + 4, 7)} />
        ))}
      </g>
      <g stroke="#2a2e36" strokeWidth="2.2" strokeLinecap="round">
        {filings.map((p, i) => (
          <line key={i} x1={p.x} y1={p.y} x2={p.x + Math.cos(p.a * DEG) * 5} y2={p.y + Math.sin(p.a * DEG) * 5} />
        ))}
      </g>
      {/* horseshoe magnet with filings leaping up */}
      <path d="M 176 92 V 44 A 24 24 0 0 1 224 44 V 92" fill="none" stroke="#9aa4b0" strokeWidth="18" />
      <rect x="167" y="80" width="18" height="16" fill={VERM} />
      <rect x="215" y="80" width="18" height="16" fill={BLUE} />
      <g stroke="#2a2e36" strokeWidth="2.2" strokeLinecap="round">
        {[
          [178, 108],
          [186, 124],
          [214, 114],
          [222, 130],
          [200, 138],
        ].map(([x, y]) => (
          <line key={x} x1={x} y1={y} x2={x + 2} y2={y - 5} />
        ))}
      </g>
      <Arrow x1={200} y1={146} x2={200} y2={104} color={AM} w={2.5} s={7} />
      {/* sieve: pebbles stay, sand falls through */}
      <path d="M 304 104 H 384 Q 380 140 344 142 Q 308 140 304 104 Z" fill="#cfe9ff" fillOpacity="0.12" stroke={CY} strokeWidth="2.5" />
      <g stroke={CY} strokeOpacity="0.6" strokeWidth="1.2">
        {[316, 330, 344, 358, 372].map((x) => (
          <line key={x} x1={x} y1="106" x2={x} y2={x === 316 || x === 372 ? 128 : 140} />
        ))}
        <path d="M 306 116 H 382 M 310 128 H 378" />
      </g>
      <path d="M 384 104 L 410 92" stroke={STEEL} strokeWidth="6" strokeLinecap="round" />
      <path d={blob(334, 100, 9, 6, 2, 7)} fill="#8a8f98" stroke={INK} strokeWidth="1" />
      <path d={blob(354, 98, 8, 6, 5, 7)} fill="#8a8f98" stroke={INK} strokeWidth="1" />
      <g fill="#e0c88e">
        {Array.from({ length: 12 }, (_, i) => (
          <circle key={i} cx={326 + rnd(i + 500) * 36} cy={148 + rnd(i + 520) * 22} r="1.6" />
        ))}
      </g>
      <path d="M 322 182 Q 344 168 366 182 Z" fill="#e0c88e" />
    </>
  )
}

function Spoon({ x, y, sugar }: { x: number; y: number; sugar: boolean }) {
  return (
    <g>
      <path d={`M ${x + 10} ${y - 2} L ${x + 58} ${y - 34}`} stroke={STEEL} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx={x} cy={y} rx="16" ry="7" fill={STEEL} stroke="#c9d6e3" strokeWidth="1.5" />
      {sugar ? <path d={`M ${x - 12} ${y - 2} Q ${x} ${y - 16} ${x + 12} ${y - 2} Z`} fill="#ffffff" /> : null}
      {sugar ? (
        <g fill="#ffffff">
          {[
            [-4, 14],
            [3, 24],
            [-2, 34],
          ].map(([dx, dy]) => (
            <rect key={dy} x={x + dx} y={y + dy} width="3.5" height="3.5" transform={`rotate(20 ${x + dx} ${y + dy})`} />
          ))}
        </g>
      ) : null}
    </g>
  )
}

/** Two glasses of water, one steaming and one with ice, with a spoonful of sugar over each. */
export function DissolvingTemperature() {
  return (
    <>
      <Ground y={182} fill={BENCH} edge={AM} />
      <Glass cx={110} y0={98} y1={182} w={78} level={120} />
      <Glass cx={290} y0={98} y1={182} w={78} level={120} />
      <Vapor x={92} y={112} n={3} gap={18} h={30} color="#ffd9a0" />
      <g fill="#e6fbff" stroke={CY} strokeWidth="1.5">
        <rect x="270" y="114" width="16" height="14" rx="2" transform="rotate(-12 278 121)" />
        <rect x="292" y="116" width="15" height="13" rx="2" transform="rotate(14 299 122)" />
      </g>
      <Spoon x={104} y={64} sugar />
      <Spoon x={284} y={64} sugar />
    </>
  )
}

/** An ice cube melting on a plate next to a candle burning. */
export function PhysicalChemicalChange() {
  return (
    <>
      <Ground y={180} fill={BENCH} edge={AM} />
      <ellipse cx="110" cy="172" rx="70" ry="12" fill="#dfe8f1" stroke={STEEL} strokeWidth="2" />
      <ellipse cx="114" cy="170" rx="46" ry="6" fill={SKY} opacity="0.85" />
      <path d="M 88 166 Q 86 136 92 132 H 128 Q 136 136 134 166 Q 112 172 88 166 Z" fill="#bfefff" stroke={CY} strokeWidth="2" />
      <path d="M 92 132 L 102 124 H 136 L 128 132 Z" fill="#e6fbff" stroke={CY} strokeWidth="1.5" />
      <path d="M 98 140 V 154" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <path d="M 140 150 q 4 7 0 10 q -4 -3 0 -10 z" fill={SKY} />
      {/* candle */}
      <ellipse cx="290" cy="176" rx="34" ry="7" fill={STEEL} />
      <rect x="276" y="104" width="28" height="70" rx="3" fill="#efe7d6" />
      <path d="M 276 112 q 4 10 0 18 M 300 108 q 4 8 0 14" fill="none" stroke="#d8ccb2" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="290" cy="104" rx="14" ry="4" fill="#d8ccb2" />
      <line x1="290" y1="104" x2="290" y2="96" stroke={INK} strokeWidth="2" />
      <circle cx="290" cy="80" r="36" fill="url(#sd-glow)" />
      <path d="M 290 52 Q 306 76 298 90 Q 290 100 282 90 Q 274 76 290 52 Z" fill={ORANGE} />
      <path d="M 290 66 Q 298 80 294 88 Q 290 93 286 88 Q 282 80 290 66 Z" fill={YELLOW} />
      <path d="M 288 46 q -8 -10 0 -18 q 8 -8 0 -18" fill="none" stroke="#8a95a3" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </>
  )
}

/** Six small icons: a lamp, a flame, a speaker, a plug, a battery and a rolling ball. */
export function EnergyForms() {
  return (
    <>
      {/* lamp (light) */}
      <Bulb x={70} y={60} lit r={16} />
      {/* flame (heat) */}
      <g>
        <path d="M 182 88 L 218 78 M 182 78 L 218 88" stroke="#7a5236" strokeWidth="6" strokeLinecap="round" />
        <path d="M 200 34 Q 222 58 212 76 Q 200 88 188 76 Q 178 58 200 34 Z" fill={VERM} />
        <path d="M 200 52 Q 210 66 206 76 Q 200 82 194 76 Q 190 66 200 52 Z" fill={YELLOW} />
      </g>
      {/* speaker (sound) */}
      <g>
        <rect x="308" y="50" width="14" height="22" fill={STEEL} />
        <path d="M 322 50 L 340 36 V 86 L 322 72 Z" fill={STEEL} stroke={CY} strokeWidth="2" />
        <g fill="none" stroke={CY} strokeWidth="3" strokeLinecap="round">
          <path d="M 350 48 Q 358 61 350 74" />
          <path d="M 360 40 Q 372 61 360 82" />
        </g>
      </g>
      {/* plug (electrical) */}
      <g>
        <path d="M 30 176 Q 46 176 52 160" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path d="M 30 176 Q 46 176 52 160" fill="none" stroke={STEEL} strokeWidth="3" strokeLinecap="round" />
        <rect x="46" y="134" width="30" height="26" rx="5" fill={PALE} stroke={CY} strokeWidth="2" />
        <path d="M 54 134 V 122 M 68 134 V 122" stroke={STEEL} strokeWidth="4" strokeLinecap="round" />
        <path d="M 96 128 L 88 146 H 98 L 90 166" fill="none" stroke={AM} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* battery (stored) */}
      <g>
        <rect x="176" y="136" width="48" height="28" rx="4" fill="#2b2f3a" stroke={CY} strokeWidth="2" />
        <rect x="176" y="136" width="16" height="28" rx="4" fill={ORANGE} />
        <rect x="224" y="144" width="6" height="12" rx="1.5" fill={STEEL} />
        <path d="M 206 150 H 216 M 211 145 V 155" stroke={PALE} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {/* rolling ball (motion) */}
      <g>
        <line x1="290" y1="174" x2="380" y2="174" stroke={CY} strokeOpacity="0.5" strokeWidth="2" />
        <circle cx="350" cy="154" r="20" fill={SKY} stroke={CY} strokeWidth="2" />
        <path d="M 338 146 Q 350 138 362 146" fill="none" stroke={PALE} strokeWidth="3" strokeLinecap="round" />
        <g stroke={AM} strokeWidth="3" strokeLinecap="round">
          <line x1="296" y1="146" x2="320" y2="146" />
          <line x1="290" y1="158" x2="320" y2="158" />
        </g>
      </g>
    </>
  )
}

// light path geometry: ray A to the leaning mirror and back, ray B into the water and bending
const MIRROR = { x0: 345, y0: 60, x1: 375, y1: 150 }

/** A flashlight beam hitting a mirror and bouncing; part of it passes into a glass of water and bends. */
export function LightPath() {
  const a0 = { x: 60, y: 55 }
  const hit = { x: 358.2, y: 99.7 }
  const out = { x: 323, y: 135 }
  const b0 = { x: 60, y: 62 }
  const enter = { x: 217.5, y: 125 }
  const bend = { x: 258, y: 177 }
  return (
    <>
      <Ground y={182} fill={BENCH} edge={AM} />
      {/* flashlight */}
      <g transform="translate(60 58) rotate(14)">
        <rect x="-52" y="-8" width="38" height="16" rx="4" fill="#4a5568" stroke={CY} strokeWidth="1.5" />
        <path d="M -14 -8 L 0 -13 V 13 L -14 8 Z" fill="#6b7a90" stroke={CY} strokeWidth="1.5" />
        <line x1="0" y1="-12" x2="0" y2="12" stroke={YELLOW} strokeWidth="3" />
      </g>
      {/* mirror on a stand */}
      <line x1={MIRROR.x1 + 2} y1={MIRROR.y1} x2={MIRROR.x1 + 6} y2={182} stroke={STEEL} strokeWidth="4" />
      <path d={`M ${MIRROR.x1 - 10} 182 H ${MIRROR.x1 + 22}`} stroke={STEEL} strokeWidth="5" strokeLinecap="round" />
      <line x1={MIRROR.x0 + 5} y1={MIRROR.y0 - 1} x2={MIRROR.x1 + 5} y2={MIRROR.y1 - 1} stroke="#4a5568" strokeWidth="6" strokeLinecap="round" />
      <line x1={MIRROR.x0} y1={MIRROR.y0} x2={MIRROR.x1} y2={MIRROR.y1} stroke="#e6f1ff" strokeWidth="5" strokeLinecap="round" />
      {/* glass of water and the normal at the surface */}
      <Glass cx={225} y0={110} y1={182} w={132} level={125} />
      <line x1={enter.x} y1={104} x2={enter.x} y2={160} stroke={PALE} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 4" />
      {/* rays */}
      <g fill="none" stroke={YELLOW} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M ${a0.x} ${a0.y} L ${hit.x} ${hit.y} L ${out.x} ${out.y}`} />
        <path d={`M ${b0.x} ${b0.y} L ${enter.x} ${enter.y} L ${bend.x} ${bend.y}`} />
        <path d={head(210, a0.y + 0.15 * 150, Math.atan2(0.15, 1), 9)} />
        <path d={head(out.x, out.y, Math.atan2(out.y - hit.y, out.x - hit.x), 9)} />
        <path d={head(150, b0.y + 0.4 * 90, Math.atan2(0.4, 1), 9)} />
        <path d={head(bend.x, bend.y, Math.atan2(bend.y - enter.y, bend.x - enter.x), 9)} />
      </g>
    </>
  )
}

/** A wire loop with a battery at the bottom and a bulb at the top, centred on cx. The left side has a gap from y 94 to 140 for a switch or a spoon. */
function Loop({ cx, lit, flow }: { cx: number; lit: boolean; flow: boolean }) {
  return (
    <g>
      <g fill="none" stroke={CY} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M ${cx + 24} 172 H ${cx + 70} V 64 H ${cx + 8}`} />
        <path d={`M ${cx - 8} 64 H ${cx - 70} V 94`} />
        <path d={`M ${cx - 70} 140 V 172 H ${cx - 24}`} />
      </g>
      {flow ? (
        <g fill="none" stroke={AM} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d={head(cx + 70, 112, -Math.PI / 2, 8)} />
          <path d={head(cx - 36, 64, Math.PI, 8)} />
          <path d={head(cx + 46, 172, 0, 8)} />
        </g>
      ) : null}
      <Bulb x={cx} y={42} lit={lit} r={15} />
      <rect x={cx - 24} y="162" width="48" height="20" rx="4" fill="#2b2f3a" stroke={CY} strokeWidth="2" />
      <rect x={cx + 8} y="162" width="16" height="20" rx="4" fill={ORANGE} />
      <rect x={cx + 24} y="167" width="5" height="10" rx="1.5" fill={STEEL} />
    </g>
  )
}

/** Two circuits: the left switch open (bulb dark), the right switch closed (bulb lit). */
export function CircuitOpenClosed() {
  const sw = (cx: number, closed: boolean) => (
    <g>
      <line x1={cx - 70} y1={94} x2={cx - 70} y2={102} stroke={CY} strokeWidth="4" strokeLinecap="round" />
      <line x1={cx - 70} y1={132} x2={cx - 70} y2={140} stroke={CY} strokeWidth="4" strokeLinecap="round" />
      <line x1={cx - 70} y1={132} x2={closed ? cx - 70 : cx - 96} y2={closed ? 102 : 110} stroke={AM} strokeWidth="5" strokeLinecap="round" />
      <circle cx={cx - 70} cy={102} r="4.5" fill={PALE} />
      <circle cx={cx - 70} cy={132} r="4.5" fill={PALE} />
    </g>
  )
  return (
    <>
      <Loop cx={100} lit={false} flow={false} />
      {sw(100, false)}
      <Loop cx={300} lit flow />
      {sw(300, true)}
    </>
  )
}

/** The same circuit twice: a metal spoon bridges the gap (bulb lit), a plastic spoon does not (bulb dark). */
export function ConductorInsulator() {
  const spoon = (cx: number, metal: boolean) => (
    <g>
      <circle cx={cx - 70} cy={98} r="5" fill={PALE} />
      <circle cx={cx - 70} cy={136} r="5" fill={PALE} />
      <path d={`M ${cx - 70} 90 V 128`} stroke={metal ? '#d6e0ea' : PURPLE} strokeWidth="7" strokeLinecap="round" />
      <ellipse cx={cx - 70} cy={138} rx="9" ry="14" fill={metal ? '#d6e0ea' : PURPLE} stroke={metal ? '#ffffff' : '#e7b3cf'} strokeWidth="1.5" />
      {metal ? <path d={`M ${cx - 73} 96 V 120`} stroke="#ffffff" strokeWidth="2" strokeLinecap="round" /> : null}
    </g>
  )
  return (
    <>
      <Loop cx={100} lit flow />
      {spoon(100, true)}
      <Loop cx={300} lit={false} flow={false} />
      {spoon(300, false)}
    </>
  )
}

/** A mug of hot cocoa with a metal spoon; heat arrows run up the spoon to a hand. */
export function HeatFlow() {
  // the spoon runs from inside the mug up to the hand
  const s0 = { x: 160, y: 118 }
  const s1 = { x: 300, y: 50 }
  const a = Math.atan2(s1.y - s0.y, s1.x - s0.x)
  const nx = Math.sin(a)
  const ny = -Math.cos(a)
  return (
    <>
      <Ground y={184} fill={BENCH} edge={AM} />
      <path d="M 92 118 a 26 26 0 0 0 0 46" fill="none" stroke={BLUE} strokeWidth="9" strokeLinecap="round" />
      <line x1={s0.x} y1={s0.y} x2={s1.x} y2={s1.y} stroke={STEEL} strokeWidth="7" strokeLinecap="round" />
      <path d="M 96 104 H 194 V 168 Q 194 184 178 184 H 112 Q 96 184 96 168 Z" fill={BLUE} stroke={CY} strokeWidth="2.5" />
      <ellipse cx="145" cy="106" rx="47" ry="8" fill="#6b3f22" stroke="#8a5a3a" strokeWidth="2" />
      <Vapor x={118} y={98} n={3} gap={22} h={40} color="#ffd9a0" />
      {/* heat arrows along the spoon */}
      {[0.12, 0.42, 0.72].map((t) => {
        const x = s0.x + (s1.x - s0.x) * t + nx * 16
        const y = s0.y + (s1.y - s0.y) * t + ny * 16
        return <Arrow key={t} x1={x} y1={y} x2={x + Math.cos(a) * 30} y2={y + Math.sin(a) * 30} color={VERM} w={4} s={9} />
      })}
      {/* hand gripping the spoon end */}
      <g>
        <rect x="292" y="30" width="46" height="40" rx="16" fill="#d9a37a" stroke={INK} strokeWidth="1.5" />
        <path d="M 300 40 H 326 M 300 50 H 328 M 300 60 H 326" stroke="#b07c58" strokeWidth="2" strokeLinecap="round" />
        <path d="M 296 62 Q 282 60 288 46 Q 300 44 304 52" fill="#d9a37a" stroke={INK} strokeWidth="1.5" />
        <path d="M 336 40 Q 360 46 372 70" fill="none" stroke="#d9a37a" strokeWidth="18" strokeLinecap="round" />
      </g>
    </>
  )
}

function Charge({ x, y, plus }: { x: number; y: number; plus: boolean }) {
  return (
    <g stroke={plus ? AM : SKY} strokeWidth="2.6" strokeLinecap="round">
      <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
      {plus ? <line x1={x} y1={y - 5} x2={x} y2={y + 5} /> : null}
    </g>
  )
}

/** A balloon rubbed on hair, then the balloon stuck to a wall, with plus and minus marks. */
export function StaticBalloon() {
  const balloon = (x: number, y: number) => (
    <g>
      <path d={`M ${x} ${y + 36} q -6 18 4 34`} fill="none" stroke={PALE} strokeWidth="1.5" />
      <ellipse cx={x} cy={y} rx="28" ry="34" fill={PURPLE} stroke="#e7b3cf" strokeWidth="2" />
      <path d={`M ${x - 4} ${y + 33} l 4 6 l 4 -6 z`} fill={PURPLE} />
      <path d={`M ${x - 14} ${y - 18} q 6 -8 14 -8`} fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
    </g>
  )
  return (
    <>
      <Ground y={186} />
      {/* head with hair lifting toward the balloon */}
      <circle cx="72" cy="128" r="32" fill="#c99b7a" />
      <path d="M 50 172 Q 72 160 94 172 V 190 H 50 Z" fill={SLATE} />
      <rect x="62" y="156" width="20" height="18" fill="#c99b7a" />
      <g fill="none" stroke="#6b4a2e" strokeWidth="4" strokeLinecap="round">
        {[-24, -14, -4, 6, 16].map((o, i) => (
          <path key={o} d={`M ${72 + o} ${104 + Math.abs(o) * 0.3} Q ${80 + o + i * 4} ${84 - i * 2} ${100 + i * 5} ${74 - i * 3}`} />
        ))}
      </g>
      {balloon(140, 62)}
      {[
        [130, 52],
        [146, 70],
        [128, 78],
      ].map(([x, y]) => (
        <Charge key={`${x}-${y}`} x={x} y={y} plus={false} />
      ))}
      {[
        [58, 104],
        [80, 98],
        [96, 112],
      ].map(([x, y]) => (
        <Charge key={`${x}-${y}`} x={x} y={y} plus />
      ))}
      <Arrow x1={182} y1={80} x2={276} y2={92} color={CY} w={3} dash="7 6" />
      {/* the wall, balloon stuck to it */}
      <rect x="356" y="-800" width="900" height="1800" fill="#3b4d63" />
      <line x1="356" y1="-800" x2="356" y2="1000" stroke={CY} strokeWidth="2.5" />
      {balloon(326, 98)}
      {[
        [340, 84],
        [344, 104],
        [338, 122],
      ].map(([x, y]) => (
        <Charge key={`${x}-${y}`} x={x} y={y} plus={false} />
      ))}
      {[
        [368, 80],
        [370, 100],
        [368, 120],
      ].map(([x, y]) => (
        <Charge key={`${x}-${y}`} x={x} y={y} plus />
      ))}
    </>
  )
}

// ramp from bottom left to top right; the box sits halfway up
const RAMP = { x0: 30, y0: 190, x1: 370, y1: 66 }

/** A box on a ramp: a push arrow up the slope, a gravity arrow straight down, a rough patch marked. */
export function ForcesRamp() {
  const ang = Math.atan2(RAMP.y1 - RAMP.y0, RAMP.x1 - RAMP.x0)
  const ux = Math.cos(ang)
  const uy = Math.sin(ang)
  const at = (t: number) => ({ x: RAMP.x0 + (RAMP.x1 - RAMP.x0) * t, y: RAMP.y0 + (RAMP.y1 - RAMP.y0) * t })
  const box = at(0.5)
  // box centre: 17 units off the surface along the outward normal (uy, -ux)
  const c = { x: box.x + uy * 17, y: box.y - ux * 17 }
  const r0 = at(0.64)
  const r1 = at(0.84)
  // a saw-tooth line along the surface: every other point lifted 6 units outward
  const teeth = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8
    const o = i % 2 ? 6 : 0
    return `${(r0.x + (r1.x - r0.x) * t + uy * o).toFixed(1)} ${(r0.y + (r1.y - r0.y) * t - ux * o).toFixed(1)}`
  })
  return (
    <>
      <Ground y={190} />
      <path d={`M ${RAMP.x0} ${RAMP.y0} L ${RAMP.x1} ${RAMP.y1} V ${RAMP.y0} Z`} fill="#3b5675" />
      <line x1={RAMP.x0} y1={RAMP.y0} x2={RAMP.x1} y2={RAMP.y1} stroke={CY} strokeWidth="3" />
      {/* rough patch */}
      <path d={`M ${teeth.join(' L ')}`} fill="none" stroke={ORANGE} strokeWidth="3" strokeLinejoin="round" />
      <Arrow x1={r1.x - uy * 13} y1={r1.y + ux * 13} x2={r0.x - uy * 13} y2={r0.y + ux * 13} color={VERM} w={4} />
      {/* the box */}
      <g transform={`translate(${box.x} ${box.y}) rotate(${(ang * 180) / Math.PI})`}>
        <rect x="-24" y="-36" width="48" height="36" rx="3" fill={ORANGE} stroke="#fff2c2" strokeWidth="2" />
        <path d="M -24 -18 H 24 M 0 -36 V 0" stroke="#b97c00" strokeWidth="2" />
      </g>
      <Arrow x1={c.x - ux * 96} y1={c.y - uy * 96} x2={c.x - ux * 34} y2={c.y - uy * 34} color={GREEN} w={5} s={11} />
      <Arrow x1={c.x} y1={c.y} x2={c.x} y2={c.y + 62} color={BLUE} w={5} s={11} />
      <circle cx={c.x} cy={c.y} r="4" fill={PALE} />
    </>
  )
}

function Car({ x, y, ghost }: { x: number; y: number; ghost?: boolean }) {
  return (
    <g opacity={ghost ? 0.35 : 1} strokeDasharray={ghost ? '4 3' : undefined}>
      <path d={`M ${x - 24} ${y - 6} V ${y - 16} Q ${x - 24} ${y - 20} ${x - 18} ${y - 20} H ${x - 10} L ${x - 4} ${y - 30} H ${x + 12} L ${x + 18} ${y - 20} H ${x + 22} Q ${x + 26} ${y - 20} ${x + 26} ${y - 14} V ${y - 6} Z`} fill={ghost ? 'none' : SKY} stroke={CY} strokeWidth="2" />
      <circle cx={x - 12} cy={y - 5} r="6" fill={INK} stroke={STEEL} strokeWidth="2" />
      <circle cx={x + 14} cy={y - 5} r="6" fill={INK} stroke={STEEL} strokeWidth="2" />
    </g>
  )
}

/** The same toy car on a smooth tile track and on a carpet track; it travels less far on the carpet. */
export function FrictionSurfaces() {
  return (
    <>
      {/* smooth tile track */}
      <rect x="-800" y="62" width="2000" height="30" fill="#cfe0ee" />
      <g stroke="#9fb3c8" strokeWidth="1.5">
        {Array.from({ length: 22 }, (_, i) => (
          <line key={i} x1={-40 + i * 26} y1="62" x2={-40 + i * 26} y2="92" />
        ))}
      </g>
      {/* carpet track */}
      <rect x="-800" y="152" width="2000" height="30" fill="#7a4f6e" />
      <g stroke="#a06f92" strokeWidth="2" strokeLinecap="round">
        {Array.from({ length: 90 }, (_, i) => {
          const x = -40 + i * 5.4
          const y = 156 + rnd(i + 7) * 22
          return <line key={i} x1={x} y1={y} x2={x + 1.5} y2={y - 4} />
        })}
      </g>
      <g stroke={PALE} strokeWidth="2.5" strokeDasharray="5 4">
        <line x1="40" y1="56" x2="40" y2="98" />
        <line x1="40" y1="146" x2="40" y2="188" />
      </g>
      <Car x={64} y={62} ghost />
      <Car x={64} y={152} ghost />
      <Car x={328} y={62} />
      <Car x={150} y={152} />
      <Arrow x1={92} y1={24} x2={300} y2={24} color={AM} w={4} />
      <Arrow x1={92} y1={114} x2={124} y2={114} color={AM} w={4} />
    </>
  )
}

/** An apple falling from a tree with a downward arrow, and a ball thrown up arcing back down. */
export function FallingApple() {
  const p0 = { x: 230, y: 188 }
  const c = { x: 300, y: -96 }
  const p2 = { x: 370, y: 188 }
  const q = (t: number) => ({ x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x, y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t * t * p2.y })
  const dir = (t: number) => Math.atan2(2 * (1 - t) * (c.y - p0.y) + 2 * t * (p2.y - c.y), 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p2.x - c.x))
  const up = q(0.22)
  const down = q(0.86)
  return (
    <>
      <Ground y={190} fill="#24402f" edge={GREEN} />
      <path d="M 70 190 V 96 M 70 120 L 100 92" stroke="#6b4a2e" strokeWidth="11" strokeLinecap="round" />
      <circle cx="70" cy="64" r="44" fill="#2f8f55" />
      <circle cx="104" cy="78" r="28" fill="#3aa864" />
      <circle cx="40" cy="82" r="26" fill="#3aa864" />
      <path d="M 140 70 V 92" stroke={PALE} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 5" />
      <circle cx="140" cy="106" r="10" fill={VERM} />
      <path d="M 140 96 q 6 -6 10 -4" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />
      <Arrow x1={140} y1={124} x2={140} y2={178} color={BLUE} w={5} s={11} />
      {/* thrown ball */}
      <path d={`M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`} fill="none" stroke={AM} strokeWidth="3" strokeDasharray="7 6" />
      <path d={head(up.x, up.y, dir(0.22), 10)} fill="none" stroke={AM} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={head(down.x, down.y, dir(0.86), 10)} fill="none" stroke={AM} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="300" cy="46" r="10" fill={ORANGE} stroke="#fff2c2" strokeWidth="1.5" />
      <Arrow x1={300} y1={62} x2={300} y2={94} color={BLUE} w={4} s={9} />
    </>
  )
}

function BarMagnet({ x, y, nFirst }: { x: number; y: number; nFirst: boolean }) {
  // a bar 120 long; N half vermillion with a pointer mark, S half blue
  const half = (x0: number, n: boolean) => (
    <g key={x0}>
      <rect x={x0} y={y - 16} width="60" height="32" fill={n ? VERM : BLUE} />
      {n ? <path d={`M ${x0 + 18} ${y - 8} L ${x0 + 42} ${y} L ${x0 + 18} ${y + 8} Z`} fill="#ffffff" opacity="0.85" /> : null}
    </g>
  )
  return (
    <g>
      {half(x, nFirst)}
      {half(x + 60, !nFirst)}
      <rect x={x} y={y - 16} width="120" height="32" rx="3" fill="none" stroke={PALE} strokeWidth="2" />
    </g>
  )
}

/** Two bar magnets N to S pulling together, and two N to N pushing apart. */
export function MagnetPoles() {
  return (
    <>
      <BarMagnet x={24} y={74} nFirst={false} />
      <BarMagnet x={256} y={74} nFirst={false} />
      <Arrow x1={152} y1={74} x2={192} y2={74} color={AM} w={4} />
      <Arrow x1={248} y1={74} x2={208} y2={74} color={AM} w={4} />
      <BarMagnet x={24} y={152} nFirst={false} />
      <BarMagnet x={256} y={152} nFirst />
      <Arrow x1={192} y1={152} x2={152} y2={152} color={AM} w={4} />
      <Arrow x1={208} y1={152} x2={248} y2={152} color={AM} w={4} />
    </>
  )
}

/** A distance versus time graph with a steep line (fast) and a shallow line (slow). */
export function SpeedGraph() {
  return (
    <>
      <rect x="60" y="26" width="316" height="158" fill="#16294a" opacity="0.6" />
      <g stroke={CY} strokeOpacity="0.2" strokeWidth="1.2">
        {[144, 104, 64].map((y) => (
          <line key={y} x1="60" y1={y} x2="376" y2={y} />
        ))}
        {[140, 220, 300].map((x) => (
          <line key={x} x1={x} y1="26" x2={x} y2="184" />
        ))}
      </g>
      <line x1="60" y1="184" x2="196" y2="36" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" />
      <line x1="60" y1="184" x2="362" y2="118" stroke={SKY} strokeWidth="5" strokeLinecap="round" strokeDasharray="12 7" />
      <circle cx="196" cy="36" r="6" fill={ORANGE} />
      <rect x="356" y="112" width="12" height="12" fill={SKY} />
      <path d="M 60 20 V 184 H 382" fill="none" stroke={CY} strokeWidth="3.5" strokeLinecap="round" />
      <path d={head(382, 184, 0, 9)} fill="none" stroke={CY} strokeWidth="3.5" strokeLinecap="round" />
      <path d={head(60, 20, -Math.PI / 2, 9)} fill="none" stroke={CY} strokeWidth="3.5" strokeLinecap="round" />
    </>
  )
}

// oxlint-disable-next-line react/only-export-components -- the id map is the registry SceneDiagram dispatches on
export const PHYSICAL_DIAGRAMS: Record<string, Diagram> = {
  'matter-three-states': MatterThreeStates,
  'mixture-separation': MixtureSeparation,
  'dissolving-temperature': DissolvingTemperature,
  'physical-chemical-change': PhysicalChemicalChange,
  'energy-forms': EnergyForms,
  'light-path': LightPath,
  'circuit-open-closed': CircuitOpenClosed,
  'conductor-insulator': ConductorInsulator,
  'heat-flow': HeatFlow,
  'static-balloon': StaticBalloon,
  'forces-ramp': ForcesRamp,
  'friction-surfaces': FrictionSurfaces,
  'falling-apple': FallingApple,
  'magnet-poles': MagnetPoles,
  'speed-graph': SpeedGraph,
}

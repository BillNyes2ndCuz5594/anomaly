// Space diagrams (S7 section 4): galaxy, star brightness, day and night, the Moon's month, Sun Earth Moon.
// The svg shell adds the star field behind these ids.
import { AM, CY, GREEN, BLUE, INK, PALE, rnd, type Diagram } from './kit'
import { ArcArrow, Arrow } from './parts'

const DEG = Math.PI / 180

// Galaxy disc: two log spiral arms, tilted to 0.42 and turned -12 degrees.
const GAL = { cx: 200, cy: 108, tilt: 0.42, rot: -12 * DEG, phase: -1.15 }
function galaxyPoint(theta: number, arm: number, jitter = 0): [number, number] {
  const r = 12 * Math.exp(0.25 * theta) + jitter
  const a = theta + GAL.phase + arm * Math.PI
  const x = Math.cos(a) * r
  const y = Math.sin(a) * r * GAL.tilt
  return [GAL.cx + x * Math.cos(GAL.rot) - y * Math.sin(GAL.rot), GAL.cy + x * Math.sin(GAL.rot) + y * Math.cos(GAL.rot)]
}
/** Where the Sun sits: about 60% of the way out along the first arm. */
const SUN_THETA = 8.48

/** A spiral galaxy seen at an angle, with a small amber arrow marking the Sun's place. */
export function GalaxySpiral() {
  const arm = (k: number) => {
    const pts = Array.from({ length: 80 }, (_, i) => galaxyPoint(1.2 + (i / 79) * 9.6, k))
    return `M ${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')}`
  }
  const dots = Array.from({ length: 140 }, (_, i) => {
    const t = 1.6 + rnd(i + 3) * 9
    const [x, y] = galaxyPoint(t, i % 2, (rnd(i + 70) - 0.5) * 18)
    return { x, y, r: 0.8 + rnd(i + 140) * 1.6 }
  })
  const [sx, sy] = galaxyPoint(SUN_THETA, 0)
  return (
    <>
      <ellipse cx={GAL.cx} cy={GAL.cy} rx="178" ry="78" transform={`rotate(-12 ${GAL.cx} ${GAL.cy})`} fill="#3ee6ff" opacity="0.05" />
      {[0, 1].map((k) => (
        <g key={k} fill="none" strokeLinecap="round">
          <path d={arm(k)} stroke="#9fdcff" strokeWidth="18" opacity="0.1" />
          <path d={arm(k)} stroke="#bfe8ff" strokeWidth="8" opacity="0.25" />
          <path d={arm(k)} stroke={PALE} strokeWidth="2.5" opacity="0.7" />
        </g>
      ))}
      <g fill="#e6f6ff">
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={0.5 + rnd(i + 9) * 0.5} />
        ))}
      </g>
      <ellipse cx={GAL.cx} cy={GAL.cy} rx="58" ry="30" fill="url(#sd-glow)" transform={`rotate(-12 ${GAL.cx} ${GAL.cy})`} />
      <ellipse cx={GAL.cx} cy={GAL.cy} rx="24" ry="11" fill="#fff2c2" transform={`rotate(-12 ${GAL.cx} ${GAL.cy})`} />
      {/* the Sun's place */}
      <circle cx={sx} cy={sy} r="8" fill="none" stroke={AM} strokeWidth="2.5" />
      <circle cx={sx} cy={sy} r="3.2" fill={AM} />
      <Arrow x1={sx + 52} y1={sy + 40} x2={sx + 10} y2={sy + 8} color={AM} w={3.5} />
    </>
  )
}

function StarCore({ x, y, r, bright }: { x: number; y: number; r: number; bright: boolean }) {
  return (
    <g opacity={bright ? 1 : 0.42}>
      <circle cx={x} cy={y} r={bright ? r * 5.2 : r * 1.9} fill="url(#sd-glow)" />
      <g stroke="#fff2c2" strokeWidth={bright ? 3 : 1.6} strokeLinecap="round">
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1={x - Math.cos(a * DEG) * r * (a % 90 ? 1.7 : 2.5)} y1={y - Math.sin(a * DEG) * r * (a % 90 ? 1.7 : 2.5)} x2={x + Math.cos(a * DEG) * r * (a % 90 ? 1.7 : 2.5)} y2={y + Math.sin(a * DEG) * r * (a % 90 ? 1.7 : 2.5)} />
        ))}
      </g>
      <circle cx={x} cy={y} r={r} fill="url(#sd-sun)" />
    </g>
  )
}

/** A small Earth with blue ocean and green land, shaded from the left. */
function Earth({ x, y, r }: { x: number; y: number; r: number }) {
  const id = `se-${x}-${y}`
  return (
    <g>
      <clipPath id={id}>
        <circle cx={x} cy={y} r={r} />
      </clipPath>
      <circle cx={x} cy={y} r={r} fill={BLUE} />
      <g clipPath={`url(#${id})`} fill={GREEN}>
        <ellipse cx={x - r * 0.35} cy={y - r * 0.3} rx={r * 0.45} ry={r * 0.32} />
        <ellipse cx={x + r * 0.4} cy={y + r * 0.35} rx={r * 0.35} ry={r * 0.45} />
      </g>
      <circle cx={x} cy={y} r={r} fill="url(#sd-shade)" />
    </g>
  )
}

/** Two stars drawn the same size: the near one bright, the far one faint, and a small Earth. */
export function StarBrightnessDistance() {
  return (
    <>
      <g stroke={CY} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="4 7" fill="none">
        <line x1="54" y1="160" x2="140" y2="100" />
        <line x1="56" y1="164" x2="334" y2="58" />
      </g>
      <StarCore x={150} y={92} r={11} bright />
      <StarCore x={346} y={52} r={11} bright={false} />
      <Earth x={44} y={168} r={13} />
    </>
  )
}

/** Earth with a lit half toward the Sun on the left and a dark half, and a rotation arrow. */
export function EarthDayNight() {
  const ex = 258
  const ey = 110
  const r = 72
  return (
    <>
      <circle cx="16" cy={ey} r="96" fill="url(#sd-glow)" />
      <circle cx="16" cy={ey} r="36" fill="url(#sd-sun)" />
      <g opacity="0.85">
        {[72, 110, 148].map((y) => (
          <Arrow key={y} x1={76} y1={y} x2={150} y2={y} color={AM} w={2.5} s={8} />
        ))}
      </g>
      <clipPath id="sd-dn">
        <circle cx={ex} cy={ey} r={r} />
      </clipPath>
      <circle cx={ex} cy={ey} r={r} fill={BLUE} />
      <g clipPath="url(#sd-dn)">
        <path d={`M ${ex - 50} ${ey - 52} q 30 -14 52 6 q 10 24 -12 38 q -24 4 -30 26 q -22 -10 -18 -40 z`} fill={GREEN} />
        <path d={`M ${ex + 14} ${ey + 14} q 26 -4 34 18 q -6 26 -30 30 q -16 -20 -4 -48 z`} fill={GREEN} />
        <path d={`M ${ex + 30} ${ey - 60} q 30 6 40 34 q -26 10 -44 -6 z`} fill={GREEN} />
        <rect x={ex} y={ey - r - 2} width={r + 4} height={r * 2 + 4} fill={INK} opacity="0.82" />
      </g>
      <circle cx={ex} cy={ey} r={r} fill="none" stroke={CY} strokeOpacity="0.5" strokeWidth="2" />
      <line x1={ex} y1={ey - r - 14} x2={ex} y2={ey + r + 14} stroke={PALE} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="5 5" />
      <ArcArrow cx={ex} cy={ey + 8} rx={r + 20} ry={22} a0={Math.PI - 0.3} a1={0.3} color={AM} w={4} s={11} />
    </>
  )
}

/** The lit part of a Moon of radius r at (x, y): lit fraction f, lit on the right when waxing. */
function moonLit(x: number, y: number, r: number, f: number, right: boolean): string {
  const k = Math.abs(1 - 2 * f) * r
  const outer = right ? 1 : 0
  const inner = (f < 0.5) === right ? 0 : 1
  return `M ${x} ${y - r} A ${r} ${r} 0 0 ${outer} ${x} ${y + r} A ${k.toFixed(2)} ${r} 0 0 ${inner} ${x} ${y - r} Z`
}

const MOON_XS = Array.from({ length: 8 }, (_, i) => 34 + i * 47.4)
const PHASES = [0, 0.25, 0.5, 0.78, 1, 0.78, 0.5, 0.25]

/** Eight Moon shapes in a row, new to full and back, over a timeline arrow. */
export function MoonMonth() {
  const r = 18
  const y = 108
  return (
    <>
      <Arrow x1={14} y1={148} x2={388} y2={148} color={CY} w={2.5} />
      {MOON_XS.map((x, i) => {
        const f = PHASES[i]
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="#1b2c4a" stroke={CY} strokeOpacity="0.55" strokeWidth="1.8" />
            {f >= 1 ? <circle cx={x} cy={y} r={r} fill="#eef4fb" /> : f > 0 ? <path d={moonLit(x, y, r, f, i < 4)} fill="#eef4fb" /> : null}
            <line x1={x} y1={140} x2={x} y2={148} stroke={CY} strokeOpacity="0.6" strokeWidth="2" />
          </g>
        )
      })}
    </>
  )
}

/** The Sun, Earth on its orbit, and the Moon on its smaller orbit around Earth, with direction arrows. */
export function SunEarthMoon() {
  const sun = { x: 64, y: 110 }
  const orbit = { rx: 226, ry: 80 }
  const ea = 25 * DEG
  const e = { x: sun.x + Math.cos(ea) * orbit.rx, y: sun.y + Math.sin(ea) * orbit.ry }
  const mo = { rx: 36, ry: 15 }
  const ma = -60 * DEG
  const m = { x: e.x + Math.cos(ma) * mo.rx, y: e.y + Math.sin(ma) * mo.ry }
  return (
    <>
      <ellipse cx={sun.x} cy={sun.y} rx={orbit.rx} ry={orbit.ry} fill="none" stroke={CY} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="6 6" />
      <ArcArrow cx={sun.x} cy={sun.y} rx={orbit.rx} ry={orbit.ry} a0={78 * DEG} a1={44 * DEG} color={CY} w={3} />
      <ArcArrow cx={sun.x} cy={sun.y} rx={orbit.rx} ry={orbit.ry} a0={292 * DEG} a1={258 * DEG} color={CY} w={3} />
      <circle cx={sun.x} cy={sun.y} r="80" fill="url(#sd-glow)" />
      <circle cx={sun.x} cy={sun.y} r="34" fill="url(#sd-sun)" />
      <ellipse cx={e.x} cy={e.y} rx={mo.rx} ry={mo.ry} fill="none" stroke={PALE} strokeOpacity="0.6" strokeWidth="1.8" strokeDasharray="4 4" />
      <ArcArrow cx={e.x} cy={e.y} rx={mo.rx} ry={mo.ry} a0={150 * DEG} a1={100 * DEG} color={AM} w={2.5} s={7} />
      <Earth x={e.x} y={e.y} r={13} />
      <circle cx={m.x} cy={m.y} r="6" fill="#d7dee8" />
      <circle cx={m.x} cy={m.y} r="6" fill="url(#sd-shade)" />
    </>
  )
}

// oxlint-disable-next-line react/only-export-components -- the id map is the registry SceneDiagram dispatches on
export const SPACE_DIAGRAMS: Record<string, Diagram> = {
  'galaxy-spiral': GalaxySpiral,
  'star-brightness-distance': StarBrightnessDistance,
  'earth-day-night': EarthDayNight,
  'moon-month': MoonMonth,
  'sun-earth-moon': SunEarthMoon,
}

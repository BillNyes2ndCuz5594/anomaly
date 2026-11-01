// Small shared pieces for the scene diagrams. Components only (helpers and colours live in kit.ts).
// Everything draws in the 400x220 art space; ground and water reach far past it so a wider or
// taller viewBox (the panel aspect) never shows a hard edge.
import { AM, CY, INK, PALE, SLATE, VERM, arcPath, arcTangent, head } from './kit'

/** Cartoon Sun with rays in a warm glow (the shell's sd-glow and sd-sun gradients). */
export function Sun({ x, y, r = 18 }: { x: number; y: number; r?: number }) {
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

/** Wavy rising lines with an arrowhead on top. `h` is the rise in px. */
export function Vapor({ x, y, n = 3, gap = 26, h = 70, color = '#d4f4ff' }: { x: number; y: number; n?: number; gap?: number; h?: number; color?: string }) {
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

export function Cloud({ x, y, s = 1, fill = '#dff1ff', shade = '#9fc3e6' }: { x: number; y: number; s?: number; fill?: string; shade?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g fill={fill}>
        <ellipse cx="0" cy="8" rx="48" ry="16" />
        <circle cx="-20" cy="-2" r="18" />
        <circle cx="8" cy="-11" r="23" />
        <circle cx="32" cy="2" r="16" />
      </g>
      <ellipse cx="2" cy="16" rx="42" ry="7" fill={shade} opacity="0.55" />
    </g>
  )
}

const STARS = Array.from({ length: 70 }, (_, i) => {
  const a = Math.sin(i * 57.3) * 4375.85
  const b = Math.sin(i * 21.7) * 9137.31
  return { x: (a - Math.floor(a)) * 640 - 120, y: (b - Math.floor(b)) * 360 - 70, r: 0.5 + ((i * 7) % 5) * 0.18 }
})

/** The faint star field behind the space scenes. */
export function Stars() {
  return (
    <g fill="#cfe9ff">
      {STARS.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} opacity="0.55" />
      ))}
    </g>
  )
}

/** A straight arrow from (x1, y1) to (x2, y2) with an open head at the end. */
export function Arrow({ x1, y1, x2, y2, color = CY, w = 3, s = 9, dash, both }: { x1: number; y1: number; x2: number; y2: number; color?: string; w?: number; s?: number; dash?: string; both?: boolean }) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  return (
    <g fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dash} />
      <path d={head(x2, y2, a, s)} />
      {both ? <path d={head(x1, y1, a + Math.PI, s)} /> : null}
    </g>
  )
}

/** A curved arrow along an ellipse from angle a0 to a1, head at a1. Used for the life cycle rings. */
export function ArcArrow({ cx, cy, rx, ry, a0, a1, color = CY, w = 3, s = 10 }: { cx: number; cy: number; rx: number; ry: number; a0: number; a1: number; color?: string; w?: number; s?: number }) {
  const ex = cx + Math.cos(a1) * rx
  const ey = cy + Math.sin(a1) * ry
  return (
    <g fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      <path d={arcPath(cx, cy, rx, ry, a0, a1)} />
      <path d={head(ex, ey, arcTangent(rx, ry, a1, a1 > a0), s)} />
    </g>
  )
}

/** Flat ground from y down, far wider than the art so any panel aspect stays covered. */
export function Ground({ y, fill = SLATE, edge = CY }: { y: number; fill?: string; edge?: string }) {
  return (
    <g>
      <rect x={-800} y={y} width={2000} height={900} fill={fill} />
      <line x1={-800} y1={y} x2={1200} y2={y} stroke={edge} strokeOpacity="0.45" strokeWidth="1.5" />
    </g>
  )
}

/** A clear drinking glass from rim y0 to base y1, with water up to `level` (null for empty). */
export function Glass({ cx, y0, y1, w, level, water = '#56B4E9' }: { cx: number; y0: number; y1: number; w: number; level: number | null; water?: string }) {
  const t = 6
  const b = w / 2
  const n = b - t
  const left = (y: number) => cx - b + ((y - y0) / (y1 - y0)) * t
  const right = (y: number) => cx + b - ((y - y0) / (y1 - y0)) * t
  return (
    <g>
      {level !== null ? <path d={`M ${left(level) + 2} ${level} H ${right(level) - 2} L ${cx + n - 2} ${y1 - 3} H ${cx - n + 2} Z`} fill={water} opacity="0.75" /> : null}
      {level !== null ? <line x1={left(level) + 2} y1={level} x2={right(level) - 2} y2={level} stroke="#bfe8ff" strokeWidth="2" /> : null}
      <path d={`M ${cx - b} ${y0} L ${cx - n} ${y1} H ${cx + n} L ${cx + b} ${y0}`} fill="#cfe9ff" fillOpacity="0.08" stroke={CY} strokeWidth="3" strokeLinejoin="round" />
      <line x1={cx - b + 6} y1={y0 + 8} x2={cx - n + 5} y2={y1 - 10} stroke={PALE} strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}

/** A light bulb at (x, y), glowing when `lit`. */
export function Bulb({ x, y, lit, r = 14 }: { x: number; y: number; lit: boolean; r?: number }) {
  return (
    <g>
      {lit ? <circle cx={x} cy={y} r={r * 2.8} fill="url(#sd-glow)" /> : null}
      {lit ? (
        <g stroke={AM} strokeWidth="2.5" strokeLinecap="round">
          {[-150, -120, -90, -60, -30].map((d) => {
            const a = (d * Math.PI) / 180
            return <line key={d} x1={x + Math.cos(a) * (r + 5)} y1={y + Math.sin(a) * (r + 5)} x2={x + Math.cos(a) * (r + 12)} y2={y + Math.sin(a) * (r + 12)} />
          })}
        </g>
      ) : null}
      <circle cx={x} cy={y} r={r} fill={lit ? '#fff2c2' : '#1d2f4d'} stroke={lit ? AM : '#7d93ad'} strokeWidth="2.5" />
      <path d={`M ${x - r * 0.4} ${y + r * 0.2} q ${r * 0.2} ${-r * 0.6} ${r * 0.4} 0 q ${r * 0.2} ${-r * 0.6} ${r * 0.4} 0`} fill="none" stroke={lit ? VERM : '#7d93ad'} strokeWidth="1.8" />
      <rect x={x - r * 0.55} y={y + r * 0.85} width={r * 1.1} height={r * 0.75} rx="2" fill="#8da2b8" stroke={INK} strokeWidth="1" />
    </g>
  )
}

/** A thermometer standing upright, bulb at the bottom, liquid up to `fill` (0..1). */
export function Thermometer({ x, y0, y1, fill = 0.55, w = 12 }: { x: number; y0: number; y1: number; fill?: number; w?: number }) {
  const bulb = w * 0.95
  const top = y1 - bulb - (y1 - bulb - y0) * fill
  return (
    <g>
      <rect x={x - w / 2} y={y0} width={w} height={y1 - y0 - bulb} rx={w / 2} fill="#e8f4ff" fillOpacity="0.15" stroke={CY} strokeWidth="2.5" />
      <rect x={x - w * 0.18} y={top} width={w * 0.36} height={y1 - bulb - top + 2} fill={VERM} />
      <circle cx={x} cy={y1 - bulb * 0.6} r={bulb} fill={VERM} stroke={CY} strokeWidth="2.5" />
      <g stroke={PALE} strokeOpacity="0.6" strokeWidth="1.5">
        {Array.from({ length: 5 }, (_, i) => {
          const yy = y0 + 8 + ((y1 - bulb - y0 - 16) * i) / 4
          return <line key={i} x1={x + w / 2} y1={yy} x2={x + w / 2 + 5} y2={yy} />
        })}
      </g>
    </g>
  )
}

/** A hand lens: round glass with a rim and a handle running down to the right at angle a (degrees). */
export function HandLens({ x, y, r = 22, a = 50 }: { x: number; y: number; r?: number; a?: number }) {
  const rad = (a * Math.PI) / 180
  return (
    <g>
      <line x1={x + Math.cos(rad) * r} y1={y + Math.sin(rad) * r} x2={x + Math.cos(rad) * (r + 34)} y2={y + Math.sin(rad) * (r + 34)} stroke="#6b4a2e" strokeWidth="9" strokeLinecap="round" />
      <circle cx={x} cy={y} r={r} fill="#bfefff" fillOpacity="0.18" stroke="#c9d6e3" strokeWidth="5" />
      <path d={`M ${x - r * 0.55} ${y - r * 0.2} A ${r * 0.6} ${r * 0.6} 0 0 1 ${x - r * 0.1} ${y - r * 0.6}`} fill="none" stroke={PALE} strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}
/** A leafy plant with a stem from (x, base) up `h`, and `leaves` pairs of leaves. */
export function Sprig({ x, base, h, leaves = 2, s = 1, color = '#4fbf6b' }: { x: number; base: number; h: number; leaves?: number; s?: number; color?: string }) {
  return (
    <g>
      <path d={`M ${x} ${base} V ${base - h}`} stroke="#3f9e5a" strokeWidth={3.5 * s} strokeLinecap="round" />
      {Array.from({ length: leaves }, (_, i) => {
        const yy = base - h * (0.45 + (0.55 * (i + 1)) / (leaves + 0.5))
        return (
          <g key={i}>
            <ellipse cx={x - 12 * s} cy={yy} rx={12 * s} ry={5.5 * s} fill={color} transform={`rotate(-25 ${x - 12 * s} ${yy})`} />
            <ellipse cx={x + 12 * s} cy={yy - 5 * s} rx={12 * s} ry={5.5 * s} fill={color} transform={`rotate(25 ${x + 12 * s} ${yy - 5 * s})`} />
          </g>
        )
      })}
    </g>
  )
}

/** A clay pot with soil, rim at y, about 76 wide. Uses the shell's sd-pot gradient. */
export function Pot({ cx, y, w = 76 }: { cx: number; y: number; w?: number }) {
  const h = w * 0.66
  return (
    <g>
      <path d={`M${cx - w * 0.47} ${y + 8} H${cx + w * 0.47} L${cx + w * 0.38} ${y + h} H${cx - w * 0.38} Z`} fill="url(#sd-pot)" />
      <rect x={cx - w / 2} y={y} width={w} height="12" rx="3" fill="#cf7240" />
      <ellipse cx={cx} cy={y} rx={w * 0.44} ry="4.5" fill="#3a2a1c" />
    </g>
  )
}

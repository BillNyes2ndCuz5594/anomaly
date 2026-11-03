// Earth and weather diagrams (S7 section 4): weathering and erosion, streak test, rock types,
// Florida resources, weather instruments, climate zones, cloud types, a cold front over Florida.
import mineralStreakPlate from '../../../assets/diagrams/mineral-streak.webp'
import rockTypesPlate from '../../../assets/diagrams/rock-types.webp'
import weatheringErosionPlate from '../../../assets/diagrams/weathering-erosion.webp'
import resourceQuarryPlate from '../../../assets/diagrams/resource-quarry.webp'
import resourceSolarPlate from '../../../assets/diagrams/resource-solar.webp'
import resourceSpringPlate from '../../../assets/diagrams/resource-spring.webp'
import { AM, BLUE, CY, GREEN, INK, ORANGE, PALE, PURPLE, SKY, STEEL, VERM, blob, type Diagram } from './kit'
import { Arrow, Cloud, Ground, HandLens, Sun, Thermometer } from './parts'

// Florida outline (lon, lat), simplified, clockwise from the Alabama line.
const FL: [number, number][] = [
  [-87.6, 31.0], [-85.0, 31.0], [-84.9, 30.7], [-82.2, 30.57], [-82.0, 30.78], [-81.5, 30.72], [-81.4, 30.3],
  [-81.25, 29.8], [-81.0, 29.2], [-80.6, 28.6], [-80.55, 28.1], [-80.35, 27.6], [-80.1, 26.9], [-80.05, 26.3],
  [-80.15, 25.75], [-80.4, 25.25], [-80.75, 25.15], [-81.1, 25.35], [-81.35, 25.85], [-81.8, 26.2], [-82.1, 26.7],
  [-82.45, 27.3], [-82.75, 27.8], [-82.65, 28.4], [-82.75, 28.9], [-83.1, 29.2], [-83.55, 29.7], [-84.05, 30.1],
  [-84.4, 29.95], [-84.9, 29.7], [-85.3, 29.7], [-85.45, 29.95], [-85.9, 30.2], [-86.5, 30.4], [-87.2, 30.35],
  [-87.5, 30.3], [-87.6, 30.9],
]
/** Map projection for the Florida scenes, art units. */
const fx = (lon: number) => 30 + (lon + 87.7) * 25
const fy = (lat: number) => 30 + (31.1 - lat) * 28
const FL_PATH = `M ${FL.map(([lo, la]) => `${fx(lo).toFixed(1)} ${fy(la).toFixed(1)}`).join(' L ')} Z`

function Florida({ fill = '#2d5a48' }: { fill?: string }) {
  return (
    <g>
      <rect x="-800" y="-800" width="2000" height="1800" fill="#0b2a4a" opacity="0.7" />
      <path d={FL_PATH} fill={fill} stroke={CY} strokeWidth="2.5" strokeLinejoin="round" />
    </g>
  )
}

/** A cliff with a crack and a tree root splitting rock, and a stream carrying pebbles downhill. */
export function WeatheringErosion() {
  const cliff = 'M -800 60 L 150 60 L 166 88 L 158 118 L 180 148 L 192 174 L 1200 206 L 1200 900 L -800 900 Z'
  return (
    <>
      <clipPath id="sd-plate-we">
        <rect x="0" y="0" width="400" height="220" rx="8" />
      </clipPath>
      <image
        href={weatheringErosionPlate}
        x="0"
        y="0"
        width="400"
        height="220"
        preserveAspectRatio="xMidYMid slice"
        clipPath="url(#sd-plate-we)"
        aria-hidden="true"
        opacity="0.4"
      />
      <path d={cliff} fill="#6b5a4a" fillOpacity="0.65" />
      <path d="M -800 60 L 150 60 L 166 88 L 158 118 L 180 148 L 192 174" fill="none" stroke={CY} strokeOpacity="0.5" strokeWidth="2" />
      <g stroke="#4d3f33" strokeWidth="2" opacity="0.8">
        <line x1="-40" y1="86" x2="160" y2="86" />
        <line x1="-40" y1="116" x2="156" y2="116" />
        <line x1="-40" y1="146" x2="178" y2="146" />
      </g>
      {/* tree on top, its root down into a crack */}
      <path d="M 70 60 V 36" stroke="#6b4a2e" strokeWidth="9" strokeLinecap="round" />
      <circle cx="70" cy="22" r="22" fill="#2f8f55" />
      <circle cx="52" cy="30" r="14" fill="#3aa864" />
      <circle cx="88" cy="30" r="14" fill="#3aa864" />
      <path d="M 82 60 L 92 82 L 86 102 L 96 128" fill="none" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <path d="M 72 58 Q 86 68 90 84 Q 92 100 88 110" fill="none" stroke={ORANGE} strokeWidth="4.5" strokeLinecap="round" />
      {/* the crack at the cliff face and a chunk breaking away */}
      <path d="M 128 60 L 136 80 L 130 96 L 142 112" fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M 128 60 L 136 80 L 130 96 L 142 112" fill="none" stroke={AM} strokeWidth="2" strokeLinejoin="round" />
      <path d="M 170 100 L 186 106 L 182 122 L 166 118 Z" fill="#7d6a58" stroke={AM} strokeWidth="1.5" />
      <path d="M 192 128 v 12 M 186 134 l 6 6 l 6 -6" fill="none" stroke={AM} strokeWidth="2" strokeLinecap="round" />
      {/* the stream down the slope */}
      <path d="M 190 182 L 420 202" stroke={BLUE} strokeWidth="18" strokeLinecap="round" />
      <path d="M 190 182 L 420 202" stroke={SKY} strokeWidth="10" strokeLinecap="round" />
      <g fill="#b9b0a6" stroke={INK} strokeWidth="1">
        {[214, 248, 282, 318, 352].map((x, i) => (
          <path key={x} d={blob(x, 184 + (x - 190) * 0.087, 5 + (i % 2) * 2, 3.5, i, 7)} />
        ))}
      </g>
      <g fill="none" stroke={PALE} strokeWidth="2.2" strokeLinecap="round">
        {[232, 300, 368].map((x) => (
          <path key={x} d={`M ${x - 6} ${178 + (x - 190) * 0.087} l 7 4 l -7 4`} transform={`rotate(5 ${x} ${182 + (x - 190) * 0.087})`} />
        ))}
      </g>
    </>
  )
}

/** A mineral dragged across a white streak plate, leaving a coloured streak, and a hand lens. */
export function MineralStreak() {
  return (
    <>
      <clipPath id="sd-plate-ms">
        <rect x="0" y="0" width="400" height="220" rx="8" />
      </clipPath>
      <image
        href={mineralStreakPlate}
        x="0"
        y="0"
        width="400"
        height="220"
        preserveAspectRatio="xMidYMid slice"
        clipPath="url(#sd-plate-ms)"
        aria-hidden="true"
        opacity="0.4"
      />
      <Ground y={180} fill="#3a2f2a" edge={AM} />
      <path d="M 104 138 H 326 L 348 180 H 84 Z" fill="#e9eef4" fillOpacity="0.75" stroke={STEEL} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M 132 162 Q 200 156 286 156" stroke={VERM} strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M 280 128 L 300 112 L 330 118 L 344 140 L 334 162 L 304 168 L 284 152 Z" fill="#5f6672" stroke="#c9d6e3" strokeWidth="2" strokeLinejoin="round" />
      <path d="M 300 112 L 310 140 L 344 140 M 310 140 L 304 168 M 310 140 L 284 152" fill="none" stroke="#a9b6c4" strokeWidth="1.5" />
      <path d="M 300 112 L 330 118 L 310 140 Z" fill="#8a93a0" />
      <Arrow x1={150} y1={124} x2={262} y2={124} color={AM} w={3.5} />
      <HandLens x={54} y={84} r={26} a={118} />
    </>
  )
}

function rockClip(id: string, d: string) {
  return (
    <clipPath id={id}>
      <path d={d} />
    </clipPath>
  )
}

/** Three rock samples: layered (left), glassy with holes (middle), banded and folded (right). */
export function RockTypes() {
  const left = blob(75, 112, 60, 44, 3, 9, 0.16)
  const mid = blob(200, 112, 56, 46, 8, 9, 0.18)
  const right = blob(325, 112, 60, 44, 12, 9, 0.16)
  return (
    <>
      <clipPath id="sd-plate-rt">
        <rect x="0" y="0" width="400" height="220" rx="8" />
      </clipPath>
      <image
        href={rockTypesPlate}
        x="0"
        y="0"
        width="400"
        height="220"
        preserveAspectRatio="xMidYMid slice"
        clipPath="url(#sd-plate-rt)"
        aria-hidden="true"
        opacity="0.4"
      />
      <Ground y={166} fill="#3a2f2a" edge={AM} />
      {[75, 200, 325].map((x) => (
        <ellipse key={x} cx={x} cy="162" rx="58" ry="8" fill={INK} opacity="0.55" />
      ))}
      {rockClip('sd-rk-l', left)}
      {rockClip('sd-rk-m', mid)}
      {rockClip('sd-rk-r', right)}
      <g clipPath="url(#sd-rk-l)" opacity="0.75">
        {['#c9a46a', '#8f6a3e', '#e0c48a', '#a87a45', '#d6b47a', '#7d5a36', '#c9a46a'].map((c, i) => (
          <path key={i} d={`M 0 ${62 + i * 15} q 40 -5 80 0 t 80 0 V 230 H 0 Z`} fill={c} />
        ))}
      </g>
      <g clipPath="url(#sd-rk-m)" opacity="0.75">
        <rect x="130" y="50" width="140" height="130" fill="#262a34" />
        <path d="M 160 80 Q 190 66 226 76 Q 200 82 170 96 Z" fill="#ffffff" opacity="0.28" />
        {[
          [178, 104, 6],
          [204, 98, 4.5],
          [226, 112, 7],
          [190, 128, 5],
          [214, 136, 4],
          [168, 124, 3.5],
          [236, 132, 3.5],
          [200, 116, 3],
        ].map(([x, y, r]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={r} fill="#0b0d12" />
            <path d={`M ${x - r} ${y} A ${r} ${r} 0 0 0 ${x + r} ${y}`} fill="none" stroke="#7d8696" strokeWidth="1.2" />
          </g>
        ))}
      </g>
      <g clipPath="url(#sd-rk-r)" opacity="0.75">
        <rect x="255" y="50" width="140" height="130" fill="#7c7f8a" />
        {['#e3dcd8', '#4f5260', PURPLE, '#e3dcd8', '#4f5260', '#b9a3b0', '#e3dcd8'].map((c, i) => (
          <path key={i} d={`M 255 ${66 + i * 13} q 22 -26 44 0 t 44 0 t 44 0`} fill="none" stroke={c} strokeWidth="7" />
        ))}
      </g>
      {[left, mid, right].map((d) => (
        <path key={d} d={d} fill="none" stroke={CY} strokeOpacity="0.55" strokeWidth="2" />
      ))}
    </>
  )
}

/** Florida with four resource icons: a well, a limestone and phosphate quarry, a wind turbine, a solar panel. */
export function FloridaResources() {
  const well = { x: fx(-82.4), y: fy(29.6) }
  const quarry = { x: fx(-81.9), y: fy(27.9) }
  const turbine = { x: fx(-85.6), y: fy(30.5) }
  const solar = { x: fx(-80.9), y: fy(26.4) }
  return (
    <>
      <Florida />
      {/* resource plate framed insets: spring next to well, quarry next to quarry, solar next to solar */}
      <clipPath id="sd-plate-spring">
        <rect x="320" y="26" width="48" height="48" rx="6" />
      </clipPath>
      <rect x="320" y="26" width="48" height="48" rx="6" fill="#0b2a4a" />
      <image
        href={resourceSpringPlate}
        x="320"
        y="26"
        width="48"
        height="48"
        preserveAspectRatio="xMidYMid slice"
        clipPath="url(#sd-plate-spring)"
        aria-hidden="true"
      />
      <rect x="320" y="26" width="48" height="48" rx="6" fill="none" stroke={CY} strokeOpacity="0.6" strokeWidth="1.5" />

      <clipPath id="sd-plate-quarry">
        <rect x="320" y="86" width="48" height="48" rx="6" />
      </clipPath>
      <rect x="320" y="86" width="48" height="48" rx="6" fill="#0b2a4a" />
      <image
        href={resourceQuarryPlate}
        x="320"
        y="86"
        width="48"
        height="48"
        preserveAspectRatio="xMidYMid slice"
        clipPath="url(#sd-plate-quarry)"
        aria-hidden="true"
      />
      <rect x="320" y="86" width="48" height="48" rx="6" fill="none" stroke={CY} strokeOpacity="0.6" strokeWidth="1.5" />

      <clipPath id="sd-plate-solar">
        <rect x="320" y="146" width="48" height="48" rx="6" />
      </clipPath>
      <rect x="320" y="146" width="48" height="48" rx="6" fill="#0b2a4a" />
      <image
        href={resourceSolarPlate}
        x="320"
        y="146"
        width="48"
        height="48"
        preserveAspectRatio="xMidYMid slice"
        clipPath="url(#sd-plate-solar)"
        aria-hidden="true"
      />
      <rect x="320" y="146" width="48" height="48" rx="6" fill="none" stroke={CY} strokeOpacity="0.6" strokeWidth="1.5" />

      {/* well */}
      <g transform={`translate(${well.x} ${well.y})`}>
        <path d="M -16 -8 L 0 -22 L 16 -8 Z" fill="#8a5a3a" stroke={INK} strokeWidth="1.5" />
        <path d="M -12 -8 V 6 M 12 -8 V 6" stroke={STEEL} strokeWidth="3" />
        <ellipse cx="0" cy="8" rx="15" ry="6" fill="#9aa4b0" stroke={INK} strokeWidth="1.5" />
        <rect x="-15" y="8" width="30" height="10" fill="#9aa4b0" stroke={INK} strokeWidth="1.5" />
        <path d="M 22 -6 q 6 9 0 13 q -6 -4 0 -13 z" fill={SKY} stroke={INK} strokeWidth="1" />
      </g>
      {/* quarry: stepped pit of pale rock */}
      <g transform={`translate(${quarry.x} ${quarry.y})`}>
        <path d="M -22 -10 H 22 L 16 -2 H -16 Z" fill="#e8dcb8" stroke={INK} strokeWidth="1.2" />
        <path d="M -16 -2 H 16 L 10 6 H -10 Z" fill="#cdbf98" stroke={INK} strokeWidth="1.2" />
        <path d="M -10 6 H 10 L 5 13 H -5 Z" fill="#a89a74" stroke={INK} strokeWidth="1.2" />
        <circle cx="26" cy="-6" r="4" fill="#d8d2c4" />
        <circle cx="31" cy="-3" r="3" fill="#b6ab92" />
      </g>
      {/* wind turbine */}
      <g transform={`translate(${turbine.x} ${turbine.y})`}>
        <path d="M -2 6 L -1 -24 H 1 L 2 6 Z" fill={PALE} />
        {[90, 210, 330].map((a) => (
          <path key={a} d="M 0 -24 l -3 -1.5 l 3 -15 l 3 15 z" fill={PALE} transform={`rotate(${a} 0 -24)`} />
        ))}
        <circle cx="0" cy="-24" r="3" fill={AM} />
      </g>
      {/* solar panel */}
      <g transform={`translate(${solar.x} ${solar.y})`}>
        <path d="M 0 2 V 12" stroke={STEEL} strokeWidth="3" />
        <path d="M -18 4 L 18 4 L 12 -12 L -12 -12 Z" fill={BLUE} stroke={CY} strokeWidth="1.8" />
        <path d="M -6 -12 L -9 4 M 6 -12 L 9 4 M -15 -4 H 15" stroke={CY} strokeWidth="1" />
      </g>
    </>
  )
}

/** A weather station post: thermometer, barometer, wind vane with anemometer, and a rain gauge. */
export function WeatherInstruments() {
  return (
    <>
      <Ground y={190} fill="#24402f" edge={GREEN} />
      <rect x="195" y="40" width="10" height="150" fill={STEEL} />
      {/* wind vane on top */}
      <line x1="200" y1="40" x2="200" y2="22" stroke={STEEL} strokeWidth="4" />
      <path d="M 166 22 H 226" stroke={CY} strokeWidth="4" strokeLinecap="round" />
      <path d="M 166 22 l 12 -8 v 16 z" fill={AM} />
      <path d="M 222 22 l 12 -12 v 24 z" fill={CY} />
      {/* anemometer on a cross arm */}
      <path d="M 205 56 H 254 V 38" fill="none" stroke={STEEL} strokeWidth="3.5" />
      <g fill={PALE} stroke={INK} strokeWidth="1">
        <line x1="232" y1="38" x2="276" y2="38" stroke={STEEL} strokeWidth="2.5" />
        <path d="M 226 38 a 7 7 0 0 1 14 0 z" />
        <path d="M 268 38 a 7 7 0 0 0 14 0 z" />
        <circle cx="254" cy="38" r="3.5" fill={AM} />
      </g>
      {/* thermometer on a bracket */}
      <line x1="170" y1="110" x2="195" y2="110" stroke={STEEL} strokeWidth="3" />
      <Thermometer x={164} y0={70} y1={156} fill={0.6} w={13} />
      {/* barometer dial on a bracket */}
      <line x1="205" y1="110" x2="226" y2="110" stroke={STEEL} strokeWidth="3" />
      <circle cx="250" cy="110" r="25" fill="#e9eef4" stroke={CY} strokeWidth="3" />
      <g stroke={INK} strokeWidth="2">
        {[-150, -120, -90, -60, -30].map((d) => {
          const a = (d * Math.PI) / 180
          return <line key={d} x1={250 + Math.cos(a) * 17} y1={110 + Math.sin(a) * 17} x2={250 + Math.cos(a) * 22} y2={110 + Math.sin(a) * 22} />
        })}
      </g>
      <path d="M 250 110 L 263 96" stroke={VERM} strokeWidth="3" strokeLinecap="round" />
      <circle cx="250" cy="110" r="3.5" fill={INK} />
      {/* rain gauge */}
      <path d="M 314 130 H 350 L 340 142 H 324 Z" fill="#cfe9ff" fillOpacity="0.25" stroke={CY} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="322" y="142" width="20" height="48" fill="#cfe9ff" fillOpacity="0.12" stroke={CY} strokeWidth="2.5" />
      <rect x="324" y="168" width="16" height="21" fill={SKY} opacity="0.8" />
      <g stroke={PALE} strokeOpacity="0.7" strokeWidth="1.5">
        {[152, 162, 172, 182].map((y) => (
          <line key={y} x1="334" y1={y} x2="342" y2={y} />
        ))}
      </g>
    </>
  )
}

/** A globe with polar caps, temperate bands and a tropical belt. */
export function ClimateZones() {
  const cx = 200
  const cy = 110
  const r = 92
  const band = (a: number, b: number, fill: string, key: string) => <rect key={key} x={cx - r} y={cy + a * r} width={r * 2} height={(b - a) * r} fill={fill} />
  return (
    <>
      <clipPath id="sd-globe">
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      <g clipPath="url(#sd-globe)">
        {band(-1, -0.76, '#eef6ff', 'pn')}
        {band(-0.76, -0.38, GREEN, 'tn')}
        {band(-0.38, 0.38, ORANGE, 'tr')}
        {band(0.38, 0.76, GREEN, 'ts')}
        {band(0.76, 1, '#eef6ff', 'ps')}
        <g fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="1.5">
          {[-0.76, -0.38, 0, 0.38, 0.76].map((k) => (
            <ellipse key={k} cx={cx} cy={cy + k * r} rx={r * Math.sqrt(1 - k * k)} ry={r * Math.sqrt(1 - k * k) * 0.12} />
          ))}
          <ellipse cx={cx} cy={cy} rx={r * 0.45} ry={r} />
        </g>
      </g>
      <circle cx={cx} cy={cy} r={r} fill="url(#sd-shade)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={CY} strokeOpacity="0.6" strokeWidth="2" />
    </>
  )
}

/** Four clouds at their heights: wispy high, puffy middle, a flat grey low layer, a tall storm tower. */
export function CloudTypes() {
  return (
    <>
      <Ground y={192} fill="#24402f" edge={GREEN} />
      {/* storm tower with its anvil top and rain */}
      <g stroke="#9fc3e6" strokeWidth="2" strokeLinecap="round" opacity="0.8">
        {[48, 64, 80, 96, 112].map((x) => (
          <line key={x} x1={x} y1={168} x2={x - 6} y2={190} />
        ))}
      </g>
      <path d="M 26 168 Q 20 140 40 128 Q 34 100 56 90 Q 52 62 72 54 Q 70 36 84 34 L 20 30 Q 8 22 30 16 L 152 16 Q 170 22 150 30 L 108 34 Q 122 40 118 58 Q 134 70 126 92 Q 144 104 136 128 Q 152 146 136 168 Z" fill="#d6e2ee" />
      <path d="M 26 168 Q 80 178 136 168 Q 130 150 112 152 Q 80 140 46 154 Q 30 156 26 168 Z" fill="#6f8299" />
      {/* wispy high */}
      <g fill="none" stroke="#eef6ff" strokeWidth="3" strokeLinecap="round" opacity="0.9">
        <path d="M 250 34 Q 290 22 334 26 q 10 2 12 -6" />
        <path d="M 268 44 Q 304 36 350 40 q 8 0 10 -6" />
        <path d="M 236 24 Q 262 16 288 16" />
      </g>
      {/* puffy middle */}
      <Cloud x={296} y={92} s={0.72} />
      {/* flat grey low layer */}
      <rect x="168" y="140" width="250" height="20" rx="10" fill="#93a3b6" />
      <rect x="180" y="154" width="226" height="8" rx="4" fill="#6f8299" opacity="0.7" />
    </>
  )
}

/** Florida with a cold front line, cooler air arriving from the northwest, and the Sun over the south. */
export function FloridaFronts() {
  // the front runs from the Atlantic near Jacksonville to the Gulf, triangles on the side it moves toward
  const a = { x: 262, y: 34 }
  const b = { x: 54, y: 128 }
  const n = 7
  const ux = (b.x - a.x) / Math.hypot(b.x - a.x, b.y - a.y)
  const uy = (b.y - a.y) / Math.hypot(b.x - a.x, b.y - a.y)
  // normal toward the southeast
  const nx = -uy
  const ny = ux
  const sx = nx > 0 ? 1 : -1
  return (
    <>
      <Florida />
      <Sun x={fx(-80.9)} y={fy(25.9)} r={11} />
      <g opacity="0.95">
        {[
          [14, 20],
          [44, 0],
          [6, 56],
        ].map(([x, y]) => (
          <Arrow key={`${x}-${y}`} x1={x} y1={y} x2={x + 38} y2={y + 30} color={SKY} w={4} s={10} />
        ))}
      </g>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BLUE} strokeWidth="5" strokeLinecap="round" />
      <g fill={BLUE} stroke={CY} strokeWidth="1">
        {Array.from({ length: n }, (_, i) => {
          const t = (i + 0.5) / n
          const px = a.x + (b.x - a.x) * t
          const py = a.y + (b.y - a.y) * t
          const w = 9
          return <path key={i} d={`M ${px - ux * w} ${py - uy * w} L ${px + ux * w} ${py + uy * w} L ${px + nx * sx * 13} ${py + ny * sx * 13} Z`} />
        })}
      </g>
      <g fill="none" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" opacity="0.9">
        {[0, 1].map((i) => (
          <path key={i} d={`M ${fx(-81.6) + i * 22} ${fy(26.6) - i * 6} q 6 -6 0 -12 q -6 -6 0 -12`} />
        ))}
      </g>
    </>
  )
}

// oxlint-disable-next-line react/only-export-components -- the id map is the registry SceneDiagram dispatches on
export const EARTH_DIAGRAMS: Record<string, Diagram> = {
  'weathering-erosion': WeatheringErosion,
  'mineral-streak': MineralStreak,
  'rock-types': RockTypes,
  'florida-resources': FloridaResources,
  'weather-instruments': WeatherInstruments,
  'climate-zones': ClimateZones,
  'cloud-types': CloudTypes,
  'florida-fronts': FloridaFronts,
}

// oxlint-disable-next-line react/only-export-components -- bedrock diagram plate images for S7 and Unit 4
export const BEDROCK_PLATES: Record<string, string> = {
  'mineral-streak': mineralStreakPlate,
  'rock-types': rockTypesPlate,
  'weathering-erosion': weatheringErosionPlate,
  'resource-quarry': resourceQuarryPlate,
  'resource-solar': resourceSolarPlate,
  'resource-spring': resourceSpringPlate,
}

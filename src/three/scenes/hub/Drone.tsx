import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { atan, attribute, color, cos, float, fract, length, mix, oneMinus, positionLocal, pow, sin, smoothstep, step, time, uniform, vec2, vertexColor } from 'three/tsl'
import { useTier } from '../case/common'

type Part = {
  geo: THREE.BufferGeometry
  pos?: [number, number, number]
  rot?: [number, number, number]
  scale?: [number, number, number]
  /** Vertex color, for the one merged emissive mesh. */
  tint?: string
  /** Rotor center and spin direction, for the merged blur discs. */
  ctr?: [number, number, number]
  /** Weights (steady, nav blink, strobe) for the emissive mesh. */
  blink?: [number, number, number]
}

/** Bakes parts that share a material into one geometry, so each material costs one draw call. */
function bake(parts: Part[]): THREE.BufferGeometry {
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const c = new THREE.Color()
  const list = parts.map((p) => {
    const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()) as THREE.BufferGeometry
    e.set(...(p.rot ?? [0, 0, 0]))
    q.setFromEuler(e)
    m.compose(new THREE.Vector3(...(p.pos ?? [0, 0, 0])), q, new THREE.Vector3(...(p.scale ?? [1, 1, 1])))
    g.applyMatrix4(m)
    const n = g.getAttribute('position').count
    if (p.tint) {
      c.set(p.tint)
      const a = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3)
      g.setAttribute('color', new THREE.BufferAttribute(a, 3))
    }
    if (p.ctr) {
      const a = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) a.set(p.ctr, i * 3)
      g.setAttribute('ctr', new THREE.BufferAttribute(a, 3))
    }
    if (p.blink) {
      const a = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) a.set(p.blink, i * 3)
      g.setAttribute('blink', new THREE.BufferAttribute(a, 3))
    }
    return g
  })
  const merged = mergeGeometries(list)!
  list.forEach((g) => g.dispose())
  return merged
}

const FAN_SPOTS: readonly [number, number][] = [
  [0.95, 0.66],
  [-0.95, 0.66],
  [-0.95, -0.66],
  [0.95, -0.66],
]
const DUCT_Y = 0.11
const ROTOR_R = 0.33
const DUCT_R = 0.375

/** One cross section of the hull. Half widths at the top shoulder, the flank and the belly edge; heights of the ridge, shoulder, flank and belly. */
type Sec = { ws: number; wm: number; wb: number; yt: number; ys: number; ym: number; yb: number }
/** Hull stations from the tail to the nose: a long tapered nose, a broad shouldered mid section, a short blunt tail. */
const HW = 1.12
const HY = 1.08
const RAW: readonly [number, Sec][] = [
  [-0.68, { ws: 0.16, wm: 0.27, wb: 0.2, yt: 0.12, ys: 0.09, ym: 0.02, yb: -0.06 }],
  [-0.55, { ws: 0.21, wm: 0.34, wb: 0.25, yt: 0.17, ys: 0.13, ym: 0.03, yb: -0.08 }],
  [-0.25, { ws: 0.27, wm: 0.4, wb: 0.28, yt: 0.24, ys: 0.18, ym: 0.04, yb: -0.1 }],
  [0.15, { ws: 0.25, wm: 0.36, wb: 0.26, yt: 0.2, ys: 0.15, ym: 0.04, yb: -0.1 }],
  [0.5, { ws: 0.15, wm: 0.21, wb: 0.15, yt: 0.11, ys: 0.09, ym: 0.02, yb: -0.07 }],
  [0.78, { ws: 0.045, wm: 0.06, wb: 0.045, yt: 0.04, ys: 0.035, ym: 0, yb: -0.035 }],
]

const STATIONS: readonly [number, Sec][] = RAW.map(([z, a]) => [z, { ws: a.ws * HW, wm: a.wm * HW, wb: a.wb * HW, yt: a.yt * HY, ys: a.ys * HY, ym: a.ym, yb: a.yb }])

function secAt(z: number): Sec {
  const first = STATIONS[0]
  const last = STATIONS[STATIONS.length - 1]
  if (z <= first[0]) return first[1]
  if (z >= last[0]) return last[1]
  for (let i = 1; i < STATIONS.length; i++) {
    const [z1, b] = STATIONS[i]
    if (z <= z1) {
      const [z0, a] = STATIONS[i - 1]
      const k = (z - z0) / (z1 - z0)
      const o = {} as Sec
      for (const key of Object.keys(a) as (keyof Sec)[]) o[key] = a[key] + (b[key] - a[key]) * k
      return o
    }
  }
  return last[1]
}

/** Seven points around a station: ridge, right shoulder, right flank, right belly, then the left side back up. */
const ring = (s: Sec): [number, number][] => [
  [0, s.yt],
  [s.ws, s.ys],
  [s.wm, s.ym],
  [s.wb, s.yb],
  [-s.wb, s.yb],
  [-s.wm, s.ym],
  [-s.ws, s.ys],
]

type V = [number, number, number]

/** Flat shaded triangles, wound so the normal points away from `from`. */
function pushTri(out: number[], a: V, b: V, c: V, from: V) {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const d = nx * ((a[0] + b[0] + c[0]) / 3 - from[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - from[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - from[2])
  out.push(...(d >= 0 ? [...a, ...b, ...c] : [...a, ...c, ...b]))
}

function toGeometry(pos: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
  g.computeVertexNormals()
  return g
}

/** The faceted fuselage: a loft through the stations, capped at the nose and the tail. */
function hull(): THREE.BufferGeometry {
  const pos: number[] = []
  const rings = STATIONS.map(([z, s]) => ring(s).map(([x, y]): V => [x, y, z]))
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i]
    const b = rings[i + 1]
    const c: V = [0, (a[0][1] + a[3][1]) / 2, (a[0][2] + b[0][2]) / 2]
    for (let j = 0; j < 7; j++) {
      const k = (j + 1) % 7
      pushTri(pos, a[j], a[k], b[k], c)
      pushTri(pos, a[j], b[k], b[j], c)
    }
  }
  for (const [r, from] of [[rings[0], [0, 0.03, 0.4]], [rings[rings.length - 1], [0, 0.0, -0.4]]] as [V[], V][]) {
    const cx: V = [0, r.reduce((n, p) => n + p[1], 0) / 7, r[0][2]]
    for (let j = 0; j < 7; j++) pushTri(pos, r[j], r[(j + 1) % 7], cx, from)
  }
  return toGeometry(pos)
}

/** A thin panel that rides on the shoulder facets between two stations, lifted a hair off the hull. `gap` leaves a dark seam along the ridge. */
function panel(side: 1 | -1, z0: number, z1: number, edges: number[], gap = 0.014, lift = 1.028): THREE.BufferGeometry {
  const zs = [z0, ...STATIONS.map(([z]) => z).filter((z) => z > z0 + 1e-4 && z < z1 - 1e-4), z1]
  const rings = zs.map((z) => {
    const s = secAt(z)
    const r = ring(s).map(([x, y]): [number, number] => [x, y])
    r[0] = [gap, s.yt]
    const cy = 0.04
    return r.map(([x, y]): V => [side * x * lift, cy + (y - cy) * lift, z])
  })
  const pos: number[] = []
  for (let i = 0; i < rings.length - 1; i++) {
    for (const j of edges) {
      const a = rings[i]
      const b = rings[i + 1]
      const from: V = [0, -0.2, (a[0][2] + b[0][2]) / 2]
      pushTri(pos, a[j], a[j + 1], b[j + 1], from)
      pushTri(pos, a[j], b[j + 1], b[j], from)
    }
  }
  return toGeometry(pos)
}

/** Cross section of a ducted fan shroud, revolved: thin wall, rounded intake lip. Profile runs bottom, outer wall, lip, inner wall. */
function duct(): THREE.BufferGeometry {
  const pts = [
    [0.348, -0.05],
    [0.374, -0.05],
    [0.378, 0.04],
    [0.372, 0.066],
    [0.36, 0.074],
    [0.35, 0.064],
    [0.346, 0.04],
    [0.348, -0.05],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(pts, 44)
}

const UP = new THREE.Vector3(0, 1, 0)
/** A round tapered strut from a to b (r0 at a, r1 at b). */
function strut(a: V, b: V, r0: number, r1: number, seg = 8): Part {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const len = d.length()
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())
  const e = new THREE.Euler().setFromQuaternion(q)
  return { geo: new THREE.CylinderGeometry(r1, r0, len, seg), pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [e.x, e.y, e.z] }
}

const yTop = (z: number) => secAt(z).yt

/** Local points that must stay on screen: the four duct rims, the nose and the nav lights. */
const EDGE_PTS: V[] = [
  [1.38, 0.12, 0.66],
  [1.38, 0.12, -0.66],
  [-1.38, 0.12, 0.66],
  [-1.38, 0.12, -0.66],
  [0, 0, 0.8],
]

/**
 * Procedural field survey drone: a dark faceted composite hull with lighter shoulder panels and a dorsal hatch, a
 * gimbal camera pod under the nose, slim arms and braces to four ducted fans, blinking nav lights and a strobe. The
 * fans are blurred discs with counter rotating streaks driven by one phase uniform. A small cool fill light rides with
 * the drone (Medium and High) so the far fans read. Static parts are merged per material: 5 draw calls.
 */
export default function Drone({ reduced, position, scale = 1 }: { reduced: boolean; position: [number, number, number]; scale?: number }) {
  const root = useRef<THREE.Group>(null)
  const tier = useTier()

  const built = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const cyl = (rt: number, rb: number, h: number, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg)
    const ball = (r: number) => new THREE.SphereGeometry(r, 18, 12)
    const ductG = duct()
    const hullG = hull()

    // arms leave the hull flank and meet each duct wall; a thinner brace runs from the belly to the duct underside
    const arms = FAN_SPOTS.map(([x, z]) => {
      const sx = Math.sign(x) * 0.34
      const sz = z * 0.3
      const dx = x - sx
      const dz = z - sz
      const l = Math.hypot(dx, dz)
      const end: V = [x - (dx / l) * (DUCT_R - 0.01), 0.1, z - (dz / l) * (DUCT_R - 0.01)]
      return { a: [sx, 0.07, sz] as V, end, brace: [Math.sign(x) * 0.22, -0.06, sz] as V, braceEnd: [x - (dx / l) * (DUCT_R - 0.01), 0.07, z - (dz / l) * (DUCT_R - 0.01)] as V, sx, sz }
    })

    const zPuck = -0.4
    // lighter accent panels: shoulder plates, nose plates, dorsal hatch and the GPS puck
    const shell: Part[] = [
      ...([1, -1] as const).flatMap((sd) => [
        { geo: panel(sd, -0.54, -0.31, [0, 1]) },
        { geo: panel(sd, -0.28, -0.03, [0]) },
        { geo: panel(sd, 0.0, 0.3, [0]) },
        { geo: panel(sd, 0.33, 0.62, [0]) },
      ]),
      { geo: cyl(0.075, 0.085, 0.03, 20), pos: [0, yTop(zPuck) + 0.03, zPuck] },
    ]
    // dark composite: the hull, arms, braces, ducts, stator vanes, skids, panel lines, gimbal yoke
    const composite: Part[] = [
      { geo: hullG },
      ...arms.map((a): Part => strut(a.a, a.end, 0.03, 0.02)),
      ...arms.map((a): Part => strut(a.brace, a.braceEnd, 0.014, 0.012, 6)),
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: ductG, pos: [x, DUCT_Y, z] })),
      ...FAN_SPOTS.flatMap(([x, z]) =>
        [0, 1, 2].map((i): Part => ({ geo: box, pos: [x + Math.cos(i * 2.094 + 0.5) * 0.19, DUCT_Y - 0.02, z + Math.sin(i * 2.094 + 0.5) * 0.19], rot: [0, -(i * 2.094 + 0.5), 0], scale: [0.36, 0.022, 0.026] })),
      ),
      // skids: two rails on four short legs
      { geo: cyl(0.014, 0.014, 0.88, 8), pos: [0.3, -0.36, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: cyl(0.014, 0.014, 0.88, 8), pos: [-0.3, -0.36, 0], rot: [Math.PI / 2, 0, 0] },
      ...[0.26, -0.26].flatMap((z) => [0.3, -0.3].map((x): Part => ({ geo: cyl(0.012, 0.016, 0.3, 8), pos: [x, -0.21, z], rot: [0, 0, x > 0 ? -0.18 : 0.18] }))),
      // gimbal: a mount stem, a yoke, the camera ball and a hooded lens barrel pitched down
      { geo: cyl(0.045, 0.06, 0.1, 10), pos: [0, -0.13, 0.4] },
      { geo: box, pos: [0.115, -0.24, 0.4], scale: [0.02, 0.16, 0.1] },
      { geo: box, pos: [-0.115, -0.24, 0.4], scale: [0.02, 0.16, 0.1] },
      { geo: ball(0.1), pos: [0, -0.25, 0.4] },
      { geo: cyl(0.062, 0.07, 0.1, 16), pos: [0, -0.29, 0.5], rot: [Math.PI / 2 - 0.5, 0, 0] },
      // seam line along the dorsal ridge
      { geo: box, pos: [0, yTop(-0.3) + 0.002, -0.3], scale: [0.012, 0.004, 0.34] },
    ]
    // brushed metal: motor hubs, hinge clamps, intake lips, antennas, lens ring
    const metal: Part[] = [
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: cyl(0.075, 0.085, 0.12, 18), pos: [x, DUCT_Y + 0.0, z] })),
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: new THREE.ConeGeometry(0.05, 0.07, 14), pos: [x, DUCT_Y + 0.09, z] })),
      ...arms.map((a): Part => ({ geo: box, pos: [a.sx * 1.08, 0.065, a.sz], scale: [0.08, 0.075, 0.12] })),
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: new THREE.TorusGeometry(0.36, 0.008, 6, 44), pos: [x, DUCT_Y + 0.072, z], rot: [Math.PI / 2, 0, 0] })),
      { geo: cyl(0.006, 0.01, 0.42, 6), pos: [-0.14, 0.32, -0.52], rot: [0.14, 0, 0.2] },
      { geo: cyl(0.006, 0.01, 0.3, 6), pos: [0.14, 0.28, -0.52], rot: [0.14, 0, -0.16] },
      { geo: new THREE.TorusGeometry(0.058, 0.009, 8, 28), pos: [0, -0.3, 0.55], rot: [-0.5, 0, 0] },
    ]
    // emissive: lens core, nav lights, strobe, belly strips, nose sensor eyes (vertex colored, with blink weights)
    const steady: [number, number, number] = [1, 0, 0]
    const nav: [number, number, number] = [0, 1, 0]
    const strobe: [number, number, number] = [0, 0, 1]
    const lights: Part[] = [
      { geo: ball(0.028), pos: [0, -0.3, 0.55], scale: [1, 1, 0.5], tint: '#ff9a2e', blink: steady },
      { geo: ball(0.03), pos: [1.31, DUCT_Y + 0.0, -0.66], tint: '#ff4a3d', blink: nav },
      { geo: ball(0.03), pos: [-1.31, DUCT_Y + 0.0, -0.66], tint: '#46ff8c', blink: nav },
      { geo: ball(0.026), pos: [0, yTop(zPuck) + 0.07, zPuck], tint: '#ffffff', blink: strobe },
      { geo: box, pos: [0.27, -0.102, 0.0], scale: [0.012, 0.012, 0.5], tint: '#3ee6ff', blink: steady },
      { geo: box, pos: [-0.27, -0.102, 0.0], scale: [0.012, 0.012, 0.5], tint: '#3ee6ff', blink: steady },
      { geo: box, pos: [0, 0.03, 0.66], scale: [0.04, 0.012, 0.03], tint: '#3ee6ff', blink: steady },
    ]
    // blurred rotor discs: one disc per fan, spin direction in the ctr attribute
    const blur: Part[] = FAN_SPOTS.map(([x, z], i): Part => ({ geo: new THREE.CircleGeometry(ROTOR_R, 40), pos: [x, DUCT_Y + 0.01, z], rot: [-Math.PI / 2, 0, 0], ctr: [x, i % 2 === 0 ? 1 : -1, z] }))

    const shellMat = new THREE.MeshStandardNodeMaterial({ color: '#738193', roughness: 0.5, metalness: 0.3 })
    const compMat = new THREE.MeshStandardNodeMaterial({ color: '#1c2634', roughness: 0.46, metalness: 0.4 })
    const metalMat = new THREE.MeshStandardNodeMaterial({ color: '#9aa9bd', roughness: 0.32, metalness: 0.65 })

    const blinkOn = uniform(1)
    const lightMat = new THREE.MeshBasicNodeMaterial()
    const w = attribute('blink', 'vec3')
    const steadyF = float(2.2).add(sin(time.mul(3.1)).mul(0.5))
    // nav beacons: a crisp on and off about twice a second, never fully dark
    const navF = float(0.3).add(smoothstep(-0.1, 0.1, sin(time.mul(5.2))).mul(3.4))
    // strobe: a short double flash every 1.4 seconds
    const f = fract(time.div(1.4))
    const strobeF = float(0.12).add(step(f, 0.05).add(step(0.11, f).mul(step(f, 0.16))).mul(6))
    const pattern = steadyF.mul(w.x).add(navF.mul(w.y)).add(strobeF.mul(w.z))
    lightMat.colorNode = vertexColor().mul(mix(float(2.4), pattern, blinkOn))

    const phase = uniform(0)
    const blurMat = new THREE.MeshBasicNodeMaterial()
    const ctr = attribute('ctr', 'vec3')
    const dx = positionLocal.x.sub(ctr.x)
    const dz = positionLocal.z.sub(ctr.z)
    const r = length(vec2(dx, dz)).div(ROTOR_R)
    const ang = atan(dz, dx)
    const streak = pow(cos(ang.mul(2).sub(phase.mul(ctr.y))).mul(0.5).add(0.5), 3)
    const streak2 = pow(cos(ang.mul(3).add(phase.mul(ctr.y).mul(1.5))).mul(0.5).add(0.5), 4)
    blurMat.colorNode = color('#d6eeff')
    blurMat.opacityNode = float(0.03)
      .add(streak.mul(0.12))
      .add(streak2.mul(0.05))
      .mul(smoothstep(0.1, 0.3, r))
      .mul(oneMinus(smoothstep(0.82, 1.0, r)))
    blurMat.transparent = true
    blurMat.depthWrite = false
    blurMat.side = THREE.DoubleSide

    return { box, ductG, hullG, geos: [bake(shell), bake(composite), bake(metal), bake(lights), bake(blur)], mats: [shellMat, compMat, metalMat, lightMat, blurMat], phase, blinkOn }
  }, [])

  useEffect(
    () => () => {
      built.box.dispose()
      built.ductG.dispose()
      built.hullG.dispose()
      built.geos.forEach((g) => g.dispose())
      built.mats.forEach((m) => m.dispose())
    },
    [built],
  )

  const spin = useRef(0)
  const shift = useRef(0)
  const probe = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const g = root.current
    built.blinkOn.value = reduced ? 0 : 1
    if (g) {
      g.position.y = position[1] + (reduced ? 0 : Math.sin(t * 1.3) * 0.09)
      g.rotation.y = 0.42 + (reduced ? 0 : Math.sin(t * 0.5) * 0.16)
      g.rotation.z = reduced ? 0 : Math.sin(t * 0.9) * 0.03
      g.rotation.x = -0.28 + (reduced ? 0 : Math.sin(t * 0.7 + 1) * 0.03)
      // Keep the whole drone in frame: when the view is narrow (a phone held sideways, the scene centered beside a side
      // panel) slide it along x until its left-most point is inside the canvas, easing so it never pops.
      const left = (dx: number) => {
        g.position.x = position[0] + dx
        g.updateMatrixWorld(true)
        let m = 1
        for (const p of EDGE_PTS) m = Math.min(m, g.localToWorld(probe.set(p[0], p[1], p[2])).project(state.camera).x)
        return m
      }
      const n0 = left(0)
      const n1 = left(1)
      const want = n0 < -0.84 && n1 > n0 ? Math.min(2.4, (-0.84 - n0) / (n1 - n0)) : 0
      shift.current += (want - shift.current) * (reduced ? 1 : 1 - Math.exp(-dt * 6))
      g.position.x = position[0] + shift.current
    }
    spin.current = (spin.current + dt * (reduced ? 6 : 26)) % (Math.PI * 12)
    built.phase.value = spin.current
  })

  return (
    <group ref={root} position={position} scale={scale}>
      {built.geos.map((geo, i) => (
        <mesh key={i} geometry={geo} material={built.mats[i]} />
      ))}
      {tier !== 'low' ? <pointLight position={[0.2, 1.1, 0.5]} intensity={2.4} color="#cfe6ff" distance={3.4} decay={2} /> : null}
    </group>
  )
}

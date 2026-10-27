import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { atan, attribute, color, cos, float, length, oneMinus, positionLocal, pow, sin, smoothstep, time, uniform, vec2, vertexColor } from 'three/tsl'

type Part = {
  geo: THREE.BufferGeometry
  pos?: [number, number, number]
  rot?: [number, number, number]
  scale?: [number, number, number]
  /** Vertex color, for the one merged emissive mesh. */
  tint?: string
  /** Rotor center and spin direction, for the merged blur discs. */
  ctr?: [number, number, number]
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

/** Top view outline of the fuselage (x across, y forward), scaled about its center: a long tapered nose, near straight flanks, a blunt tail. */
function outline(k: number): THREE.Shape {
  const sh = new THREE.Shape()
  sh.moveTo(-0.12 * k, 0.68 * k)
  sh.lineTo(0.12 * k, 0.68 * k)
  sh.quadraticCurveTo(0.34 * k, 0.5 * k, 0.4 * k, 0.12 * k)
  sh.lineTo(0.42 * k, -0.25 * k)
  sh.quadraticCurveTo(0.42 * k, -0.52 * k, 0.28 * k, -0.54 * k)
  sh.lineTo(-0.28 * k, -0.54 * k)
  sh.quadraticCurveTo(-0.42 * k, -0.52 * k, -0.42 * k, -0.25 * k)
  sh.lineTo(-0.4 * k, 0.12 * k)
  sh.quadraticCurveTo(-0.34 * k, 0.5 * k, -0.12 * k, 0.68 * k)
  return sh
}

/** A bevelled slab of the fuselage outline: flat top and bottom, machined chamfers, spanning y -(d + b) to b. */
function slab(k: number, d: number, b: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(outline(k), { depth: d, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 8 })
  g.rotateX(Math.PI / 2)
  return g
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

/**
 * Procedural field survey drone: a bevelled fuselage with a light satin canopy over a dark composite chassis, a belly
 * gimbal camera, four folding arms ending in ducted fans, nav lights and a strobe. The fans are blurred discs with
 * counter rotating streaks driven by one phase uniform. Static parts are merged per material: 5 draw calls.
 */
export default function Drone({ reduced, position, scale = 1 }: { reduced: boolean; position: [number, number, number]; scale?: number }) {
  const root = useRef<THREE.Group>(null)

  const built = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const cyl = (rt: number, rb: number, h: number, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg)
    const ball = (r: number) => new THREE.SphereGeometry(r, 18, 12)
    const ductG = duct()

    const arms = FAN_SPOTS.map(([x, z]) => {
      const x0 = x * 0.46
      const z0 = z * 0.46
      const dx = x - x0
      const dz = z - z0
      return { x0, z0, len: Math.hypot(dx, dz), ang: Math.atan2(dx, dz), mx: (x + x0) / 2, mz: (z + z0) / 2 }
    })

    // light satin shell: canopy over the chassis, the battery hatch and the GPS puck
    const shell: Part[] = [
      { geo: slab(0.9, 0.05, 0.045), pos: [0, 0.085, 0] },
      { geo: slab(0.5, 0.03, 0.05), pos: [0, 0.165, -0.1] },
      { geo: cyl(0.075, 0.085, 0.035, 20), pos: [0, 0.255, -0.36] },
    ]
    // dark composite: chassis, belly, arms, ducts, struts, gimbal, skids, panel lines
    const composite: Part[] = [
      { geo: slab(1.0, 0.05, 0.035), pos: [0, 0, 0] },
      { geo: slab(0.7, 0.05, 0.04), pos: [0, -0.06, 0] },
      { geo: ball(0.125), pos: [0, -0.2, 0.34], scale: [1, 0.95, 1] },
      { geo: cyl(0.04, 0.05, 0.1, 10), pos: [0, -0.12, 0.34] },
      { geo: cyl(0.014, 0.014, 0.88, 8), pos: [0.3, -0.36, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: cyl(0.014, 0.014, 0.88, 8), pos: [-0.3, -0.36, 0], rot: [Math.PI / 2, 0, 0] },
      ...[0.26, -0.26].flatMap((z) => [0.3, -0.3].map((x): Part => ({ geo: cyl(0.012, 0.016, 0.3, 8), pos: [x, -0.21, z], rot: [0, 0, x > 0 ? -0.18 : 0.18] }))),
      ...arms.map((a): Part => ({ geo: box, pos: [a.mx, 0.0, a.mz], rot: [0, a.ang, 0], scale: [0.1, 0.055, a.len] })),
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: ductG, pos: [x, DUCT_Y, z] })),
      ...FAN_SPOTS.flatMap(([x, z]) =>
        [0, 1, 2].map((i): Part => ({ geo: box, pos: [x + Math.cos(i * 2.094 + 0.5) * 0.19, 0.0, z + Math.sin(i * 2.094 + 0.5) * 0.19], rot: [0, -(i * 2.094 + 0.5), 0], scale: [0.36, 0.018, 0.022] })),
      ),
      // panel lines on the canopy
      { geo: box, pos: [0, 0.1315, 0.02], scale: [0.62, 0.004, 0.012] },
      { geo: box, pos: [0, 0.1315, 0.3], scale: [0.36, 0.004, 0.012] },
      { geo: box, pos: [0.21, 0.1315, -0.2], scale: [0.012, 0.004, 0.44] },
      { geo: box, pos: [-0.21, 0.1315, -0.2], scale: [0.012, 0.004, 0.44] },
      { geo: box, pos: [0, 0.2155, -0.1], scale: [0.012, 0.004, 0.3] },
    ]
    // brushed metal: motor hubs, hinges, intake lips, antennas, lens ring
    const metal: Part[] = [
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: cyl(0.085, 0.095, 0.1, 18), pos: [x, 0.03, z] })),
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: new THREE.ConeGeometry(0.045, 0.06, 14), pos: [x, 0.11, z] })),
      ...arms.map((a): Part => ({ geo: cyl(0.06, 0.06, 0.09, 14), pos: [a.x0, 0.02, a.z0] })),
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: new THREE.TorusGeometry(0.364, 0.007, 6, 44), pos: [x, DUCT_Y - 0.006, z], rot: [Math.PI / 2, 0, 0] })),
      { geo: cyl(0.006, 0.01, 0.42, 6), pos: [-0.2, 0.34, -0.42], rot: [0.14, 0, 0.2] },
      { geo: cyl(0.006, 0.01, 0.3, 6), pos: [0.2, 0.3, -0.42], rot: [0.14, 0, -0.16] },
      { geo: new THREE.TorusGeometry(0.075, 0.012, 8, 28), pos: [0, -0.2, 0.455] },
    ]
    // emissive: lens core, nav lights, strobe, belly strips (vertex colored)
    const lights: Part[] = [
      { geo: ball(0.048), pos: [0, -0.2, 0.46], scale: [1, 1, 0.6], tint: '#ffb547' },
      { geo: ball(0.03), pos: [-1.34, 0.04, -0.66], tint: '#ff4a3d' },
      { geo: ball(0.03), pos: [1.34, 0.04, -0.66], tint: '#46ff8c' },
      { geo: ball(0.02), pos: [0, 0.285, -0.36], tint: '#ffffff' },
      { geo: box, pos: [0.3, -0.115, 0.0], scale: [0.012, 0.012, 0.5], tint: '#3ee6ff' },
      { geo: box, pos: [-0.3, -0.115, 0.0], scale: [0.012, 0.012, 0.5], tint: '#3ee6ff' },
    ]
    // blurred rotor discs: one disc per fan, spin direction in the ctr attribute
    const blur: Part[] = FAN_SPOTS.map(([x, z], i): Part => ({ geo: new THREE.CircleGeometry(ROTOR_R, 40), pos: [x, DUCT_Y, z], rot: [-Math.PI / 2, 0, 0], ctr: [x, i % 2 === 0 ? 1 : -1, z] }))

    const shellMat = new THREE.MeshStandardNodeMaterial({ color: '#a7b2c0', roughness: 0.4, metalness: 0.3 })
    const compMat = new THREE.MeshStandardNodeMaterial({ color: '#1b2431', roughness: 0.5, metalness: 0.3 })
    const metalMat = new THREE.MeshStandardNodeMaterial({ color: '#8d9db3', roughness: 0.32, metalness: 0.65 })

    const lightMat = new THREE.MeshBasicNodeMaterial()
    lightMat.colorNode = vertexColor().mul(float(2.2).add(sin(time.mul(3.1)).mul(0.7)))

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

    return { box, ductG, geos: [bake(shell), bake(composite), bake(metal), bake(lights), bake(blur)], mats: [shellMat, compMat, metalMat, lightMat, blurMat], phase }
  }, [])

  useEffect(
    () => () => {
      built.box.dispose()
      built.ductG.dispose()
      built.geos.forEach((g) => g.dispose())
      built.mats.forEach((m) => m.dispose())
    },
    [built],
  )

  const spin = useRef(0)
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const g = root.current
    if (g) {
      g.position.y = position[1] + (reduced ? 0 : Math.sin(t * 1.3) * 0.09)
      g.rotation.y = 0.42 + (reduced ? 0 : Math.sin(t * 0.5) * 0.16)
      g.rotation.z = reduced ? 0 : Math.sin(t * 0.9) * 0.03
      g.rotation.x = -0.28 + (reduced ? 0 : Math.sin(t * 0.7 + 1) * 0.03)
    }
    spin.current = (spin.current + dt * (reduced ? 6 : 26)) % (Math.PI * 12)
    built.phase.value = spin.current
  })

  return (
    <group ref={root} position={position} scale={scale}>
      {built.geos.map((geo, i) => (
        <mesh key={i} geometry={geo} material={built.mats[i]} />
      ))}
    </group>
  )
}

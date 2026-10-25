import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { color, float, oneMinus, positionLocal, saturate, sin, time } from 'three/tsl'
import { HOLO_CYAN } from '../../materials/hologram'

type Part = { geo: THREE.BufferGeometry; pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number] }

/** Bakes parts that share a material into one geometry, so each material costs one draw call. */
function bake(parts: Part[]): THREE.BufferGeometry {
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const list = parts.map((p) => {
    const g = p.geo.clone()
    e.set(...(p.rot ?? [0, 0, 0]))
    q.setFromEuler(e)
    m.compose(new THREE.Vector3(...(p.pos ?? [0, 0, 0])), q, new THREE.Vector3(...(p.scale ?? [1, 1, 1])))
    g.applyMatrix4(m)
    return g
  })
  const merged = mergeGeometries(list)!
  list.forEach((g) => g.dispose())
  return merged
}

const FAN_SPOTS: readonly [number, number][] = [
  [0.82, 0.66],
  [-0.82, 0.66],
  [-0.82, -0.66],
  [0.82, -0.66],
]

/**
 * Procedural field drone: octagonal armored hull, amber visor, shoulder pods, four ducted fans
 * with spinning blades, antenna and a thruster glow. Static parts are merged per material (about 9 draw calls).
 */
export default function Drone({ reduced, position, scale = 1 }: { reduced: boolean; position: [number, number, number]; scale?: number }) {
  const root = useRef<THREE.Group>(null)
  const rotors = useRef<THREE.Mesh[]>([])

  const built = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const cyl = (rt: number, rb: number, h: number, seg: number) => new THREE.CylinderGeometry(rt, rb, h, seg)
    const torus = (r: number, t: number, a = 48) => new THREE.TorusGeometry(r, t, 8, a)

    const hull: Part[] = [
      { geo: cyl(0.4, 0.52, 0.3, 8), rot: [0, Math.PI / 8, 0] },
      { geo: cyl(0.3, 0.36, 0.14, 8), pos: [0, 0.2, 0], rot: [0, Math.PI / 8, 0] },
      // shoulder pods
      { geo: box, pos: [0.56, 0.02, 0], scale: [0.26, 0.22, 0.5] },
      { geo: box, pos: [-0.56, 0.02, 0], scale: [0.26, 0.22, 0.5] },
      // arms to the fans
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: box, pos: [x * 0.62, 0.03, z * 0.62], rot: [0, Math.atan2(-z, x), 0], scale: [Math.hypot(x, z) * 0.82, 0.07, 0.1] })),
      // ducts
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: torus(0.31, 0.04), pos: [x, 0.08, z], rot: [Math.PI / 2, 0, 0] })),
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: cyl(0.06, 0.07, 0.14, 12), pos: [x, 0.06, z] })),
    ]
    const armor: Part[] = [
      { geo: cyl(0.27, 0.3, 0.06, 8), pos: [0, 0.29, 0], rot: [0, Math.PI / 8, 0] },
      { geo: box, pos: [0.56, 0.15, 0], scale: [0.2, 0.05, 0.42] },
      { geo: box, pos: [-0.56, 0.15, 0], scale: [0.2, 0.05, 0.42] },
      { geo: cyl(0.012, 0.012, 0.4, 6), pos: [-0.18, 0.5, -0.16], rot: [0.15, 0, 0.2] },
    ]
    const dark: Part[] = [
      { geo: cyl(0.26, 0.2, 0.16, 8), pos: [0, -0.2, 0], rot: [0, Math.PI / 8, 0] },
      { geo: box, pos: [0, 0.03, 0.46], scale: [0.62, 0.2, 0.16] },
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: torus(0.24, 0.012), pos: [x, 0.0, z], rot: [Math.PI / 2, 0, 0] })),
    ]
    const glow: Part[] = [
      // visor and lens
      { geo: box, pos: [0, 0.04, 0.545], scale: [0.5, 0.07, 0.03] },
      { geo: new THREE.SphereGeometry(0.05, 14, 10), pos: [0, -0.07, 0.52] },
      // chevron stripes on the top plate and shoulders
      { geo: box, pos: [0.1, 0.33, 0.0], rot: [0, 0.5, 0], scale: [0.035, 0.012, 0.3] },
      { geo: box, pos: [-0.1, 0.33, 0.0], rot: [0, -0.5, 0], scale: [0.035, 0.012, 0.3] },
      { geo: box, pos: [0.69, 0.02, 0.1], scale: [0.012, 0.05, 0.28] },
      { geo: box, pos: [-0.69, 0.02, 0.1], scale: [0.012, 0.05, 0.28] },
      { geo: new THREE.SphereGeometry(0.03, 10, 8), pos: [-0.22, 0.7, -0.1] },
    ]
    const disc: Part[] = FAN_SPOTS.map(([x, z]): Part => ({ geo: cyl(0.3, 0.3, 0.004, 28), pos: [x, 0.08, z] }))

    const blade = bake([
      { geo: box, scale: [0.5, 0.01, 0.045], rot: [0, 0.1, 0] },
      { geo: box, scale: [0.5, 0.01, 0.045], rot: [0, Math.PI / 2 + 0.1, 0] },
    ])

    const hullMat = new THREE.MeshStandardNodeMaterial()
    hullMat.color = new THREE.Color('#223a62')
    hullMat.roughness = 0.38
    hullMat.metalness = 0.7
    const armorMat = new THREE.MeshStandardNodeMaterial()
    armorMat.color = new THREE.Color('#7f9ec8')
    armorMat.roughness = 0.35
    armorMat.metalness = 0.55
    const darkMat = new THREE.MeshStandardNodeMaterial()
    darkMat.color = new THREE.Color('#070d18')
    darkMat.roughness = 0.25
    darkMat.metalness = 0.85
    const bladeMat = new THREE.MeshStandardNodeMaterial()
    bladeMat.color = new THREE.Color('#aab9d2')
    bladeMat.roughness = 0.5

    const glowMat = new THREE.MeshBasicNodeMaterial()
    glowMat.colorNode = color('#ffb547').mul(float(2.8).add(sin(time.mul(2.2)).mul(0.6)))
    const stripMat = new THREE.MeshBasicNodeMaterial()
    stripMat.colorNode = color(HOLO_CYAN).mul(2.6)

    const discMat = new THREE.MeshBasicNodeMaterial()
    discMat.colorNode = color('#8fe9ff').mul(0.9)
    discMat.opacity = 0.07
    discMat.transparent = true
    discMat.blending = THREE.AdditiveBlending
    discMat.depthWrite = false
    discMat.side = THREE.DoubleSide

    const thrustMat = new THREE.MeshBasicNodeMaterial()
    const h = saturate(positionLocal.y.add(0.5))
    thrustMat.colorNode = color(HOLO_CYAN).mul(float(2.2).add(sin(time.mul(9)).mul(0.3)))
    thrustMat.opacityNode = oneMinus(h).mul(0.6)
    thrustMat.transparent = true
    thrustMat.blending = THREE.AdditiveBlending
    thrustMat.depthWrite = false
    thrustMat.side = THREE.DoubleSide
    const thrustGeo = new THREE.CylinderGeometry(0.5, 0.05, 1, 20, 1, true)

    // Glow stripes on the visor are amber, the rest of the light work is cyan: split the glow list.
    const visor = bake(glow.slice(0, 2))
    const strips = bake(glow.slice(2))

    const geos = [bake(hull), bake(armor), bake(dark), visor, strips, bake(disc), blade, thrustGeo]
    const mats = [hullMat, armorMat, darkMat, glowMat, stripMat, discMat, bladeMat, thrustMat]
    return { box, geos, mats, blade, hullMat, armorMat, darkMat, glowMat, stripMat, discMat, bladeMat, thrustMat, thrustGeo }
  }, [])

  useEffect(
    () => () => {
      built.box.dispose()
      built.geos.forEach((g) => g.dispose())
      built.mats.forEach((m) => m.dispose())
    },
    [built],
  )

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const g = root.current
    if (g) {
      g.position.y = position[1] + (reduced ? 0 : Math.sin(t * 1.3) * 0.09)
      g.rotation.y = 0.42 + (reduced ? 0 : Math.sin(t * 0.5) * 0.16)
      g.rotation.z = reduced ? 0 : Math.sin(t * 0.9) * 0.03
      g.rotation.x = 0.1 + (reduced ? 0 : Math.sin(t * 0.7 + 1) * 0.03)
    }
    const spin = reduced ? 8 : 34
    rotors.current.forEach((r, i) => {
      if (r) r.rotation.y += dt * spin * (i % 2 === 0 ? 1 : -1)
    })
  })

  const [hullG, armorG, darkG, visorG, stripG, discG, , thrustG] = built.geos
  const [hullM, armorM, darkM, visorM, stripM, discM, bladeM, thrustM] = built.mats

  return (
    <group ref={root} position={position} scale={scale}>
      <mesh geometry={hullG} material={hullM} />
      <mesh geometry={armorG} material={armorM} />
      <mesh geometry={darkG} material={darkM} />
      <mesh geometry={visorG} material={visorM} />
      <mesh geometry={stripG} material={stripM} />
      <mesh geometry={discG} material={discM} />
      {FAN_SPOTS.map(([x, z], i) => (
        <mesh
          key={i}
          geometry={built.blade}
          material={bladeM}
          position={[x, 0.17, z]}
          ref={(el) => {
            if (el) rotors.current[i] = el
          }}
        />
      ))}
      <mesh geometry={thrustG} material={thrustM} position={[0, -0.55, 0]} scale={[0.5, 0.7, 0.5]} />
    </group>
  )
}

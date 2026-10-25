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
  [0.9, 0.62],
  [-0.9, 0.62],
  [-0.9, -0.62],
  [0.9, -0.62],
]
const ROTOR_Y = 0.16
const ROTOR_R = 0.34

/**
 * Procedural field drone: a pale shell with a navy spine, a glowing amber sensor eye in a dark
 * bezel, four swept arms ending in glowing cyan rotor rings, each with a soft blur disc and fast
 * translucent blades. Static parts are merged per material (about 11 draw calls).
 */
export default function Drone({ reduced, position, scale = 1 }: { reduced: boolean; position: [number, number, number]; scale?: number }) {
  const root = useRef<THREE.Group>(null)
  const rotors = useRef<THREE.Mesh[]>([])

  const built = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const cyl = (rt: number, rb: number, h: number, seg: number) => new THREE.CylinderGeometry(rt, rb, h, seg)
    const torus = (r: number, t: number, a = 56) => new THREE.TorusGeometry(r, t, 8, a)
    const ball = (r: number) => new THREE.SphereGeometry(r, 24, 16)

    // pale shell: a smooth lozenge body, a nose, a dorsal cap and the arms
    const hull: Part[] = [
      { geo: ball(0.5), scale: [1.18, 0.5, 1.0] },
      { geo: ball(0.28), pos: [0, 0.04, 0.36], scale: [1.0, 0.6, 0.85] },
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: cyl(0.045, 0.06, 1, 10), pos: [x * 0.52, 0.06, z * 0.52], rot: [Math.PI / 2, 0, Math.atan2(z, x) - Math.PI / 2], scale: [1, Math.hypot(x, z) * 0.9, 1] })),
    ]
    // navy spine, shoulder pads and motor pods
    const armor: Part[] = [
      { geo: ball(0.34), pos: [0, 0.16, -0.1], scale: [0.85, 0.3, 1.2] },
      { geo: box, pos: [0, 0.17, -0.1], scale: [0.035, 0.26, 0.85] },
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: cyl(0.1, 0.12, 0.16, 14), pos: [x, 0.07, z] })),
      { geo: cyl(0.012, 0.012, 0.42, 6), pos: [-0.22, 0.52, -0.3], rot: [0.12, 0, 0.18] },
    ]
    const dark: Part[] = [
      // eye bezel and the belly
      { geo: torus(0.17, 0.035), pos: [0, 0.03, 0.47], rot: [0.12, 0, 0] },
      { geo: ball(0.3), pos: [0, -0.15, 0], scale: [1.2, 0.35, 1.0] },
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: torus(0.1, 0.014), pos: [x, 0.13, z], rot: [Math.PI / 2, 0, 0] })),
    ]
    const eye: Part[] = [
      { geo: ball(0.15), pos: [0, 0.03, 0.5], scale: [1, 1, 0.7] },
      { geo: ball(0.03), pos: [-0.22, 0.73, -0.36] },
    ]
    const rims: Part[] = [
      ...FAN_SPOTS.map(([x, z]): Part => ({ geo: torus(ROTOR_R, 0.026), pos: [x, ROTOR_Y, z], rot: [Math.PI / 2, 0, 0] })),
      { geo: torus(0.26, 0.012), pos: [0, -0.16, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: box, pos: [0.42, 0.14, 0.14], rot: [0, 0.35, 0], scale: [0.2, 0.014, 0.025] },
      { geo: box, pos: [-0.42, 0.14, 0.14], rot: [0, -0.35, 0], scale: [0.2, 0.014, 0.025] },
    ]
    const disc: Part[] = FAN_SPOTS.map(([x, z]): Part => ({ geo: cyl(ROTOR_R, ROTOR_R, 0.004, 32), pos: [x, ROTOR_Y, z] }))

    const blade = bake([
      { geo: box, scale: [0.62, 0.006, 0.03], rot: [0, 0.1, 0] },
      { geo: box, scale: [0.62, 0.006, 0.03], rot: [0, Math.PI / 2 + 0.1, 0] },
    ])

    const hullMat = new THREE.MeshStandardNodeMaterial()
    hullMat.color = new THREE.Color('#cfdcf0')
    hullMat.roughness = 0.32
    hullMat.metalness = 0.35
    const armorMat = new THREE.MeshStandardNodeMaterial()
    armorMat.color = new THREE.Color('#2a4572')
    armorMat.roughness = 0.35
    armorMat.metalness = 0.6
    const darkMat = new THREE.MeshStandardNodeMaterial()
    darkMat.color = new THREE.Color('#070d18')
    darkMat.roughness = 0.25
    darkMat.metalness = 0.85

    const eyeMat = new THREE.MeshBasicNodeMaterial()
    eyeMat.colorNode = color('#ffb547').mul(float(2.8).add(sin(time.mul(2.2)).mul(0.6)))
    const rimMat = new THREE.MeshBasicNodeMaterial()
    rimMat.colorNode = color(HOLO_CYAN).mul(2.8)

    const discMat = new THREE.MeshBasicNodeMaterial()
    discMat.colorNode = color('#8fe9ff').mul(1.2)
    discMat.opacity = 0.2
    discMat.transparent = true
    discMat.blending = THREE.AdditiveBlending
    discMat.depthWrite = false
    discMat.side = THREE.DoubleSide

    const bladeMat = new THREE.MeshBasicNodeMaterial()
    bladeMat.colorNode = color('#d8f6ff').mul(1.4)
    bladeMat.opacity = 0.22
    bladeMat.transparent = true
    bladeMat.blending = THREE.AdditiveBlending
    bladeMat.depthWrite = false

    const thrustMat = new THREE.MeshBasicNodeMaterial()
    const h = saturate(positionLocal.y.add(0.5))
    thrustMat.colorNode = color(HOLO_CYAN).mul(float(2.2).add(sin(time.mul(9)).mul(0.3)))
    thrustMat.opacityNode = oneMinus(h).mul(0.22)
    thrustMat.transparent = true
    thrustMat.blending = THREE.AdditiveBlending
    thrustMat.depthWrite = false
    thrustMat.side = THREE.DoubleSide
    const thrustGeo = new THREE.CylinderGeometry(0.5, 0.05, 1, 20, 1, true)

    const geos = [bake(hull), bake(armor), bake(dark), bake(eye), bake(rims), bake(disc), blade, thrustGeo]
    const mats = [hullMat, armorMat, darkMat, eyeMat, rimMat, discMat, bladeMat, thrustMat]
    return { box, geos, mats, blade }
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
      g.rotation.x = -0.28 + (reduced ? 0 : Math.sin(t * 0.7 + 1) * 0.03)
    }
    const spin = reduced ? 8 : 34
    rotors.current.forEach((r, i) => {
      if (r) r.rotation.y += dt * spin * (i % 2 === 0 ? 1 : -1)
    })
  })

  const [hullG, armorG, darkG, eyeG, rimG, discG, , thrustG] = built.geos
  const [hullM, armorM, darkM, eyeM, rimM, discM, bladeM, thrustM] = built.mats

  return (
    <group ref={root} position={position} scale={scale}>
      <mesh geometry={hullG} material={hullM} />
      <mesh geometry={armorG} material={armorM} />
      <mesh geometry={darkG} material={darkM} />
      <mesh geometry={eyeG} material={eyeM} />
      <mesh geometry={rimG} material={rimM} />
      <mesh geometry={discG} material={discM} />
      {FAN_SPOTS.map(([x, z], i) => (
        <mesh
          key={i}
          geometry={built.blade}
          material={bladeM}
          position={[x, ROTOR_Y + 0.01, z]}
          ref={(el) => {
            if (el) rotors.current[i] = el
          }}
        />
      ))}
      <mesh geometry={thrustG} material={thrustM} position={[0, -0.36, 0]} scale={[0.24, 0.36, 0.24]} />
    </group>
  )
}

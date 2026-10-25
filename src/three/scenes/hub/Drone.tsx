import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { color, float, oneMinus, positionLocal, saturate, sin, time } from 'three/tsl'
import { HOLO_CYAN } from '../../materials/hologram'

/** Procedural field drone: hull, four arms with spinning rotors, emissive eye, thruster glow. */
export default function Drone({ reduced, position }: { reduced: boolean; position: [number, number, number] }) {
  const root = useRef<THREE.Group>(null)
  const rotors = useRef<THREE.Group[]>([])
  const eye = useRef<THREE.Mesh>(null)

  const { glowMat, discMat, eyeMat, stripMat } = useMemo(() => {
    const glowMat = new THREE.MeshBasicNodeMaterial()
    const h = saturate(positionLocal.y.add(0.5))
    glowMat.colorNode = color(HOLO_CYAN).mul(float(2.2).add(sin(time.mul(9)).mul(0.3)))
    glowMat.opacityNode = oneMinus(h).mul(0.6)
    glowMat.transparent = true
    glowMat.blending = THREE.AdditiveBlending
    glowMat.depthWrite = false
    glowMat.side = THREE.DoubleSide

    const discMat = new THREE.MeshBasicNodeMaterial()
    discMat.colorNode = color('#8fe9ff').mul(0.9)
    discMat.opacity = 0.05
    discMat.transparent = true
    discMat.blending = THREE.AdditiveBlending
    discMat.depthWrite = false
    discMat.side = THREE.DoubleSide

    const eyeMat = new THREE.MeshBasicNodeMaterial()
    eyeMat.colorNode = color('#ffb547').mul(float(3).add(sin(time.mul(2.2)).mul(0.8)))

    const stripMat = new THREE.MeshBasicNodeMaterial()
    stripMat.colorNode = color(HOLO_CYAN).mul(2.4)
    return { glowMat, discMat, eyeMat, stripMat }
  }, [])
  useEffect(
    () => () => {
      glowMat.dispose()
      discMat.dispose()
      eyeMat.dispose()
      stripMat.dispose()
    },
    [glowMat, discMat, eyeMat, stripMat],
  )

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const g = root.current
    if (g) {
      g.position.y = position[1] + (reduced ? 0 : Math.sin(t * 1.3) * 0.09)
      g.rotation.y = 0.5 + (reduced ? 0 : Math.sin(t * 0.5) * 0.18)
      g.rotation.z = reduced ? 0 : Math.sin(t * 0.9) * 0.035
      g.rotation.x = reduced ? 0 : Math.sin(t * 0.7 + 1) * 0.03
    }
    const spin = reduced ? 8 : 34
    rotors.current.forEach((r, i) => {
      if (r) r.rotation.y += dt * spin * (i % 2 === 0 ? 1 : -1)
    })
    if (eye.current && !reduced) eye.current.position.x = Math.sin(t * 0.8) * 0.045
  })

  const arms = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ] as const

  return (
    <group ref={root} position={position} scale={0.9}>
      {/* hull */}
      <mesh scale={[1, 0.58, 1.08]}>
        <sphereGeometry args={[0.5, 40, 24]} />
        <meshStandardMaterial color="#1f3556" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.2, -0.02]} scale={[0.72, 0.4, 0.78]}>
        <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#5f7ba3" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* belt stripe */}
      <mesh position={[0, 0.0, 0]} scale={[1.01, 1, 1.09]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.012, 6, 64]} />
        <primitive object={stripMat} attach="material" />
      </mesh>
      {/* eye socket and eye */}
      <mesh position={[0, 0.02, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.12, 28]} />
        <meshStandardMaterial color="#04070d" roughness={0.15} metalness={0.9} />
      </mesh>
      <mesh ref={eye} position={[0, 0.02, 0.56]}>
        <sphereGeometry args={[0.09, 20, 14]} />
        <primitive object={eyeMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.02, 0.55]}>
        <torusGeometry args={[0.15, 0.012, 6, 32]} />
        <primitive object={stripMat} attach="material" />
      </mesh>
      {/* antenna */}
      <mesh position={[-0.2, 0.42, -0.2]} rotation={[0.2, 0, 0.25]}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
        <meshStandardMaterial color="#9db2d1" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-0.25, 0.6, -0.17]}>
        <sphereGeometry args={[0.03, 10, 8]} />
        <primitive object={eyeMat} attach="material" />
      </mesh>
      {/* arms and rotors */}
      {arms.map(([sx, sz], i) => (
        <group key={i} position={[sx * 0.5, 0.1, sz * 0.5]}>
          <mesh position={[-sx * 0.2, -0.02, -sz * 0.2]} rotation={[0, Math.atan2(sx, sz) + Math.PI / 2, 0]}>
            <boxGeometry args={[0.5, 0.07, 0.09]} />
            <meshStandardMaterial color="#1a2a46" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.0, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.14, 14]} />
            <meshStandardMaterial color="#0c1626" roughness={0.3} metalness={0.8} />
          </mesh>
          <group
            position={[0, 0.1, 0]}
            ref={(el) => {
              if (el) rotors.current[i] = el
            }}
          >
            <mesh rotation={[0, 0, 0]}>
              <boxGeometry args={[0.66, 0.008, 0.035]} />
              <meshStandardMaterial color="#9db2d1" roughness={0.5} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.035, 0.008, 0.66]} />
              <meshStandardMaterial color="#9db2d1" roughness={0.5} />
            </mesh>
          </group>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.006, 32]} />
            <primitive object={discMat} attach="material" />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.018, 8, 40]} />
            <meshStandardMaterial color="#0c1626" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}
      {/* thruster glow */}
      <mesh position={[0, -0.55, 0]} scale={[0.5, 0.7, 0.5]}>
        <cylinderGeometry args={[0.5, 0.05, 1, 20, 1, true]} />
        <primitive object={glowMat} attach="material" />
      </mesh>
    </group>
  )
}

import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three/webgpu'

/** Keep marker animation/interaction anchors, submit identical visible parts in five batches. */
export default function MarkerInstances({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const batches = useRef<{ mesh: THREE.InstancedMesh; sources: THREE.Mesh[] }[]>([])
  useLayoutEffect(() => {
    const group = root.current!
    const parts = new Map<string, THREE.Mesh[]>()
    group.traverse((obj) => {
      const key = obj.userData.markerBatch as string | undefined
      if (key) parts.set(key, [...(parts.get(key) ?? []), obj as THREE.Mesh])
    })
    batches.current = [...parts.values()].map((sources) => {
      const geometry = sources[0].geometry.clone()
      geometry.setAttribute('markerColor', new THREE.InstancedBufferAttribute(new Float32Array(sources.length * 3), 3))
      const mesh = new THREE.InstancedMesh(geometry, sources[0].material, sources.length)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      sources.forEach((source) => { source.layers.set(31) })
      group.add(mesh)
      return { mesh, sources }
    })
    return () => {
      for (const { mesh, sources } of batches.current) {
        sources.forEach((source) => { source.layers.set(0) })
        group.remove(mesh)
        mesh.geometry.dispose()
        mesh.dispose()
      }
      batches.current = []
    }
  }, [children])
  const matrix = useRef(new THREE.Matrix4())
  const inverse = useRef(new THREE.Matrix4())
  const tint = useRef(new THREE.Color())
  useFrame(() => {
    const group = root.current!
    group.updateWorldMatrix(true, true)
    inverse.current.copy(group.matrixWorld).invert()
    for (const { mesh, sources } of batches.current) {
      const colors = mesh.geometry.getAttribute('markerColor') as THREE.InstancedBufferAttribute
      sources.forEach((source, i) => {
        matrix.current.multiplyMatrices(inverse.current, source.matrixWorld)
        if (source.userData.markerHidden?.()) matrix.current.makeScale(0, 0, 0)
        mesh.setMatrixAt(i, matrix.current)
        tint.current.set(source.userData.markerHex).multiplyScalar(source.userData.markerGlow.value)
        colors.setXYZ(i, tint.current.r, tint.current.g, tint.current.b)
      })
      colors.needsUpdate = true
      mesh.instanceMatrix.needsUpdate = true
    }
  }, 0)
  return <group ref={root}>{children}</group>
}

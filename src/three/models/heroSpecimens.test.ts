import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'
import { HERO_SPECIMENS, hasHero, normalizeHero, toFloat } from './heroSpecimens'
import { specimenGeo } from './creatures'

describe('hero specimen scans', () => {
  it('every hero has a procedural fallback and a shipped scan file', () => {
    for (const id of Object.keys(HERO_SPECIMENS)) {
      expect(hasHero(id)).toBe(true)
      expect(specimenGeo(id).size[0]).toBeGreaterThan(0)
      expect(existsSync(new URL(`../../assets/specimens/${id}.glb`, import.meta.url))).toBe(true)
    }
    expect(hasHero('manatee')).toBe(false)
  })

  it('dequantizes normalized attributes before transforming', () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Int16Array([32767, 0, 0, -32767, 0, 0, 0, 32767, 0]), 3, true))
    const f = toFloat(g).applyMatrix4(new THREE.Matrix4().makeScale(10, 10, 10))
    const p = f.getAttribute('position')
    expect(p.array).toBeInstanceOf(Float32Array)
    expect(p.getX(0)).toBeCloseTo(10, 3)
    expect(p.getY(2)).toBeCloseTo(10, 3)
  })

  it('lays the scan along x, grounds it and keeps it inside the procedural box', () => {
    const g = new THREE.BoxGeometry(1, 2, 4).translate(0, 5, 0)
    const target: [number, number, number] = [2, 1, 1]
    const n = normalizeHero(g, 0, target)
    const b = n.boundingBox!
    const s = new THREE.Vector3()
    b.getSize(s)
    expect(s.x).toBeGreaterThan(s.z)
    expect(b.min.y).toBeCloseTo(0, 5)
    expect(s.x).toBeLessThanOrEqual(target[0] + 1e-6)
    expect(s.y).toBeLessThanOrEqual(target[1] + 1e-6)
    expect(Math.abs((b.min.x + b.max.x) / 2)).toBeLessThan(1e-6)
  })
})

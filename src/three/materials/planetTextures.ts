import * as THREE from 'three/webgpu'
import gasGiantUrl from '../../assets/planets/planet-gas-giant.webp?url'
import iceGiantUrl from '../../assets/planets/planet-ice-giant.webp?url'
import moonUrl from '../../assets/planets/planet-moon.webp?url'

// Seamless equirectangular maps for the title night body and the hub planet and moon. Each loads once on first
// use and is shared for the life of the page. The texture is returned right away and fills in when the image
// decodes, so a material can bind it before the pixels arrive (the sphere shows black until then, then paints in).
const cache = new Map<string, THREE.Texture>()

function load(url: string): THREE.Texture {
  const hit = cache.get(url)
  if (hit) return hit
  const tex = new THREE.Texture()
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 4
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    tex.image = img
    tex.needsUpdate = true
  }
  img.src = url
  cache.set(url, tex)
  return tex
}

export const gasGiantTexture = () => load(gasGiantUrl)
export const iceGiantTexture = () => load(iceGiantUrl)
export const moonTexture = () => load(moonUrl)

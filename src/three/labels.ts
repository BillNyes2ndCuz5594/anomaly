import * as THREE from 'three/webgpu'

/** Canvas texture with bracketed monospace text, used for floating 3D labels. */
export function makeLabelTexture(text: string, accent: string, sub?: string): { tex: THREE.CanvasTexture; aspect: number } {
  const w = 640
  const h = sub ? 168 : 120
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(6, 12, 24, 0.82)'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = accent
  g.lineWidth = 3
  const b = 26
  const m = 4
  g.beginPath()
  g.moveTo(m, m + b); g.lineTo(m, m); g.lineTo(m + b, m)
  g.moveTo(w - m - b, m); g.lineTo(w - m, m); g.lineTo(w - m, m + b)
  g.moveTo(w - m, h - m - b); g.lineTo(w - m, h - m); g.lineTo(w - m - b, h - m)
  g.moveTo(m + b, h - m); g.lineTo(m, h - m); g.lineTo(m, h - m - b)
  g.stroke()
  g.fillStyle = accent
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '700 50px ui-monospace, "SF Mono", Consolas, "Liberation Mono", monospace'
  g.fillText(text, w / 2, sub ? h * 0.36 : h / 2)
  if (sub) {
    g.fillStyle = '#c9dcf5'
    g.font = '400 34px system-ui, "Segoe UI", Roboto, sans-serif'
    g.fillText(sub, w / 2, h * 0.74)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { tex, aspect: w / h }
}

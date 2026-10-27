// Generates PWA icons into public/ by rendering inline SVG with local Chrome. No network.
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

function svg(size, pad) {
  // Content is drawn in a 64 unit box, scaled by pad for maskable safe zones. The look follows the title screen:
  // navy night, a cyan glass letter with a lit top edge, the amber scan line under it and the field grid floor.
  const s = (1 - pad * 2) * size / 64
  const o = pad * size
  const grid = [40, 46, 54, 64].map((y) => `<path d="M-40 ${y}H104" stroke="#2fb8d8" stroke-opacity="${(0.1 + (y - 40) * 0.006).toFixed(3)}" stroke-width="0.5"/>`).join('')
  const rays = [-60, -30, -10, 10, 30, 60].map((x) => `<path d="M32 38L${32 + x * 1.6} 72" stroke="#2fb8d8" stroke-opacity="0.12" stroke-width="0.5"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="80%"><stop offset="0" stop-color="#16324c"/><stop offset="0.55" stop-color="#0b1626"/><stop offset="1" stop-color="#05080f"/></radialGradient>
    <radialGradient id="haze" cx="50%" cy="62%" r="40%"><stop offset="0" stop-color="#1b6a86" stop-opacity="0.55"/><stop offset="1" stop-color="#1b6a86" stop-opacity="0"/></radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9fdff"/><stop offset="0.35" stop-color="#7fe9f7"/><stop offset="1" stop-color="#2a9fbd"/></linearGradient>
    <linearGradient id="amber" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb547" stop-opacity="0"/><stop offset="0.2" stop-color="#ffb547"/><stop offset="0.8" stop-color="#ffb547"/><stop offset="1" stop-color="#ffb547" stop-opacity="0"/></linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#haze)"/>
  <g transform="translate(${o} ${o}) scale(${s})">
    <g>${grid}${rays}</g>
    <path d="M7 17V7h10M47 7h10v10M57 47v10H47M17 57H7V47" fill="none" stroke="#3ee6ff" stroke-opacity="0.85" stroke-width="2"/>
    <g filter="url(#glow)">
      <path d="M17.5 46 28.6 15h6.8L46.5 46h-6.6l-2.3-6.8H26.4L24.1 46ZM28.2 33.6h7.6L32 22.2Z" fill="url(#glass)" fill-rule="evenodd"/>
      <path d="M28.6 15h6.8" stroke="#ffffff" stroke-width="0.9"/>
      <rect x="12" y="47.6" width="40" height="1.3" fill="url(#amber)"/>
    </g>
    <circle cx="32" cy="10.4" r="2.1" fill="#ffb547" filter="url(#glow)"/>
  </g></svg>`
}

const jobs = [
  ['icon-192.png', 192, 0.04],
  ['icon-512.png', 512, 0.04],
  ['icon-maskable-512.png', 512, 0.16],
  ['apple-touch-icon.png', 180, 0.06],
]

const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const [name, size, pad] of jobs) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
  await page.setContent(`<body style="margin:0">${svg(size, pad)}</body>`)
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } })
  writeFileSync(join(out, name), buf)
  console.log('wrote', name)
}
await browser.close()

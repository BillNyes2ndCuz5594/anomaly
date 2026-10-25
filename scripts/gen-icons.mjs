// Generates PWA icons into public/ by rendering inline SVG with local Chrome. No network.
import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

function svg(size, pad) {
  // Content is drawn in a 64 unit box, scaled by pad for maskable safe zones.
  const s = (1 - pad * 2) * size / 64
  const o = pad * size
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#1a3050"/><stop offset="1" stop-color="#0b1220"/></radialGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <g transform="translate(${o} ${o}) scale(${s})">
    <path d="M8 20V8h12M44 8h12v12M56 44v12H44M20 56H8V44" fill="none" stroke="#3ee6ff" stroke-width="3" stroke-linecap="square"/>
    <path d="M18 46 32 16l14 30M23 36h18" fill="none" stroke="#3ee6ff" stroke-width="5" stroke-linecap="square"/>
    <circle cx="32" cy="12" r="3" fill="#ffb547"/>
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

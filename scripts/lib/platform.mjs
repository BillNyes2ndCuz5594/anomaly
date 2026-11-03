import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Chrome executable: CHROME_PATH or PROOF_CHROME, else the usual install path for this OS. */
export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  if (process.env.PROOF_CHROME) return process.env.PROOF_CHROME
  if (process.platform === 'win32') {
    const candidates = [
      process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
      process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean)
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return candidates[0] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  }
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }
  return '/usr/bin/google-chrome'
}

/** PROOF_REAL_GPU=1 drops the swiftshader flags so Chrome uses the host GPU; unset keeps the container defaults. */
const SWIFTSHADER_FLAGS = new Set([
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--use-vulkan=swiftshader',
  '--enable-features=Vulkan',
])

const DEFAULT_CHROME_ARGS = [
  '--no-sandbox',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-unsafe-webgpu',
  // On swiftshader, without these two headless Chrome destroys the WebGPU device on the first presented frame.
  '--enable-features=Vulkan',
  '--use-vulkan=swiftshader',
  '--disable-dev-shm-usage',
  '--renderer-process-limit=2',
]

export const CHROME_ARGS = process.env.PROOF_REAL_GPU === '1'
  ? DEFAULT_CHROME_ARGS.filter((arg) => !SWIFTSHADER_FLAGS.has(arg))
  : DEFAULT_CHROME_ARGS

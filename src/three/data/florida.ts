// Approximate Florida outline as [longitude, latitude] pairs, clockwise from the western panhandle.
// Stylized on purpose: good enough for a hologram map table, not for navigation.
export const FLORIDA_LONLAT: readonly [number, number][] = [
  [-87.6, 31.0],
  [-85.0, 31.0],
  [-84.86, 30.7],
  [-82.2, 30.57],
  [-81.45, 30.7],
  [-81.3, 29.9],
  [-81.0, 29.2],
  [-80.55, 28.45],
  [-80.4, 27.6],
  [-80.15, 26.9],
  [-80.03, 26.0],
  [-80.12, 25.75],
  [-80.35, 25.3],
  [-80.9, 25.12],
  [-81.15, 25.15],
  [-81.35, 25.85],
  [-81.8, 26.15],
  [-82.0, 26.6],
  [-82.2, 26.95],
  [-82.7, 27.5],
  [-82.65, 28.0],
  [-82.8, 28.5],
  [-82.7, 28.95],
  [-83.05, 29.15],
  [-83.4, 29.7],
  [-83.7, 29.95],
  [-84.2, 30.05],
  [-84.4, 29.9],
  [-85.0, 29.7],
  [-85.35, 29.7],
  [-85.7, 30.1],
  [-86.5, 30.4],
  [-87.3, 30.35],
  [-87.6, 30.3],
]

export const MAP_CENTER = { lon: -83.8, lat: 28.0 }
/** World units per degree of latitude on the map table. */
export const MAP_SCALE = 0.7

/** Longitude and latitude to table-local x and z (north is -z, away from the viewer). */
export function lonLatToXZ(lon: number, lat: number): [number, number] {
  const kx = Math.cos((MAP_CENTER.lat * Math.PI) / 180)
  return [(lon - MAP_CENTER.lon) * kx * MAP_SCALE, -(lat - MAP_CENTER.lat) * MAP_SCALE]
}

/** Places for small map pings (cities only, no student data). */
export const MAP_PINGS: readonly { name: string; lon: number; lat: number }[] = [
  { name: 'Jacksonville', lon: -81.66, lat: 30.33 },
  { name: 'Tallahassee', lon: -84.28, lat: 30.44 },
  { name: 'Orlando', lon: -81.38, lat: 28.54 },
  { name: 'Tampa', lon: -82.46, lat: 27.95 },
  { name: 'Fort Pierce', lon: -80.33, lat: 27.45 },
  { name: 'Miami', lon: -80.19, lat: 25.76 },
  { name: 'Pensacola', lon: -87.2, lat: 30.42 },
]

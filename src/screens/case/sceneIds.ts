// Every scene diagram id, in display order: the seven original diagrams, then the 42 from S7
// (docs/tasks/S7-content.md section 4, in table order). scripts/check-pack.mjs keeps the same set
// (diagrams.test.ts checks that), and the art check page (#/visuals) draws every one.
export const SCENE_IDS = [
  'water-cycle', 'ocean-evaporation', 'solar-system', 'inner-outer-planets', 'comet-orbit', 'asteroid-belt', 'plant-pots',
  'fair-test-plants', 'bar-graph', 'lab-tools', 'galaxy-spiral', 'star-brightness-distance', 'earth-day-night', 'moon-month',
  'sun-earth-moon', 'weathering-erosion', 'mineral-streak', 'rock-types', 'florida-resources', 'weather-instruments',
  'climate-zones', 'cloud-types', 'florida-fronts', 'matter-three-states', 'mixture-separation', 'dissolving-temperature',
  'physical-chemical-change', 'energy-forms', 'light-path', 'circuit-open-closed', 'conductor-insulator', 'heat-flow',
  'static-balloon', 'forces-ramp', 'friction-surfaces', 'falling-apple', 'magnet-poles', 'speed-graph', 'plant-parts',
  'seed-to-plant', 'butterfly-cycle', 'grasshopper-cycle', 'frog-cycle', 'food-chain-florida', 'food-web-estuary',
  'beak-shapes', 'seasons-florida-north', 'environment-change', 'inherited-learned',
] as const

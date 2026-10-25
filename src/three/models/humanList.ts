// Organ list without any three imports, so HUD code can use it without pulling in 3D chunks.
export const ORGAN_LIST: { id: string; label: string; tint: string; kind: 'organ' | 'sense' }[] = [
  { id: 'brain', label: 'Brain', tint: '#CC79A7', kind: 'organ' },
  { id: 'heart', label: 'Heart', tint: '#D55E00', kind: 'organ' },
  { id: 'lungs', label: 'Lungs', tint: '#56B4E9', kind: 'organ' },
  { id: 'stomach', label: 'Stomach', tint: '#E69F00', kind: 'organ' },
  { id: 'liver', label: 'Liver', tint: '#009E73', kind: 'organ' },
  { id: 'pancreas', label: 'Pancreas', tint: '#CC79A7', kind: 'organ' },
  { id: 'small-intestine', label: 'Small intestine', tint: '#0072B2', kind: 'organ' },
  { id: 'large-intestine', label: 'Large intestine', tint: '#F0E442', kind: 'organ' },
  { id: 'kidneys', label: 'Kidneys', tint: '#D55E00', kind: 'organ' },
  { id: 'bladder', label: 'Bladder', tint: '#56B4E9', kind: 'organ' },
  { id: 'skin', label: 'Skin', tint: '#3ee6ff', kind: 'organ' },
  { id: 'eyes', label: 'Eyes', tint: '#F0E442', kind: 'sense' },
  { id: 'ears', label: 'Ears', tint: '#E69F00', kind: 'sense' },
  { id: 'nose', label: 'Nose', tint: '#009E73', kind: 'sense' },
  { id: 'tongue', label: 'Tongue', tint: '#D55E00', kind: 'sense' },
]


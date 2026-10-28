import { describe, expect, it } from 'vitest'
import { audioBlock, type AudioGate } from './policy'
import { CUE_LENGTH_S } from './sfx'

function gate(patch: Partial<AudioGate> = {}): AudioGate {
  return {
    sound: true,
    search: '',
    hidden: false,
    gestured: true,
    teacher: false,
    cue: 'press',
    ...patch,
  }
}

describe('audio gate', () => {
  it('allows a cue after a gesture when sound is on', () => {
    expect(audioBlock(gate())).toBeNull()
  })

  it('blocks every cue before the first gesture', () => {
    expect(audioBlock(gate({ gestured: false }))).toBe('no-gesture')
    expect(audioBlock(gate({ gestured: false, cue: 'solved', bypassSound: true }))).toBe('no-gesture')
  })

  it('blocks when sound is off, unless the toggle tick is bypassing that flag', () => {
    expect(audioBlock(gate({ sound: false }))).toBe('sound-off')
    expect(audioBlock(gate({ sound: false, bypassSound: true }))).toBeNull()
  })

  it('?still=1 plays nothing, even over mute, a gesture, and the toggle bypass', () => {
    expect(audioBlock(gate({ search: '?still=1' }))).toBe('still')
    expect(audioBlock(gate({ search: '?tier=high&still=1' }))).toBe('still')
    expect(audioBlock(gate({ search: 'still=1' }))).toBe('still')
    expect(audioBlock(gate({ search: '?still=1&mute=1', bypassSound: true, cue: 'toggle' }))).toBe('still')
  })

  it('?mute=1 plays nothing', () => {
    expect(audioBlock(gate({ search: '?mute=1' }))).toBe('mute')
    expect(audioBlock(gate({ search: '?mute=1', bypassSound: true }))).toBe('mute')
    expect(audioBlock(gate({ search: '?mute=0' }))).toBeNull()
  })

  it('blocks while the tab is hidden', () => {
    expect(audioBlock(gate({ hidden: true }))).toBe('hidden')
  })

  it('lets the teacher page play button presses only', () => {
    expect(audioBlock(gate({ teacher: true, cue: 'press' }))).toBeNull()
    expect(audioBlock(gate({ teacher: true, cue: 'hover' }))).toBe('teacher')
    expect(audioBlock(gate({ teacher: true, cue: 'correct' }))).toBe('teacher')
    expect(audioBlock(gate({ teacher: true, cue: 'ambient' }))).toBe('teacher')
    expect(audioBlock(gate({ teacher: true, cue: 'whoosh' }))).toBe('teacher')
  })

  it('does not treat reduced motion as a reason to stay quiet', () => {
    expect(audioBlock(gate({ reducedMotion: true }))).toBeNull()
    expect(audioBlock(gate({ reducedMotion: false }))).toBeNull()
  })
})

describe('cue lengths', () => {
  it('keeps the case-solved stinger at a second and a half', () => {
    expect(CUE_LENGTH_S.solved).toBe(1.5)
    expect(CUE_LENGTH_S.hover).toBeLessThan(0.05)
    expect(CUE_LENGTH_S.whoosh).toBeLessThan(0.5)
    expect(CUE_LENGTH_S.scan).toBeGreaterThan(CUE_LENGTH_S.whoosh)
  })
})

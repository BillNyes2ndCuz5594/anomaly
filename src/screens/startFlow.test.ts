import { describe, expect, it } from 'vitest'
import { validCaseId } from '../state/startChoice'
import { playLabel, shortTopic, startDestination } from './startFlow'

describe('startFlow', () => {
  it('returns destination based on intent and caseId', () => {
    expect(startDestination('play', '04-1')).toBe('/case/04-1')
    expect(startDestination('browse', '04-1')).toBe('/hub')
  })

  it('formats play label from unit label', () => {
    expect(playLabel({ unitLabel: 'Unit 4: Matter' })).toBe('Play Unit 4: Matter')
  })

  it('extracts short topic after the first colon', () => {
    expect(shortTopic('Unit 4: Matter')).toBe('Matter')
    expect(shortTopic("Unit 7: Earth's Processes and Resources")).toBe("Earth's Processes and Resources")
    expect(shortTopic('Matter')).toBe('Matter')
  })

  it('falls back to 04-1 for invalid saved id via validCaseId', () => {
    const knownCases = ['04-1', '05-1', '06-1']
    expect(validCaseId('nonexistent-case', knownCases)).toBe('04-1')
    expect(validCaseId(null, knownCases)).toBe('04-1')
    expect(validCaseId(undefined, knownCases)).toBe('04-1')
  })
})

import type { Item } from '../../content/schema'
import { tokenizeStem } from '../../lib/rkea'

const LETTERS = ['A', 'B', 'C', 'D']

export function formatVisualDescription(item: Item): string {
  const parts: string[] = []
  if (item.alt?.trim()) {
    parts.push(item.alt.trim().replace(/\.+$/, ''))
  }
  const v = item.visual
  if (v.kind === 'table') {
    if (v.title && !item.alt?.includes(v.title)) {
      parts.push(v.title.trim().replace(/\.+$/, ''))
    }
    for (const row of v.rows) {
      // Pair each cell with its column heading so a listener knows what each value means.
      const cells = row.map((cell, j) => (v.columns[j] ? `${v.columns[j]}: ${cell}` : cell))
      parts.push(cells.join(', ').replace(/\.+$/, ''))
    }
  } else if (v.kind === 'specimen') {
    if (v.captions?.length) {
      parts.push(v.captions.join(', ').replace(/\.+$/, ''))
    }
  } else if (v.kind === 'plantanimal') {
    if (v.show?.length) {
      parts.push(v.show.join(', ').replace(/\.+$/, ''))
    }
  } else if (v.kind === 'scene') {
    if (v.labels?.length) {
      parts.push(v.labels.join(', ').replace(/\.+$/, ''))
    }
  }
  return parts.length ? parts.join('. ') + '.' : ''
}

export interface QuestionSpeech {
  text: string
  stemStarts: number[]
  optStarts: number[]
  stemLen: number
}

export function buildQuestionSpeech(item: Item, tokens?: string[]): QuestionSpeech {
  const wordTokens = tokens ?? tokenizeStem(item.stem)
  const stemText = wordTokens.join(' ')
  const stemStarts: number[] = []
  let off = 0
  wordTokens.forEach((t) => {
    stemStarts.push(off)
    off += t.length + 1
  })

  const visualDesc = formatVisualDescription(item)
  let text = stemText
  if (visualDesc) {
    text += ` ${visualDesc}`
  }

  const optStarts: number[] = []
  item.options.forEach((o, i) => {
    text += ' '
    optStarts.push(text.length)
    text += `${LETTERS[i]}. ${o}.`
  })

  return { text, stemStarts, optStarts, stemLen: stemText.length }
}

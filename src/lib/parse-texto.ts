export type TextoBlock =
  | { kind: 'chapter'; chapter: number; label: string }
  | { kind: 'verse'; id: string; chapter: number; verse: number; text: string }

/** Parse NAA plain text: "Capítulo N" headers + "N verse text" lines. */
export function parseTexto(raw: string): TextoBlock[] {
  const blocks: TextoBlock[] = []
  let chapter = 0
  let orphan = 0

  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t) continue

    const ch = /^Capítulo\s+(\d+)\s*$/i.exec(t)
    if (ch) {
      chapter = Number(ch[1])
      blocks.push({ kind: 'chapter', chapter, label: t })
      continue
    }

    const v = /^(\d+)\s+(.+)$/.exec(t)
    if (v) {
      const verse = Number(v[1])
      const id = chapter ? `${chapter}:${verse}` : `0:${verse}`
      blocks.push({ kind: 'verse', id, chapter, verse, text: v[2] })
      continue
    }

    orphan += 1
    blocks.push({
      kind: 'verse',
      id: `x:${orphan}`,
      chapter,
      verse: 0,
      text: t,
    })
  }

  return blocks
}

export type VerseBlock = Extract<TextoBlock, { kind: 'verse' }>

export type CorridoGroup = {
  chapter: number
  label: string | null
  verses: VerseBlock[]
}

/** Um grupo fluido por capítulo, para o modo de leitura corrido. */
export function groupCorrido(blocks: TextoBlock[]): CorridoGroup[] {
  const groups: CorridoGroup[] = []
  let current: CorridoGroup | null = null
  for (const b of blocks) {
    if (b.kind === 'chapter') {
      current = { chapter: b.chapter, label: b.label, verses: [] }
      groups.push(current)
    } else {
      if (!current) {
        current = { chapter: b.chapter, label: null, verses: [] }
        groups.push(current)
      }
      current.verses.push(b)
    }
  }
  return groups
}

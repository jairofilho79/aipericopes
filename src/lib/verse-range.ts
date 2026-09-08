import type { TextoBlock, VerseBlock } from './parse-texto'
import type { Pericope } from './types'

export type VerseSelection = { start: string; end: string }

/** "capitulo:versiculo". Versículos órfãos do parser usam "x:N" e ficam de fora
 * dos rótulos/vínculos — mas continuam entrando na seleção para copiar o texto. */
const VERSE_ID = /^\d+:\d+$/

/** Todos os versículos entre dois ids, na ordem dos blocos (inclusive
 * atravessando capítulos). Ids invertidos são normalizados; id inexistente
 * devolve lista vazia. */
export function versesInRange(
  blocks: TextoBlock[],
  startId: string,
  endId: string,
): VerseBlock[] {
  const verses = blocks.filter((b): b is VerseBlock => b.kind === 'verse')
  const a = verses.findIndex((v) => v.id === startId)
  const b = verses.findIndex((v) => v.id === endId)
  if (a === -1 || b === -1) return []
  const [from, to] = a <= b ? [a, b] : [b, a]
  return verses.slice(from, to + 1)
}

/** Vínculo persistido de uma anotação: "c:v" ou "c:v-c:v". */
export function rangeRef(verses: VerseBlock[]): string | null {
  const uteis = verses.filter((v) => VERSE_ID.test(v.id))
  if (uteis.length === 0) return null
  const first = uteis[0]
  const last = uteis[uteis.length - 1]
  return first.id === last.id ? first.id : `${first.id}-${last.id}`
}

export function parseVerseRef(verseRef: string): VerseSelection | null {
  const parts = verseRef.split('-')
  if (parts.length === 1 && VERSE_ID.test(parts[0])) return { start: parts[0], end: parts[0] }
  if (parts.length === 2 && VERSE_ID.test(parts[0]) && VERSE_ID.test(parts[1])) {
    return { start: parts[0], end: parts[1] }
  }
  return null
}

/** "Gn 1:3", "Gn 1:3–7", "Gn 1:30–2:2" (travessão, não hífen). */
export function verseRefLabel(abbrev: string, verseRef: string): string {
  const parsed = parseVerseRef(verseRef)
  if (!parsed) return verseRef
  const [c1, v1] = parsed.start.split(':')
  const [c2, v2] = parsed.end.split(':')
  if (parsed.start === parsed.end) return `${abbrev} ${c1}:${v1}`
  if (c1 === c2) return `${abbrev} ${c1}:${v1}–${v2}`
  return `${abbrev} ${c1}:${v1}–${c2}:${v2}`
}

export function rangeLabel(p: Pericope, verses: VerseBlock[]): string {
  const ref = rangeRef(verses)
  if (!ref) return p.abbrev
  return verseRefLabel(p.abbrev, ref)
}

/**
 * Transição de seleção a cada toque num versículo:
 * sem seleção → só ele; fora da seleção → estende o intervalo; dentro de um
 * intervalo → recolhe para ele; no único selecionado → desseleciona (null).
 */
export function nextSelection(
  blocks: TextoBlock[],
  atual: VerseSelection | null,
  id: string,
): VerseSelection | null {
  const existe = blocks.some((b) => b.kind === 'verse' && b.id === id)
  if (!existe) return atual
  if (!atual) return { start: id, end: id }
  const dentro = versesInRange(blocks, atual.start, atual.end)
  // Seleção órfã (restaurada de outra perícope): recomeça neste versículo.
  if (dentro.length === 0) return { start: id, end: id }
  if (dentro.some((v) => v.id === id)) {
    return dentro.length === 1 ? null : { start: id, end: id }
  }
  return { start: atual.start, end: id }
}

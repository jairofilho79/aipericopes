/**
 * Limites reais de uma perícope do dataset bruto.
 *
 * O dataset traz `Reference Start`/`Reference End` E a lista `Verses`. Em 16 das
 * 2647 linhas os dois discordam, e quem tem razão é a lista: ela é o texto que a
 * perícope de fato agrupa. Confiar no campo declarado deixava 27 versículos fora
 * de qualquer perícope (Êx 6:28-30, Dt 1:5-8, 1Rs 8:62-66, Is 55:9-13, …),
 * criava uma sobreposição em Nm 16:28-37 e gravava um range inexistente
 * (João 18:41, num capítulo de 40 versículos).
 */
import { parseReference, type ParsedRef } from './book-map.ts'

export type BoundsRow = {
  'Reference Start': string
  'Reference End': string
  Verses?: { Reference: string }[]
}

export type Bounds = {
  start: ParsedRef
  end: ParsedRef
  /** true quando a lista de versículos discordou do campo declarado. */
  corrigido: boolean
}

export function resolveBounds(row: BoundsRow): Bounds {
  const declStart = row['Reference Start']
  const declEnd = row['Reference End']
  const verses = row.Verses ?? []

  if (verses.length === 0) {
    return {
      start: parseReference(declStart),
      end: parseReference(declEnd),
      corrigido: false,
    }
  }

  const realStart = verses[0].Reference.trim()
  const realEnd = verses[verses.length - 1].Reference.trim()

  return {
    start: parseReference(realStart),
    end: parseReference(realEnd),
    corrigido: realStart !== declStart.trim() || realEnd !== declEnd.trim(),
  }
}

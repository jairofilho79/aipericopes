import { refLabel } from './content'
import { marcarTrecho, type FulltextHit } from './fulltext'
import type { PericopeIndex } from './types'

export type ItemPericope = {
  ordem: number
  titulo: string
  ref: string
  /** "capitulo:versiculo" para o deep-link `?v=` da Leitura; ausente fora da busca no texto. */
  verseId?: string
  /** Trecho já partido para o <mark>, por `marcarTrecho`. */
  trecho?: { antes: string; marcado: string; depois: string }
}

export function itemDeIndice(p: PericopeIndex): ItemPericope {
  return { ordem: p.ordem, titulo: p.titulo_pericope_pt, ref: refLabel(p) }
}

/** Segundo construtor de `ItemPericope`, para os hits da busca no texto —
 *  ao lado de `itemDeIndice` em vez de inline na página, mesmo critério de
 *  `src/lib/perfil-secoes.ts` para lógica pura. */
export function itemDeHit(h: FulltextHit, termo: string): ItemPericope {
  return {
    ordem: h.ordem,
    titulo: h.titulo,
    ref: h.refLabel,
    verseId: h.verseId || undefined,
    trecho: marcarTrecho(h.snippet, termo),
  }
}

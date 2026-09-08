import type { BibleBook } from './bible-books'
import type { FiltroLeitura } from './content'
import type { Testament } from './testament'

export type Grupo = {
  testament: Testament
  secoes: { secao: string; livros: BibleBook[] }[]
}

/** Agrupa mantendo a ordem canônica recebida: seções nascem por transição,
 *  não por ordenação, então a lista nunca é reordenada por baixo do leitor. */
export function agruparLivros(livros: BibleBook[]): Grupo[] {
  const out: Grupo[] = []
  for (const t of ['vt', 'nt'] as const) {
    const doTestamento = livros.filter((b) => b.testament === t)
    if (!doTestamento.length) continue
    const secoes: Grupo['secoes'] = []
    for (const b of doTestamento) {
      const ultima = secoes[secoes.length - 1]
      if (ultima && ultima.secao === b.section) ultima.livros.push(b)
      else secoes.push({ secao: b.section, livros: [b] })
    }
    out.push({ testament: t, secoes })
  }
  return out
}

/** O número à direita da linha. Zero é informação boa ("terminei"), então o
 *  livro fica com "0" em vez de sumir da lista.
 *
 *  Recebe o mínimo estrutural (não `LivroProgresso` inteiro) porque
 *  `CatalogoRegistros` chama isto com `RegistroProgresso` — outro formato,
 *  mesmos dois campos que a função de fato usa. */
export function rotuloContagem(
  filtro: FiltroLeitura,
  prog: { concluidas: number; total: number } | undefined,
  noRecorte: number,
): string {
  if (filtro === 'todos') return `${prog?.concluidas ?? 0} de ${prog?.total ?? 0}`
  if (noRecorte === 0) return '0'
  return filtro === 'nao-lidos' ? `restam ${noRecorte}` : String(noRecorte)
}

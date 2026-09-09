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

function pericopes(n: number): string {
  return `${n} perícope${n === 1 ? '' : 's'}`
}

/** A linha secundária da linha de catálogo: a mesma contagem que ficava ao
 *  lado da barra, agora como frase — o número cru não dizia de quê. Zero é
 *  informação boa ("concluído", "nenhuma lida ainda"), então o livro fala em
 *  vez de sumir da lista.
 *
 *  Recebe o mínimo estrutural (não `LivroProgresso` inteiro) porque
 *  `CatalogoRegistros` chama isto com `RegistroProgresso` — outro formato,
 *  mesmos dois campos que a função de fato usa. */
export function fraseContagem(
  filtro: FiltroLeitura,
  prog: { concluidas: number; total: number } | undefined,
  noRecorte: number,
): string {
  if (filtro === 'todos') {
    // Aqui o recorte nunca zera (aceita tudo); o que zera é a leitura.
    const concluidas = prog?.concluidas ?? 0
    if (concluidas === 0) return 'nenhuma lida ainda'
    return `${concluidas} de ${pericopes(prog?.total ?? 0)}`
  }
  if (noRecorte === 0) {
    if (filtro === 'nao-lidos') return 'concluído'
    return filtro === 'comecei' ? 'nada em andamento' : 'nenhuma lida ainda'
  }
  const um = noRecorte === 1
  if (filtro === 'nao-lidos') return `${um ? 'resta' : 'restam'} ${pericopes(noRecorte)}`
  return filtro === 'comecei' ? `${noRecorte} em andamento` : `${noRecorte} lida${um ? '' : 's'}`
}

/**
 * Onde cada letrinha de referência cruzada cai dentro do TEXTO de um versículo.
 *
 * A posição vem do shard como "quantas palavras vêm antes" e usa a mesma
 * tokenização de `tokens()` (`split(' ')`), a que a narração também usa. Daqui
 * sai o deslocamento em caracteres, para o texto sem narração ser fatiado, e o
 * índice da palavra, para o texto em narração (um span por palavra).
 */

export type Chamada = {
  letra: string
  /** Palavras antes da letrinha; null = sem ponto (a nota não aparece no texto). */
  posicao: number | null
}

/** Chamada já resolvida para um deslocamento em caracteres do texto do versículo. */
export type PontoDeChamada = { offset: number; letra: string }

/** Palavra depois da qual a letrinha fica (-1 = antes da primeira). */
export function palavraAnterior(posicao: number, totalPalavras: number): number {
  return Math.min(Math.max(posicao, 0), totalPalavras) - 1
}

/**
 * Deslocamento, em caracteres, do FIM da palavra anterior à letrinha — colada na
 * palavra, antes do espaço, como a letrinha sobrescrita da Bíblia impressa.
 */
export function pontosDeChamada(texto: string, chamadas: Chamada[] | undefined): PontoDeChamada[] {
  if (!chamadas?.length) return []
  const palavras = texto.split(' ')
  const fins: number[] = []
  let acc = 0
  for (const palavra of palavras) {
    acc += palavra.length
    fins.push(acc)
    acc += 1 // o espaço
  }
  const pontos: PontoDeChamada[] = []
  for (const c of chamadas) {
    if (c.posicao === null) continue
    const idx = palavraAnterior(c.posicao, palavras.length)
    pontos.push({ offset: idx < 0 ? 0 : fins[idx], letra: c.letra })
  }
  // Ordem estável: notas no mesmo ponto saem na ordem em que vieram (a, b…).
  return pontos.sort((a, b) => a.offset - b.offset)
}

/** Índice de palavra → letras que ficam logo depois dela (-1 = antes da primeira). */
export function chamadasPorPalavra(
  totalPalavras: number,
  chamadas: Chamada[] | undefined,
): Map<number, string[]> {
  const mapa = new Map<number, string[]>()
  for (const c of chamadas ?? []) {
    if (c.posicao === null) continue
    const idx = palavraAnterior(c.posicao, totalPalavras)
    mapa.set(idx, [...(mapa.get(idx) ?? []), c.letra])
  }
  return mapa
}

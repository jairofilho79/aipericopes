import type { PosicaoLeitura, PosicaoTipo } from './types'

/** As quatro sections com id próprio no DOM da Leitura. */
const SECOES = new Set(['contexto', 'texto', 'resenha', 'reflexao'])

type Alvo = Pick<PosicaoLeitura, 'ref'> & { tipo: PosicaoTipo }

/**
 * O seletor do elemento a rolar até: sections ancoram pelo id; qualquer outra
 * unidade (versículo, parágrafo, título narrado) vive em data-verse-id ou
 * data-fala-id — o mesmo par que o acompanhamento da narração já consulta.
 */
export function seletorDaPosicao({ ref }: Alvo): string {
  if (SECOES.has(ref)) return `#${ref}`
  return `[data-verse-id="${ref}"], [data-fala-id="${ref}"]`
}

/** O checkpoint aponta para dentro do Contexto? Então a seção colapsada precisa abrir antes de rolar. */
export function refNoContexto(ref: string): boolean {
  return ref === 'contexto' || ref === 'cabecalho-contexto' || ref.startsWith('contexto-')
}

/** Seção inteira alinha no topo (como os chips fazem); unidade fina centraliza. */
export function blocoDeRolagem(alvo: Alvo): ScrollLogicalPosition {
  return SECOES.has(alvo.ref) ? 'start' : 'center'
}

/**
 * Fração da perícope já percorrida pelo scroll, 0..1 — alimenta a barra de
 * progresso do header. Página que cabe inteira na viewport conta como lida.
 */
export function fracaoLida(scrollY: number, innerHeight: number, scrollHeight: number): number {
  const percorrivel = scrollHeight - innerHeight
  if (percorrivel <= 0) return 1
  return Math.min(1, Math.max(0, scrollY / percorrivel))
}

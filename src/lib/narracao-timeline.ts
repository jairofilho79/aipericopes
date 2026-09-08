import type { Alinhamento, AlvoAlinhado } from './alinhar-narracao'

type Janela = { inicio: number; fim: number }

function dentro(j: Janela | undefined, t: number): boolean {
  return !!j && t >= j.inicio && t < j.fim
}

/**
 * Índice da janela que contém `t`, ou -1. `dica` é o último índice conhecido:
 * o `timeupdate` anda para frente quase sempre, então tentar `dica` e a
 * seguinte resolve o caso comum em duas comparações; a binária cobre o seek.
 */
function buscar(janelas: readonly Janela[], t: number, dica: number): number {
  if (dentro(janelas[dica], t)) return dica
  if (dentro(janelas[dica + 1], t)) return dica + 1

  let lo = 0
  let hi = janelas.length - 1
  while (lo <= hi) {
    const meio = (lo + hi) >> 1
    const j = janelas[meio]!
    if (t < j.inicio) hi = meio - 1
    else if (t >= j.fim) lo = meio + 1
    else return meio
  }
  return -1
}

/** Qual alvo está em fala em `t`. -1 nos vãos (cabeçalho falado, silêncio). */
export function indiceEm(alinhamento: Alinhamento, t: number, dica: number): number {
  return buscar(alinhamento, t, dica)
}

/** Qual palavra do alvo está em fala em `t`. -1 se `t` está fora do alvo. */
export function indiceDaPalavra(alvo: AlvoAlinhado, t: number, dica: number): number {
  return buscar(alvo.palavras, t, dica)
}

import type { Progresso } from './types'

/**
 * Depois de um ano sem reler, a perícope volta para "Vale reler". Limiar
 * ÚNICO, de propósito: não cresce com as releituras. Ler três vezes não afasta
 * da fila — o esquecimento não é mérito.
 */
export const DIAS_ESQUECIMENTO = 365

const MS_POR_DIA = 86_400_000

export type CandidatoReler = {
  ordem: number
  /** Conclusão mais recente; null só em linha corrompida. */
  ultima: string | null
  vezes: number
  paraReler: boolean
  /** Dias inteiros desde `ultima`; 0 quando não há data. */
  dias: number
}

/**
 * As perícopes que vale reler, já ordenadas: o pin manual primeiro, depois da
 * mais esquecida para a menos, desempatando pela menos lida.
 *
 * Função pura sobre as linhas — nenhum acesso a storage, nenhum `Date.now()`
 * escondido. Duas fontes que se somam: `paraReler` (curadoria) e o decay
 * (tempo). Ambas exigem `status === 'concluido'`: o que não consta como lido
 * não é releitura, é leitura.
 */
export function candidatosReler(progressos: Progresso[], agora: Date): CandidatoReler[] {
  const out: CandidatoReler[] = []
  for (const p of progressos) {
    if (p.status !== 'concluido') continue
    const ultima = p.historico[0] ?? null
    const t = ultima === null ? Number.NaN : Date.parse(ultima)
    const dias = Number.isNaN(t) ? 0 : Math.floor((agora.getTime() - t) / MS_POR_DIA)
    if (!p.paraReler && dias <= DIAS_ESQUECIMENTO) continue
    out.push({ ordem: p.pericopeOrdem, ultima, vezes: p.historico.length, paraReler: p.paraReler, dias })
  }
  return out.sort(
    (a, b) =>
      Number(b.paraReler) - Number(a.paraReler) || b.dias - a.dias || a.vezes - b.vezes,
  )
}

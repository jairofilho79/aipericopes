import type { Progresso } from './types'
import { getProgresso, listAllProgresso } from './user-db'

/**
 * O predicado, um só: "existe uma conclusão desta perícope com timestamp
 * >= `desde`" (`desde` null = qualquer conclusão conta).
 *
 * É o SEAM entre este modelo e a feature de jornadas, que consome só isto e
 * nunca toca no formato de armazenamento de `progresso`. Quando a linha ganhar
 * `historico`, é o corpo desta função que muda — e só ele.
 *
 * Exige `status === 'concluido'` além da data: desmarcar significa "não consta
 * mais como lida", e a jornada regride junto. Quem quer revisitar sem regredir
 * usa "marcar para reler".
 *
 * Comparação lexicográfica de ISO, a mesma convenção de `remoteWinsLocal`
 * (sync-merge.ts) e `getPosicaoMaisRecente` (user-db.ts).
 */
export function contaComoLida(p: Progresso | undefined, desde: string | null): boolean {
  if (!p || p.status !== 'concluido') return false
  // historico[0] é a conclusão mais nova, logo o máximo: "existe conclusão
  // >= desde" é exatamente `historico[0] >= desde`, e continua O(1).
  const ultima = p.historico[0]
  if (ultima === undefined) return false
  return desde === null || ultima >= desde
}

export async function concluidaDesde(ordem: number, desde: string | null): Promise<boolean> {
  return contaComoLida(await getProgresso(ordem), desde)
}

/**
 * Versão em lote. Uma jornada da Bíblia inteira são 2.647 ordens: faz UMA
 * leitura do store e filtra em memória, nunca N consultas.
 *
 * Devolve Set e não contagem porque quem chama precisa das duas coisas —
 * `.size` para a barra, `.has(ordem)` para o cursor — e elas não podem
 * divergir.
 */
export async function concluidasDesde(
  ordens: number[],
  desde: string | null,
): Promise<Set<number>> {
  const alvo = new Set(ordens)
  const out = new Set<number>()
  if (alvo.size === 0) return out
  for (const p of await listAllProgresso()) {
    if (alvo.has(p.pericopeOrdem) && contaComoLida(p, desde)) out.add(p.pericopeOrdem)
  }
  return out
}

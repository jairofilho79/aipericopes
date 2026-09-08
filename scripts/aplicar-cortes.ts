/**
 * Monta a ordem de leitura do catálogo depois do recorte.
 *
 * O problema que isto resolve: `ordem` acumulava identidade E posição de
 * leitura, e o catálogo era ordenado por ela. Inserir perícope no meio exigiria
 * renumerar — o que troca a chave de `progresso`, `anotacoes`, `destaques`,
 * `posicao_leitura`, `jornada.inicio_ordem` e o áudio no R2 (`nt-ml/<ordem>.m4a`).
 *
 * Separação: `ordem` vira ID estável e opaco; `seq` passa a ser a posição de
 * leitura. Nenhuma `ordem` existente muda. As novas entram com `ordem >= 3000`
 * na POSIÇÃO CANÔNICA — onde estava a perícope que elas substituem.
 */

export type Basica = {
  ordem: number
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
}

export type Nova = Basica & { substitui: number }

const ponto = (c: number, v: number) => c * 100_000 + v

/**
 * Devolve as perícopes na ordem de leitura: as existentes na ordem em que já
 * estavam, com as substituídas trocadas pelas novas no mesmo lugar.
 *
 * Nunca renumera, nunca anexa no fim, e é determinístico — as novas de um mesmo
 * bloco saem ordenadas por capítulo:versículo, não pela ordem em que chegaram.
 */
export function ordenarParaLeitura<E extends Basica, N extends Nova>(
  existentes: E[],
  novas: N[],
): (E | N)[] {
  const porSubstituida = new Map<number, N[]>()
  for (const n of novas) {
    const g = porSubstituida.get(n.substitui)
    if (g) g.push(n)
    else porSubstituida.set(n.substitui, [n])
  }
  for (const g of porSubstituida.values()) {
    g.sort((a, b) => ponto(a.capitulo_inicio, a.versiculo_inicio) - ponto(b.capitulo_inicio, b.versiculo_inicio))
  }

  const out: (E | N)[] = []
  for (const e of existentes) {
    const troca = porSubstituida.get(e.ordem)
    if (troca) out.push(...troca)
    else out.push(e)
  }

  // Uma `substitui` que não casa com nenhuma existente significa tabela de
  // cortes desatualizada — silenciar isso perderia perícopes sem aviso.
  const usadas = new Set(existentes.map((e) => e.ordem))
  const orfas = [...porSubstituida.keys()].filter((o) => !usadas.has(o))
  if (orfas.length) {
    throw new Error(`novas apontam para ordens que não existem no catálogo: ${orfas.join(', ')}`)
  }
  return out
}

/** Atribui `seq` denso a partir da posição. Não toca em `ordem`. */
export function atribuirSeq<T>(lista: T[]): (T & { seq: number })[] {
  return lista.map((p, i) => ({ ...p, seq: i }))
}

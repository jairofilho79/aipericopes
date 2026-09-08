import type { PericopeIndex } from './types'

export type Registro = { slug: string; nome: string; ordens: number[] }

export type RegistroProgresso = {
  slug: string
  total: number
  concluidas: number
  /** 0–100, arredondado. */
  pct: number
}

type RegistrosJson = {
  nomes: Record<string, string>
  registros: Record<string, number[]>
}

let registros: Registro[] | null = null
let carregando: Promise<Registro[]> | null = null

/**
 * Carrega e cacheia `public/data/registros.json`, no mesmo padrão de
 * `loadIndex` em content.ts: promessa compartilhada entre chamadas
 * concorrentes, e o cache só é preenchido depois que a resposta chegou ok —
 * uma falha de rede não pode grudar no módulo e condenar todas as chamadas
 * seguintes.
 *
 * Ordenado por `ordens.length` decrescente: é a ordem em que o catálogo de
 * registros mostra maiores primeiro.
 */
export async function loadRegistros(): Promise<Registro[]> {
  if (registros) return registros
  if (carregando) return carregando
  carregando = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/registros.json`)
    if (!res.ok) throw new Error('Falha ao carregar os registros')
    const json = (await res.json()) as RegistrosJson
    const out = Object.entries(json.registros).map(([slug, ordens]) => ({
      slug,
      nome: json.nomes[slug],
      ordens,
    }))
    out.sort((a, b) => b.ordens.length - a.ordens.length)
    registros = out
    carregando = null
    return registros
  })().catch((err: unknown) => {
    carregando = null
    throw err
  })
  return carregando
}

export function registroPorSlug(regs: Registro[], slug: string): Registro | undefined {
  return regs.find((r) => r.slug === slug)
}

/** Progresso REAL de cada registro — nunca obedece ao recorte de leitura:
 *  soma sobre `ordens` inteiro, não sobre um subconjunto filtrado. */
export function progressoPorRegistro(
  regs: Registro[],
  concluidas: Set<number>,
): Map<string, RegistroProgresso> {
  const out = new Map<string, RegistroProgresso>()
  for (const r of regs) {
    const total = r.ordens.length
    let done = 0
    for (const ordem of r.ordens) {
      if (concluidas.has(ordem)) done += 1
    }
    out.set(r.slug, {
      slug: r.slug,
      total,
      concluidas: done,
      pct: total ? Math.round((done / total) * 100) : 0,
    })
  }
  return out
}

/**
 * Quantas perícopes de cada registro sobrevivem ao recorte. Todo registro
 * entra no mapa, inclusive com zero — pelo mesmo motivo que `contagemPorLivro`
 * documenta: sumir da tela conforme se lê desorienta.
 */
export function contagemPorRegistro(
  regs: Registro[],
  aceita: (ordem: number) => boolean,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of regs) {
    let count = 0
    for (const ordem of r.ordens) {
      if (aceita(ordem)) count += 1
    }
    out.set(r.slug, count)
  }
  return out
}

/**
 * Agrupa por TRANSIÇÃO de `livro`, não por Map — a lista já chega na ordem
 * de leitura e reagrupar por chave produziria duas seções com o mesmo nome
 * ou reordenaria o catálogo. Mesmo motivo de `agruparLivros` em catalogo.ts.
 */
export function agruparPorLivro(
  itens: PericopeIndex[],
): { livro: string; itens: PericopeIndex[] }[] {
  const out: { livro: string; itens: PericopeIndex[] }[] = []
  for (const p of itens) {
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.livro === p.livro) ultimo.itens.push(p)
    else out.push({ livro: p.livro, itens: [p] })
  }
  return out
}

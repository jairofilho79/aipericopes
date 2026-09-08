import type { Pericope, PericopeIndex, Progresso, ProgressoStatus } from './types'
import { testamentOf, type Testament } from './testament'
import { livroSlug } from './livro-slug'
import { carregarEstudo, carregarTexto } from './shards'

let indice: PericopeIndex[] | null = null
let carregando: Promise<PericopeIndex[]> | null = null

/**
 * Índice de metadados: ~480 KB que destravam Home, Índice e Pesquisa por
 * referência. O conteúdo pesado vem depois, por livro (shards.ts).
 *
 * Chamadas concorrentes compartilham a mesma promessa — três telas montando
 * juntas não podem virar três downloads.
 */
export async function loadIndex(): Promise<PericopeIndex[]> {
  if (indice) return indice
  if (carregando) return carregando
  carregando = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/index.json`)
    if (!res.ok) throw new Error('Falha ao carregar o índice de perícopes')
    indice = (await res.json()) as PericopeIndex[]
    carregando = null
    return indice
  })().catch((err: unknown) => {
    carregando = null
    throw err
  })
  return carregando
}

export async function listPericopes(opts?: {
  livro?: string
  q?: string
  testament?: Testament
}): Promise<PericopeIndex[]> {
  let list = await loadIndex()
  if (opts?.testament) list = list.filter((p) => testamentOf(p) === opts.testament)
  if (opts?.livro) list = list.filter((p) => p.livro === opts.livro)
  if (opts?.q) {
    // Só o TÍTULO. A cláusula de livro despejaria as 85 perícopes de João no
    // meio dos 124 títulos que mencionam João, e a de "cap:ver" era substring
    // sobre o início da perícope — "3:16" casava 13:16 e 23:16.
    const q = opts.q.toLowerCase()
    list = list.filter((p) => p.titulo_pericope_pt.toLowerCase().includes(q))
  }
  return list
}

export async function getPericope(ordem: number): Promise<Pericope | undefined> {
  const meta = (await loadIndex()).find((p) => p.ordem === ordem)
  if (!meta) return undefined
  const slug = livroSlug(meta.livro)
  // Os dois shards do livro em paralelo: são requisições de usuário, não de
  // fundo, e a leitura só desenha com as duas.
  const [texto, estudo] = await Promise.all([carregarTexto(slug), carregarEstudo(slug)])
  const bloco = estudo.get(ordem)
  const corpo = texto.get(ordem)
  if (bloco === undefined || corpo === undefined) return undefined
  return { ...meta, ...corpo, ...bloco }
}

export async function listLivros(testament?: Testament): Promise<string[]> {
  const list = testament ? await listPericopes({ testament }) : await loadIndex()
  const seen = new Set<string>()
  const books: string[] = []
  for (const p of list) {
    if (!seen.has(p.livro)) {
      seen.add(p.livro)
      books.push(p.livro)
    }
  }
  return books
}

export function refLabel(p: PericopeIndex): string {
  if (p.capitulo_inicio === p.capitulo_fim && p.versiculo_inicio === p.versiculo_fim) {
    return `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}`
  }
  return `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}–${p.capitulo_fim}:${p.versiculo_fim}`
}

export function ordensDoTestamento(all: PericopeIndex[], t: Testament): number[] {
  return all.filter((p) => testamentOf(p) === t).map((p) => p.ordem)
}

export function proximaNoTestamento(all: PericopeIndex[], ordem: number): number | null {
  const found = all.find((p) => p.ordem === ordem)
  if (!found) return null
  const seq = ordensDoTestamento(all, testamentOf(found))
  const i = seq.indexOf(ordem)
  if (i < 0 || i >= seq.length - 1) return null
  return seq[i + 1]
}

export function anteriorNoTestamento(all: PericopeIndex[], ordem: number): number | null {
  const found = all.find((p) => p.ordem === ordem)
  if (!found) return null
  const seq = ordensDoTestamento(all, testamentOf(found))
  const i = seq.indexOf(ordem)
  if (i <= 0) return null
  return seq[i - 1]
}

function matchesBook(p: PericopeIndex, livroOrAbbrev: string): boolean {
  return p.livro === livroOrAbbrev || p.abbrev === livroOrAbbrev
}

/** Inclusive range check across multi-chapter pericopes. */
export function containsRef(
  p: PericopeIndex,
  livroOrAbbrev: string,
  cap: number,
  ver: number,
): boolean {
  if (!matchesBook(p, livroOrAbbrev)) return false
  const start = p.capitulo_inicio * 100_000 + p.versiculo_inicio
  const end = p.capitulo_fim * 100_000 + p.versiculo_fim
  const point = cap * 100_000 + ver
  return point >= start && point <= end
}

export async function findPericopeByRef(
  livroOrAbbrev: string,
  cap: number,
  ver: number,
): Promise<PericopeIndex | null> {
  const list = await loadIndex()
  return list.find((p) => containsRef(p, livroOrAbbrev, cap, ver)) ?? null
}

export async function listPericopesByBookChapter(
  livroOrAbbrev: string,
  cap?: number,
): Promise<PericopeIndex[]> {
  const list = await loadIndex()
  return list.filter((p) => {
    if (!matchesBook(p, livroOrAbbrev)) return false
    if (cap == null) return true
    return p.capitulo_inicio <= cap && cap <= p.capitulo_fim
  })
}

export type LivroProgresso = {
  livro: string
  total: number
  concluidas: number
  /** 0–100, arredondado; 0 quando o livro não tem nenhuma perícope. */
  pct: number
}

/**
 * Contagem por livro na ordem de primeira aparição da lista recebida — a mesma
 * ordem em que o Índice agrupa, então o mapa serve direto para os cabeçalhos.
 */
export function progressoPorLivro(
  all: PericopeIndex[],
  done: Set<number>,
): Map<string, LivroProgresso> {
  const out = new Map<string, LivroProgresso>()
  for (const p of all) {
    const atual = out.get(p.livro) ?? { livro: p.livro, total: 0, concluidas: 0, pct: 0 }
    atual.total += 1
    if (done.has(p.ordem)) atual.concluidas += 1
    out.set(p.livro, atual)
  }
  for (const v of out.values()) {
    v.pct = v.total ? Math.round((v.concluidas / v.total) * 100) : 0
  }
  return out
}

/** Os quatro recortes de leitura. São RECORTES, não uma partição: "comecei" é
 *  subconjunto de "nao-lidos", porque "o que me falta" e "o que larguei no
 *  meio" são perguntas diferentes. */
export type FiltroLeitura = 'todos' | 'nao-lidos' | 'comecei' | 'lidos'

/** Perícope sem registro de progresso conta como não iniciada. */
export function aceitaFiltro(
  status: ProgressoStatus | undefined,
  filtro: FiltroLeitura,
): boolean {
  const s = status ?? 'nao_iniciado'
  switch (filtro) {
    case 'todos':
      return true
    case 'lidos':
      return s === 'concluido'
    case 'comecei':
      return s === 'em_andamento'
    case 'nao-lidos':
      return s !== 'concluido'
  }
}

export function statusPorOrdem(todos: Progresso[]): Map<number, ProgressoStatus> {
  return new Map(todos.map((p) => [p.pericopeOrdem, p.status]))
}

/** Dois mapas de status são iguais quando têm as mesmas ordens nos mesmos
 *  estados. Existe para a tela poder MANTER o mapa anterior quando o sync
 *  não trouxe novidade: `statusPorOrdem` devolve sempre um objeto novo, e
 *  essa identidade nova se propaga até o efeito de busca, reiniciando uma
 *  busca de texto que não precisava reiniciar. */
export function mesmosStatus(
  a: Map<number, ProgressoStatus>,
  b: Map<number, ProgressoStatus>,
): boolean {
  if (a.size !== b.size) return false
  for (const [ordem, status] of a) {
    if (b.get(ordem) !== status) return false
  }
  return true
}

export function filtroDeOrdens(
  status: Map<number, ProgressoStatus>,
  filtro: FiltroLeitura,
): (ordem: number) => boolean {
  return (ordem) => aceitaFiltro(status.get(ordem), filtro)
}

/**
 * Quantas perícopes de cada livro sobrevivem ao recorte. Todo livro presente
 * em `all` entra no mapa, inclusive com zero: a tela mostra os 66 livros
 * sempre nos mesmos lugares, e um livro que some conforme se lê desorienta.
 */
export function contagemPorLivro(
  all: PericopeIndex[],
  aceita: (ordem: number) => boolean,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const p of all) {
    out.set(p.livro, (out.get(p.livro) ?? 0) + (aceita(p.ordem) ? 1 : 0))
  }
  return out
}

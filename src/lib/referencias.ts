/**
 * Referências cruzadas da ARC por livro (shards gerados por
 * scripts/shard-referencias.ts), com a resolução do destino de cada referência.
 *
 * O shard guarda só a ORDEM das notas de um versículo; a letra (a, b, c…) é
 * calculada aqui, por versículo.
 */

import { livroSlug } from './livro-slug'
import type { PericopeIndex } from './types'

/** [livro, capítulo, versículo] como gravado no shard. O versículo pode ser lista/faixa ("4,9", "7-11"). */
export type AlvoShard = [string, number, string]

type NotaShard = {
  /** Palavras do versículo antes da letrinha; null quando o versículo não existe no catálogo. */
  p: number | null
  a: AlvoShard[]
}

export type ShardReferencias = {
  livro: string
  versiculos: Record<string, NotaShard[]>
}

export type AlvoReferencia = {
  livro: string
  capitulo: number
  /** Como veio ("4,9", "7-11", "23"). */
  versiculo: string
  /** Versículos que o alvo cobre, em ordem. */
  versiculos: number[]
  /** "Provérbios 8:23" / "Salmos 33:6,9" — no formato do app. */
  rotulo: string
}

export type NotaReferencia = {
  letra: string
  /** Palavras do versículo antes da letrinha; null = sem ponto no texto (mostra só no versículo). */
  posicao: number | null
  alvos: AlvoReferencia[]
}

export type ReferenciasDoVersiculo = {
  capitulo: number
  versiculo: number
  notas: NotaReferencia[]
}

export type VersiculoRef = { chapter: number; verse: number }

// ---------------------------------------------------------------- carga

const prontos = new Map<string, ShardReferencias>()
const emVoo = new Map<string, Promise<ShardReferencias | null>>()

/** Só para testes. */
export function _resetReferencias(): void {
  prontos.clear()
  emVoo.clear()
}

export function referenciasCarregadas(livro: string): boolean {
  return prontos.has(livroSlug(livro))
}

/**
 * Carrega o shard do livro. Devolve null quando não há referências (shard
 * ausente — quem builda sem o EPUB — ou rede indisponível): a leitura segue sem
 * elas. Falha não é guardada, a próxima chamada tenta de novo.
 */
export async function carregarReferenciasDoLivro(livro: string): Promise<ShardReferencias | null> {
  const slug = livroSlug(livro)
  const pronto = prontos.get(slug)
  if (pronto) return pronto
  const voando = emVoo.get(slug)
  if (voando) return voando

  const promessa = (async () => {
    try {
      const base = import.meta.env.BASE_URL ?? '/'
      const url = `${base.endsWith('/') ? base : `${base}/`}data/referencias/${slug}.json`
      const res = await fetch(url)
      if (!res.ok) return null
      // O Cloudflare serve o index.html com 200 para caminho inexistente.
      const tipo = res.headers.get('content-type') ?? ''
      if (!tipo.includes('json')) return null
      const corpo = (await res.json()) as ShardReferencias
      if (!corpo || typeof corpo !== 'object' || !corpo.versiculos) return null
      prontos.set(slug, corpo)
      return corpo
    } catch {
      return null
    } finally {
      emVoo.delete(slug)
    }
  })()
  emVoo.set(slug, promessa)
  return promessa
}

// ---------------------------------------------------------------- letras e alvos

/** 0 → a, 25 → z, 26 → aa, 27 → ab… */
export function letraDaNota(indice: number): string {
  let n = indice
  let s = ''
  do {
    s = String.fromCharCode(97 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/** "23" → [23]; "4,9" → [4, 9]; "7-10" → [7, 8, 9, 10]. */
export function versiculosDoAlvo(versiculo: string): number[] {
  const out: number[] = []
  for (const parte of versiculo.split(',')) {
    const faixa = /^(\d+)-(\d+)$/.exec(parte)
    if (faixa) {
      const ini = Number(faixa[1])
      const fim = Number(faixa[2])
      // Faixa invertida ou absurda é erro do dado: fica só o primeiro número.
      if (fim >= ini && fim - ini <= 200) {
        for (let v = ini; v <= fim; v++) out.push(v)
      } else {
        out.push(ini)
      }
    } else if (/^\d+$/.test(parte)) {
      out.push(Number(parte))
    }
  }
  return out
}

function alvoDe([livro, capitulo, versiculo]: AlvoShard): AlvoReferencia {
  return { livro, capitulo, versiculo, versiculos: versiculosDoAlvo(versiculo), rotulo: `${livro} ${capitulo}:${versiculo}` }
}

function notasDe(shard: ShardReferencias, capitulo: number, versiculo: number): NotaReferencia[] {
  const notas = shard.versiculos[`${capitulo}:${versiculo}`]
  if (!notas) return []
  return notas.map((n, i) => ({ letra: letraDaNota(i), posicao: n.p, alvos: n.a.map(alvoDe) }))
}

// ---------------------------------------------------------------- consultas

/** Notas de um versículo, com letra. Vazio quando não há ou o shard não carregou. */
export async function obterNotasDoVersiculo(
  livro: string,
  capitulo: number,
  versiculo: number,
): Promise<NotaReferencia[]> {
  const shard = await carregarReferenciasDoLivro(livro)
  return shard ? notasDe(shard, capitulo, versiculo) : []
}

/** Referências dos versículos informados, na ordem recebida, sem versículos vazios. */
export async function obterReferenciasDosVersiculos(
  livro: string,
  versiculos: VersiculoRef[],
): Promise<ReferenciasDoVersiculo[]> {
  const shard = await carregarReferenciasDoLivro(livro)
  if (!shard) return []
  const out: ReferenciasDoVersiculo[] = []
  for (const { chapter, verse } of versiculos) {
    const notas = notasDe(shard, chapter, verse)
    if (notas.length) out.push({ capitulo: chapter, versiculo: verse, notas })
  }
  return out
}

type Limites = Pick<PericopeIndex, 'livro' | 'capitulo_inicio' | 'versiculo_inicio' | 'capitulo_fim' | 'versiculo_fim'>

function dentro(p: Limites, capitulo: number, versiculo: number): boolean {
  if (capitulo < p.capitulo_inicio || capitulo > p.capitulo_fim) return false
  if (capitulo === p.capitulo_inicio && versiculo < p.versiculo_inicio) return false
  if (capitulo === p.capitulo_fim && versiculo > p.versiculo_fim) return false
  return true
}

/** Todas as referências da perícope, versículo a versículo, em ordem de leitura. */
export async function obterReferenciasDaPericope(p: Limites): Promise<ReferenciasDoVersiculo[]> {
  const shard = await carregarReferenciasDoLivro(p.livro)
  if (!shard) return []
  const out: ReferenciasDoVersiculo[] = []
  for (const chave of Object.keys(shard.versiculos)) {
    const [cap, ver] = chave.split(':').map(Number)
    if (!dentro(p, cap, ver)) continue
    out.push({ capitulo: cap, versiculo: ver, notas: notasDe(shard, cap, ver) })
  }
  return out.sort((a, b) => a.capitulo - b.capitulo || a.versiculo - b.versiculo)
}

/** Quantas notas há nos versículos (para o contador do botão "Refs"). */
export async function contarReferencias(livro: string, versiculos: VersiculoRef[]): Promise<number> {
  const refs = await obterReferenciasDosVersiculos(livro, versiculos)
  return refs.reduce((soma, r) => soma + r.notas.length, 0)
}

// ---------------------------------------------------------------- destino

/**
 * Perícope que contém (livro, capítulo, versículo), a partir do índice (já em
 * ordem de leitura). Se o versículo cai num vão — a versificação da ARC e da
 * Bíblia Livre nem sempre coincidem — vale a perícope anterior mais próxima do
 * mesmo livro, e, antes da primeira, a primeira. Null só se o livro não existe.
 */
export function encontrarPericopeDaReferencia(
  indice: PericopeIndex[],
  livro: string,
  capitulo: number,
  versiculo: number,
): PericopeIndex | null {
  let anterior: PericopeIndex | null = null
  let primeira: PericopeIndex | null = null
  for (const p of indice) {
    if (p.livro !== livro) continue
    if (!primeira) primeira = p
    if (dentro(p, capitulo, versiculo)) return p
    const comecaAntes =
      p.capitulo_inicio < capitulo || (p.capitulo_inicio === capitulo && p.versiculo_inicio <= versiculo)
    if (comecaAntes) anterior = p
  }
  return anterior ?? primeira
}

/** Destino de um alvo: a perícope do primeiro versículo e o versículo a destacar ("cap:ver"). */
export function resolverAlvo(
  indice: PericopeIndex[],
  alvo: AlvoReferencia,
): { pericope: PericopeIndex; versiculoId: string } | null {
  const ver = alvo.versiculos[0] ?? 1
  const pericope = encontrarPericopeDaReferencia(indice, alvo.livro, alvo.capitulo, ver)
  return pericope ? { pericope, versiculoId: `${alvo.capitulo}:${ver}` } : null
}

// ---------------------------------------------------------------- navegação e prévia

/**
 * Rota de leitura para o destino de uma referência. `via=ref` marca que a pessoa
 * chegou por uma referência; `origem` e `ov` dizem de onde (perícope e versículo)
 * para a volta; `v` é o versículo a focar no destino.
 */
export function urlDaReferencia(destino: {
  ordem: number
  versiculoId: string
  origem: { ordem: number; versiculoId: string }
  /** Jornada em que a origem estava, para o botão de voltar do destino poder nomeá-la. */
  jornadaId?: string | null
}): string {
  const qs = new URLSearchParams({
    via: 'ref',
    origem: String(destino.origem.ordem),
    ov: destino.origem.versiculoId,
    v: destino.versiculoId,
  })
  if (destino.jornadaId) qs.set('jid', destino.jornadaId)
  return `/leitura/${destino.ordem}?${qs.toString()}`
}

/**
 * Versículos do alvo extraídos do texto de uma perícope (formato do shard de
 * texto: "Capítulo N" + linhas "N texto"). O alvo pode cruzar de capítulo só
 * pela perícope; aqui todos os versículos pertencem a `capitulo`.
 */
export function extrairVersiculos(
  texto: string,
  capitulo: number,
  versiculos: number[],
): { verso: number; texto: string }[] {
  const desejados = new Set(versiculos)
  const out: { verso: number; texto: string }[] = []
  let cap = 0
  for (const linha of texto.split('\n')) {
    const t = linha.trim()
    const c = /^Capítulo\s+(\d+)\s*$/i.exec(t)
    if (c) {
      cap = Number(c[1])
      continue
    }
    const v = /^(\d+)\s+(.+)$/.exec(t)
    if (v && cap === capitulo && desejados.has(Number(v[1]))) out.push({ verso: Number(v[1]), texto: v[2] })
  }
  return out
}

/**
 * Resume as referências cruzadas em texto limpo e compacto para prompts de IA.
 * Formato por linha: "cap:ver: Ref 1, Ref 2; Ref 3".
 */
export function formatarReferenciasParaIa(referencias: ReferenciasDoVersiculo[]): string {
  const linhas: string[] = []
  for (const r of referencias) {
    if (!r.notas.length) continue
    const notasStr = r.notas
      .map((n) => n.alvos.map((a) => a.rotulo).join(', '))
      .filter(Boolean)
      .join('; ')
    if (notasStr) {
      linhas.push(`${r.capitulo}:${r.versiculo}: ${notasStr}`)
    }
  }
  return linhas.join('\n')
}


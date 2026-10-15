/**
 * Loader sob demanda para associação semântica entre perícopes bíblicas,
 * versículos selecionados e louvores do projeto Coldigom (Gemma Embedding 2 - 256d).
 */

import { livroSlug } from './livro-slug'

export type MatchTipo = 'biblico' | 'tematico' | 'ambos' | 'citacao_direta'

export type LouvorRecomendado = {
  id: string
  shortId?: string
  number: string
  name: string
  category: string
  tags: string
  similarity: number
  similarityBiblico?: number
  similarityTematico?: number
  similarityHomiletico?: number
  matchTipo?: MatchTipo
  citacaoBiblica?: string
  mensagemCentral?: string
  temasHomileticos?: string[]
}

export type CitacaoVersiculoItem = {
  id: string
  shortId?: string
  number: string
  name: string
  category: string
  tags?: string
  versiculoInicio: number
  versiculoFim: number
  referencia: string
  mensagemCentral?: string
  temasHomileticos?: string[]
}

export type MapaCitacoesPorVersiculo = Record<string, Record<string, CitacaoVersiculoItem[]>>

export type LivroVersiculosData = {
  book: string
  slug: string
  praises: Array<{
    id: string
    shortId?: string
    number: string
    name: string
    category: string
    tags?: string
    mensagemCentral?: string
    temasHomileticos?: string[]
  }>
  verses: Record<string, Array<[number, number]>> // "cap:ver" -> [praiseIdx, score]
}

export type VersiculoRef = {
  chapter: number
  verse: number
}

type MapaLouvores = Record<string, LouvorRecomendado[]>

let cache: MapaLouvores | null = null
let promessaEmVoo: Promise<MapaLouvores> | null = null

let cacheCitacoes: MapaCitacoesPorVersiculo | null = null
let promessaCitacoes: Promise<MapaCitacoesPorVersiculo> | null = null

const cacheLivros = new Map<string, LivroVersiculosData>()
const promessasLivros = new Map<string, Promise<LivroVersiculosData | null>>()

/** Retorna se o mapa de louvores já foi carregado em memória. */
export function louvoresCarregados(): boolean {
  return cache !== null
}

/** Limpa o cache em memória (útil para testes unitários). */
export function _resetCacheLouvores(): void {
  cache = null
  promessaEmVoo = null
  cacheCitacoes = null
  promessaCitacoes = null
  cacheLivros.clear()
  promessasLivros.clear()
}

/** Carrega o arquivo JSON completo de perícopes de forma assíncrona com cache. */
export async function carregarMapaLouvores(): Promise<MapaLouvores> {
  if (cache) return cache
  if (promessaEmVoo) return promessaEmVoo

  promessaEmVoo = (async () => {
    const base = import.meta.env.BASE_URL ?? '/'
    const url = `${base.endsWith('/') ? base : `${base}/`}data/pericopes-louvores.json`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Falha ao carregar pericopes-louvores.json (HTTP ${res.status})`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    // Proteção contra fallback SPA que retorna index.html 200
    if (contentType && !contentType.includes('json')) {
      throw new Error('Resposta de pericopes-louvores.json inválida (não-JSON)')
    }

    const dados = (await res.json()) as MapaLouvores
    cache = dados
    promessaEmVoo = null
    return dados
  })().catch((err) => {
    promessaEmVoo = null
    throw err
  })

  return promessaEmVoo
}

/**
 * Obtém a lista de louvores recomendados para a perícope informada.
 * Retorna array vazio caso a perícope não possua louvores associados ou em caso de erro.
 */
export async function obterLouvoresDaPericope(ordem: number): Promise<LouvorRecomendado[]> {
  try {
    const mapa = await carregarMapaLouvores()
    return mapa[String(ordem)] ?? []
  } catch (erro) {
    console.error('Erro ao obter louvores da perícope:', erro)
    return []
  }
}

/** Carrega o mapa invertido de citações bíblicas literais por versículo. */
export async function carregarCitacoesPorVersiculo(): Promise<MapaCitacoesPorVersiculo> {
  if (cacheCitacoes) return cacheCitacoes
  if (promessaCitacoes) return promessaCitacoes

  promessaCitacoes = (async () => {
    const base = import.meta.env.BASE_URL ?? '/'
    const url = `${base.endsWith('/') ? base : `${base}/`}data/citacoes-por-versiculo.json`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Falha ao carregar citacoes-por-versiculo.json (HTTP ${res.status})`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType && !contentType.includes('json')) {
      throw new Error('Resposta de citacoes-por-versiculo.json inválida (não-JSON)')
    }

    const dados = (await res.json()) as MapaCitacoesPorVersiculo
    cacheCitacoes = dados
    promessaCitacoes = null
    return dados
  })().catch((err) => {
    promessaCitacoes = null
    throw err
  })

  return promessaCitacoes
}

/**
 * Obtém louvores que possuem citação bíblica literal direta para os versículos informados.
 * Retorna itens com 100% de afinidade e matchTipo: 'citacao_direta'.
 */
export async function obterCitacoesParaVersiculos(
  livro: string,
  versiculos: VersiculoRef[],
): Promise<LouvorRecomendado[]> {
  if (!versiculos.length) return []
  try {
    const mapa = await carregarCitacoesPorVersiculo()
    const livroCitacoes = mapa[livro]
    if (!livroCitacoes) return []

    const resultados: LouvorRecomendado[] = []
    const idsVistos = new Set<string>()

    // Agrupa versículos por capítulo
    const porCapitulo = new Map<number, number[]>()
    for (const v of versiculos) {
      const lista = porCapitulo.get(v.chapter) ?? []
      lista.push(v.verse)
      porCapitulo.set(v.chapter, lista)
    }

    for (const [cap, versos] of porCapitulo.entries()) {
      const citacoesCap = livroCitacoes[String(cap)]
      if (!citacoesCap) continue

      const minV = Math.min(...versos)
      const maxV = Math.max(...versos)

      for (const c of citacoesCap) {
        // Interseção entre faixa [c.versiculoInicio, c.versiculoFim] e versos selecionados
        const intersecta = c.versiculoInicio <= maxV && c.versiculoFim >= minV
        if (intersecta && !idsVistos.has(c.id)) {
          idsVistos.add(c.id)
          resultados.push({
            id: c.id,
            shortId: c.shortId,
            number: c.number,
            name: c.name,
            category: c.category,
            tags: c.tags ?? '',
            similarity: 100.0,
            similarityBiblico: 100.0,
            similarityTematico: 100.0,
            matchTipo: 'citacao_direta',
            citacaoBiblica: c.referencia,
            mensagemCentral: c.mensagemCentral,
            temasHomileticos: c.temasHomileticos,
          })
        }
      }
    }

    return resultados
  } catch (err) {
    console.error('Erro ao obter citações para versículos:', err)
    return []
  }
}

/** Carrega os louvores pré-computados de um livro específico sob demanda. */
export async function carregarLouvoresDoLivro(slug: string): Promise<LivroVersiculosData | null> {
  if (cacheLivros.has(slug)) return cacheLivros.get(slug)!
  if (promessasLivros.has(slug)) return promessasLivros.get(slug)!

  const promessa = (async () => {
    const base = import.meta.env.BASE_URL ?? '/'
    const url = `${base.endsWith('/') ? base : `${base}/`}data/versiculos-louvores/${slug}.json`
    const res = await fetch(url)
    if (!res.ok) {
      return null
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType && !contentType.includes('json')) {
      return null
    }
    const dados = (await res.json()) as LivroVersiculosData
    cacheLivros.set(slug, dados)
    promessasLivros.delete(slug)
    return dados
  })().catch(() => {
    promessasLivros.delete(slug)
    return null
  })

  promessasLivros.set(slug, promessa)
  return promessa
}

/**
 * Obtém a lista consolidada de louvores recomendados para um ou mais versículos selecionados.
 * Combina citações literais diretas (Slot #1...) + afinidade temática por versículo.
 */
export async function obterLouvoresDosVersiculos(
  livro: string,
  versiculos: VersiculoRef[],
): Promise<LouvorRecomendado[]> {
  if (!versiculos.length) return []

  // 1. Citações diretas no topo (100% afinidade)
  const citacoes = await obterCitacoesParaVersiculos(livro, versiculos)
  const idsVistos = new Set<string>(citacoes.map((c) => c.id))
  const nomesVistos = new Set<string>(citacoes.map((c) => c.name.trim().toLowerCase()))

  // 2. Busca semântica/homilética daquele livro
  const slug = livroSlug(livro)
  const livroData = await carregarLouvoresDoLivro(slug)

  const scoresPorLouvor = new Map<number, number[]>()

  if (livroData?.verses) {
    for (const v of versiculos) {
      const ref = `${v.chapter}:${v.verse}`
      const matches = livroData.verses[ref]
      if (!matches) continue

      for (const [pIdx, score] of matches) {
        const scores = scoresPorLouvor.get(pIdx) ?? []
        scores.push(score)
        scoresPorLouvor.set(pIdx, scores)
      }
    }
  }

  // Agrega as pontuações médias
  const tematicos: LouvorRecomendado[] = []
  for (const [pIdx, scoreList] of scoresPorLouvor.entries()) {
    const pMeta = livroData?.praises[pIdx]
    if (!pMeta) continue
    if (idsVistos.has(pMeta.id)) continue
    const nomeNorm = pMeta.name.trim().toLowerCase()
    if (nomesVistos.has(nomeNorm)) continue

    const avgScore = scoreList.reduce((a, b) => a + b, 0) / scoreList.length
    tematicos.push({
      id: pMeta.id,
      shortId: pMeta.shortId,
      number: pMeta.number,
      name: pMeta.name,
      category: pMeta.category,
      tags: pMeta.tags ?? '',
      similarity: Number(avgScore.toFixed(1)),
      matchTipo: 'tematico',
      mensagemCentral: pMeta.mensagemCentral,
      temasHomileticos: pMeta.temasHomileticos,
    })
  }

  // Ordena os temáticos por pontuação decrescente
  tematicos.sort((a, b) => b.similarity - a.similarity)

  // Mescla citações no topo seguidas dos melhores temáticos (limite de 8 no total)
  return [...citacoes, ...tematicos].slice(0, 8)
}

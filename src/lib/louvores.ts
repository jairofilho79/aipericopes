/**
 * Loader sob demanda para associação semântica entre perícopes bíblicas
 * e louvores do projeto Coldigom (Gemma Embedding 2 - 256d).
 */

export type MatchTipo = 'biblico' | 'tematico' | 'ambos'

export type LouvorRecomendado = {
  id: string
  number: string
  name: string
  category: string
  tags: string
  similarity: number
  similarityBiblico?: number
  similarityTematico?: number
  matchTipo?: MatchTipo
}

type MapaLouvores = Record<string, LouvorRecomendado[]>

let cache: MapaLouvores | null = null
let promessaEmVoo: Promise<MapaLouvores> | null = null

/** Retorna se o mapa de louvores já foi carregado em memória. */
export function louvoresCarregados(): boolean {
  return cache !== null
}

/** Limpa o cache em memória (útil para testes unitários). */
export function _resetCacheLouvores(): void {
  cache = null
  promessaEmVoo = null
}

/** Carrega o arquivo JSON completo de forma assíncrona com cache. */
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

import { loadIndex } from './content'
import { livroSlug } from './livro-slug'
import type { PericopeIndex } from './types'

export type SecaoIntroducao = {
  id: string
  subtitulo: string
  texto: string
}

export type IntroducaoLivroData = {
  livro: string
  slug: string
  abbrev: string
  testamento: string
  titulo_canonico: string
  titulo_introducao: string
  secoes: SecaoIntroducao[]
  texto_completo?: string
}

export type PalavraManifestoIntroducao = {
  t: string
  i: number
  dur?: number
  d?: number
}

export type UnidadeManifestoIntroducao = {
  i: number
  secao: string
  texto: string
  inicio: number
  dur: number
  palavras?: PalavraManifestoIntroducao[]
}

export type ManifestoIntroducao = {
  slug?: string
  dur_total: number
  unidades: UnidadeManifestoIntroducao[]
}

const cacheIntroducoes = new Map<string, IntroducaoLivroData | null>()
const voandoIntroducoes = new Map<string, Promise<IntroducaoLivroData | null>>()

/**
 * Carrega o arquivo JSON da introdução do livro em `/data/introducoes/${slug}.json`.
 * Devolve `null` caso o arquivo não exista ou ocorra erro.
 */
export async function carregarIntroducao(
  slug: string,
  signal?: AbortSignal,
): Promise<IntroducaoLivroData | null> {
  const chave = slug.toLowerCase().trim()
  if (cacheIntroducoes.has(chave)) {
    return cacheIntroducoes.get(chave) ?? null
  }
  const emVoo = voandoIntroducoes.get(chave)
  if (emVoo) return emVoo

  const promessa = (async () => {
    try {
      const url = `${import.meta.env.BASE_URL}data/introducoes/${chave}.json`
      const res = await fetch(url, { signal })
      if (!res.ok) {
        cacheIntroducoes.set(chave, null)
        return null
      }
      const contentType = res.headers.get('content-type') ?? ''
      // Cloudflare SPA fallback pode servir index.html com status 200
      if (!contentType.includes('json')) {
        cacheIntroducoes.set(chave, null)
        return null
      }
      const data = (await res.json()) as IntroducaoLivroData
      if (!data || !data.livro || !Array.isArray(data.secoes)) {
        cacheIntroducoes.set(chave, null)
        return null
      }
      cacheIntroducoes.set(chave, data)
      return data
    } catch {
      cacheIntroducoes.set(chave, null)
      return null
    } finally {
      voandoIntroducoes.delete(chave)
    }
  })()

  voandoIntroducoes.set(chave, promessa)
  return promessa
}

/**
 * Retorna a primeira perícope canônica do livro a partir do índice de perícopes.
 */
export async function obterPrimeiraPericopeDoLivro(
  livroOuSlug: string,
): Promise<PericopeIndex | null> {
  try {
    const indice = await loadIndex()
    const slugAlvo = livroSlug(livroOuSlug)
    // O índice já está ordenado por seq (ordem canônica de leitura)
    const primeira = indice.find((p) => livroSlug(p.livro) === slugAlvo)
    return primeira ?? null
  } catch {
    return null
  }
}

/**
 * Tenta carregar o manifesto de áudio da introdução caso exista no backend (/api/audio/introducoes/${slug}.json).
 */
export async function carregarManifestoIntroducao(
  slug: string,
  signal?: AbortSignal,
): Promise<ManifestoIntroducao | null> {
  try {
    const res = await fetch(`/api/audio/introducoes/${slug}.json`, { signal })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('json')) return null
    const corpo: unknown = await res.json()
    if (!corpo || typeof corpo !== 'object') return null
    const m = corpo as ManifestoIntroducao
    if (typeof m.dur_total !== 'number' || !Array.isArray(m.unidades)) return null
    return m
  } catch {
    return null
  }
}

/**
 * URL do áudio da introdução do livro.
 */
export function urlAudioIntroducao(slug: string): string {
  return `/api/audio/introducoes/${slug}.m4a`
}

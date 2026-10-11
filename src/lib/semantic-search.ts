/**
 * Motor de busca semântica client-side em Float32Array.
 *
 * Lê `public/data/embeddings-256.bin` e `public/data/embeddings-meta.json`
 * de forma preguiçosa (lazy load) e executa produto escalar (cosseno de vetores L2-unitários)
 * em ~1-3ms no navegador, sem bater em nenhuma API externa.
 */

export type EmbeddingsMeta = {
  modelo: string
  dimensoes: number
  totalPericopes: number
  stridePorPericope: number
  ordens: number[]
  geradoEm: string
}

export type SemanticHit = {
  ordem: number
  score: number
  tipo: 'biblico' | 'tematico'
  scoreBiblico: number
  scoreTematico: number
}

let metaCache: EmbeddingsMeta | null = null
let bufferCache: Float32Array | null = null
let carregandoPromessa: Promise<{ meta: EmbeddingsMeta; buffer: Float32Array }> | null = null

/** Verifica se o índice vetorial já está em memória no cliente */
export function embeddingsCarregados(): boolean {
  return metaCache !== null && bufferCache !== null
}

/** Carrega os metadados e o binário sob demanda */
export async function carregarEmbeddings(): Promise<{
  meta: EmbeddingsMeta
  buffer: Float32Array
}> {
  if (metaCache && bufferCache) {
    return { meta: metaCache, buffer: bufferCache }
  }
  if (carregandoPromessa) {
    return carregandoPromessa
  }

  carregandoPromessa = (async () => {
    const baseUrl = import.meta.env.BASE_URL ?? '/'

    const [resMeta, resBin] = await Promise.all([
      fetch(`${baseUrl}data/embeddings-meta.json`),
      fetch(`${baseUrl}data/embeddings-256.bin`),
    ])

    if (!resMeta.ok) throw new Error('Falha ao carregar metadados de embeddings')
    if (!resBin.ok) throw new Error('Falha ao carregar binário de embeddings')

    const meta = (await resMeta.json()) as EmbeddingsMeta
    const arrayBuffer = await resBin.arrayBuffer()
    const buffer = new Float32Array(arrayBuffer)

    metaCache = meta
    bufferCache = buffer
    carregandoPromessa = null

    return { meta, buffer }
  })().catch((err: unknown) => {
    carregandoPromessa = null
    throw err
  })

  return carregandoPromessa
}

/**
 * Produto escalar puro entre a query e o trecho da matriz contígua.
 * Como ambos os vetores têm norma L2 unitária, o produto escalar é a similaridade cosseno exata.
 */
export function dotProduct(
  query: Float32Array | number[],
  matrix: Float32Array,
  offset: number,
  dim = 256,
): number {
  let sum = 0
  for (let i = 0; i < dim; i++) {
    sum += query[i] * matrix[offset + i]
  }
  return sum
}

export type DiagnosticoSemantico = {
  totalPericopes: number
  totalAvaliadas: number
  maxScore: number
  minScore: number
  hitsAcimaDeCorte: number
  corte: number
  bufferByteLength: number
  temNaNNoVetor: boolean
  vetorZerado: boolean
}

let ultimoDiagnostico: DiagnosticoSemantico | null = null

export function obterUltimoDiagnostico(): DiagnosticoSemantico | null {
  return ultimoDiagnostico
}

/**
 * Busca semântica nos 5.646 vetores em memória.
 *
 * @param queryVec Vetor da busca com 256 dimensões (deve estar L2-normalizado).
 * @param limit Teto de resultados (default: 30).
 * @param minScore Similaridade mínima para descartar ruído (default: 0.25).
 * @param aceitar Filtro opcional por ordem (ex: filtrar por livro/lidos).
 */
export async function searchSemantico(
  queryVec: Float32Array | number[],
  limit = 30,
  minScore = 0.25,
  aceitar?: (ordem: number) => boolean,
): Promise<SemanticHit[]> {
  const { meta, buffer } = await carregarEmbeddings()
  const dim = meta.dimensoes
  const total = meta.ordens.length

  const temNaN = Array.from(queryVec).some((x) => Number.isNaN(x))
  const ehZero = Array.from(queryVec).every((x) => x === 0)
  let maxScore = -Infinity
  let minScoreEncontrado = Infinity
  let totalAvaliadas = 0

  const hits: SemanticHit[] = []

  for (let i = 0; i < total; i++) {
    const ordem = meta.ordens[i]
    if (aceitar && !aceitar(ordem)) continue

    totalAvaliadas++
    const biblicoOffset = i * meta.stridePorPericope
    const tematicoOffset = biblicoOffset + dim

    const scoreBiblico = dotProduct(queryVec, buffer, biblicoOffset, dim)
    const scoreTematico = dotProduct(queryVec, buffer, tematicoOffset, dim)

    const maiorScore = Math.max(scoreBiblico, scoreTematico)
    if (!Number.isNaN(maiorScore)) {
      if (maiorScore > maxScore) maxScore = maiorScore
      if (maiorScore < minScoreEncontrado) minScoreEncontrado = maiorScore
    }

    if (Number.isNaN(maiorScore) || maiorScore < minScore) continue

    hits.push({
      ordem,
      score: maiorScore,
      tipo: scoreBiblico >= scoreTematico ? 'biblico' : 'tematico',
      scoreBiblico,
      scoreTematico,
    })
  }

  ultimoDiagnostico = {
    totalPericopes: total,
    totalAvaliadas,
    maxScore: maxScore === -Infinity ? 0 : Number(maxScore.toFixed(4)),
    minScore: minScoreEncontrado === Infinity ? 0 : Number(minScoreEncontrado.toFixed(4)),
    hitsAcimaDeCorte: hits.length,
    corte: minScore,
    bufferByteLength: buffer.byteLength,
    temNaNNoVetor: temNaN,
    vetorZerado: ehZero,
  }

  console.log('[SemanticSearch] Diagnóstico da busca:', ultimoDiagnostico)

  // Ordena por maior similaridade decrescente
  hits.sort((a, b) => b.score - a.score)

  return hits.slice(0, limit)
}

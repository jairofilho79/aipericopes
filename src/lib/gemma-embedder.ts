/**
 * Gerenciador do modelo EmbeddingGemma-2 no cliente via LiteRT-LM (WebGPU).
 *
 * - Faz download do modelo do Hugging Face (157 MB) sob demanda com barra de progresso.
 * - Salva no Cache Storage do navegador (`window.caches`) para nunca baixar duas vezes.
 * - Executa a inferência na GPU do cliente (WebGPU) de forma nativa.
 * - Aplica Matryoshka Truncation (256d) + L2 Normalization unitária.
 */

import {
  Backend,
  EmbeddingEngine,
  loadLiteRtLm,
  setupDefaultWebGpuDevice,
} from '@litert-lm/core'

export const MODEL_URL =
  'https://huggingface.co/litert-community/embeddinggemma-2-text-270m-litert-lm/resolve/main/embeddinggemma-2-text-270m.litertlm'

export const WASM_CDN_DIR = 'https://cdn.jsdelivr.net/npm/@litert-lm/core@0.18.0/wasm/'

const CACHE_NAME = 'gemma-models'

export type EstadoEmbedder =
  | 'descarregado'
  | 'verificando_hardware'
  | 'sem_webgpu'
  | 'baixando'
  | 'inicializando_gpu'
  | 'pronto'
  | 'erro'

export type ProgressoDownload = {
  recebido: number
  total: number
  percentual: number
}

let engineInstance: EmbeddingEngine | null = null
let estadoAtual: EstadoEmbedder = 'descarregado'
let mensagemErro: string | null = null
const ouvintesEstado = new Set<(estado: EstadoEmbedder, progresso?: ProgressoDownload) => void>()

function notificar(estado: EstadoEmbedder, progresso?: ProgressoDownload): void {
  estadoAtual = estado
  for (const ouvinte of ouvintesEstado) {
    ouvinte(estado, progresso)
  }
}

export function assinarEstadoEmbedder(
  callback: (estado: EstadoEmbedder, progresso?: ProgressoDownload) => void,
): () => void {
  ouvintesEstado.add(callback)
  callback(estadoAtual)
  return () => ouvintesEstado.delete(callback)
}

export function obterEstadoEmbedder(): { estado: EstadoEmbedder; erro: string | null } {
  return { estado: estadoAtual, erro: mensagemErro }
}

/** Verifica se o navegador atual tem suporte a WebGPU */
export async function suportaWebGpu(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false
  }
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

/** Verifica se o modelo já está baixado e salvo no Cache Storage local */
export async function modeloJaEmCache(): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false
  try {
    const cache = await window.caches.open(CACHE_NAME)
    const match = await cache.match(MODEL_URL)
    return match !== undefined
  } catch {
    return false
  }
}

/** Remove o modelo do cache local para liberar espaço se o usuário quiser */
export async function limparCacheModelo(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return
  try {
    const cache = await window.caches.open(CACHE_NAME)
    await cache.delete(MODEL_URL)
    if (engineInstance) {
      await engineInstance.delete()
      engineInstance = null
    }
    notificar('descarregado')
  } catch (err) {
    console.warn('[GemmaEmbedder] Falha ao limpar cache:', err)
  }
}

/**
 * Obtém o Blob do modelo, seja do Cache Storage ou baixando do Hugging Face com progresso.
 */
async function obterBlobModelo(): Promise<Blob> {
  if (!('caches' in window)) {
    // Fallback sem Cache Storage (baixa direto)
    const res = await fetch(MODEL_URL)
    if (!res.ok) throw new Error(`Falha ao baixar modelo do Hugging Face (${res.status})`)
    return await res.blob()
  }

  const cache = await window.caches.open(CACHE_NAME)
  const cached = await cache.match(MODEL_URL)

  if (cached) {
    return await cached.blob()
  }

  // Baixa do Hugging Face com monitoramento de progresso
  notificar('baixando', { recebido: 0, total: 164626432, percentual: 0 })

  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`Falha ao baixar modelo (${res.status} ${res.statusText})`)

  const total = Number(res.headers.get('content-length') || '164626432')
  const reader = res.body?.getReader()
  if (!reader) {
    const blob = await res.blob()
    await cache.put(MODEL_URL, new Response(blob))
    return blob
  }

  const chunks: Uint8Array[] = []
  let recebido = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    recebido += value.byteLength

    const percentual = total > 0 ? Math.round((recebido / total) * 100) : 0
    notificar('baixando', { recebido, total, percentual })
  }

  const blobFinal = new Blob(chunks as unknown as BlobPart[], {
    type: 'application/octet-stream',
  })

  // Salva no Cache Storage do navegador para visitas futuras
  try {
    await cache.put(
      MODEL_URL,
      new Response(blobFinal, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': blobFinal.size.toString(),
        },
      }),
    )
  } catch (cacheErr) {
    console.warn('[GemmaEmbedder] Aviso: não foi possível salvar no Cache Storage:', cacheErr)
  }

  return blobFinal
}

let inicializacaoPromessa: Promise<EmbeddingEngine> | null = null

/**
 * Inicializa o motor de embedding LiteRT-LM WebGPU.
 */
export async function inicializarEmbedder(): Promise<EmbeddingEngine> {
  if (engineInstance) return engineInstance
  if (inicializacaoPromessa) return inicializacaoPromessa

  inicializacaoPromessa = (async () => {
    try {
      console.log('[GemmaEmbedder] Iniciando inicializarEmbedder...')
      notificar('verificando_hardware')
      const temGpu = await suportaWebGpu()
      console.log('[GemmaEmbedder] Suporte a WebGPU:', temGpu)
      if (!temGpu) {
        notificar('sem_webgpu')
        throw new Error('Navegador ou dispositivo não suporta WebGPU.')
      }

      // 1. Obtém o modelo (cache ou Hugging Face)
      const blob = await obterBlobModelo()
      console.log('[GemmaEmbedder] Blob do modelo obtido:', {
        tamanhoBytes: blob.size,
        tipo: blob.type,
      })

      notificar('inicializando_gpu')

      // 2. Carrega o runtime LiteRT Wasm e configura o device WebGPU
      console.log('[GemmaEmbedder] Carregando LiteRT Wasm de:', WASM_CDN_DIR)
      await loadLiteRtLm(WASM_CDN_DIR)
      console.log('[GemmaEmbedder] Configurando device WebGPU default...')
      await setupDefaultWebGpuDevice()

      // 3. Cria a instância do EmbeddingEngine
      console.log('[GemmaEmbedder] Criando EmbeddingEngine com Backend.GPU...')
      const engine = await EmbeddingEngine.create({
        model: blob,
        backend: Backend.GPU,
        maxInputLength: 1024,
      })

      console.log('[GemmaEmbedder] EmbeddingEngine criado com sucesso!')
      engineInstance = engine
      notificar('pronto')
      return engine
    } catch (err) {
      mensagemErro = err instanceof Error ? err.message : String(err)
      console.error('[GemmaEmbedder] Falha ao inicializar embedder:', err)
      if (estadoAtual !== 'sem_webgpu') {
        notificar('erro')
      }
      inicializacaoPromessa = null
      throw err
    }
  })()

  return inicializacaoPromessa
}

/**
 * Gera o vetor de embedding da consulta, trunca para 256d e aplica Normalização L2 unitária.
 */
export async function embedQuery(texto: string): Promise<Float32Array> {
  const consulta = texto.trim()
  if (!consulta) {
    return new Float32Array(256)
  }

  console.log('[GemmaEmbedder] embedQuery chamada:', { consulta })
  const engine = await inicializarEmbedder()
  const response = await engine.computeEmbedding(consulta)

  const raw = response.embedding // array de números originais
  const rawLength = raw?.length ?? 0
  const hasNaN = raw?.some((x) => Number.isNaN(x)) ?? false
  const allZero = raw?.every((x) => x === 0) ?? false

  console.log('[GemmaEmbedder] computeEmbedding retorno:', {
    inputLength: response.inputLength,
    numChunks: response.numChunks,
    rawLength,
    hasNaN,
    allZero,
    primeiros5: raw?.slice(0, 5),
  })

  if (!raw || rawLength === 0) {
    console.error('[GemmaEmbedder] Retorno vazio de computeEmbedding!')
    return new Float32Array(256)
  }

  // Truncamento Matryoshka para 256 dimensões
  const TARGET_DIM = 256
  const slice = raw.slice(0, TARGET_DIM)

  // Normalização L2 unitária
  let sumSq = 0
  for (let i = 0; i < TARGET_DIM; i++) {
    sumSq += slice[i] * slice[i]
  }
  const norm = Math.sqrt(sumSq) || 1

  const vetorFinal = new Float32Array(TARGET_DIM)
  for (let i = 0; i < TARGET_DIM; i++) {
    vetorFinal[i] = slice[i] / norm
  }

  const finalNaN = Array.from(vetorFinal).some((x) => Number.isNaN(x))
  console.log('[GemmaEmbedder] Vetor unitário 256d pronto:', {
    normaCalculada: norm,
    temNaN: finalNaN,
    primeiros5: Array.from(vetorFinal.slice(0, 5)),
  })

  return vetorFinal
}

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

let ultimoBlob: Blob | null = null

export type DiagnosticoEmbedder = {
  rawLength: number
  inputLength: number
  allZero: boolean
  hasNaN: boolean
  backendUsado: 'gpu' | 'cpu'
  teveFallbackCpu: boolean
  tamanhoBlobMb: number
}

let ultimoDiagnosticoEmbedder: DiagnosticoEmbedder | null = null

export function obterUltimoDiagnosticoEmbedder(): DiagnosticoEmbedder | null {
  return ultimoDiagnosticoEmbedder
}

export async function suportaHardware(): Promise<{ gpu: boolean; cpu: boolean }> {
  const gpu = await suportaWebGpu()
  const cpu = typeof WebAssembly !== 'undefined'
  return { gpu, cpu }
}

/**
 * Obtém o Blob do modelo, seja do Cache Storage ou baixando do Hugging Face com progresso.
 */
async function obterBlobModelo(): Promise<Blob> {
  if (ultimoBlob) return ultimoBlob

  if (!('caches' in window)) {
    // Fallback sem Cache Storage (baixa direto)
    const res = await fetch(MODEL_URL)
    if (!res.ok) throw new Error(`Falha ao baixar modelo do Hugging Face (${res.status})`)
    const b = await res.blob()
    ultimoBlob = b
    return b
  }

  const cache = await window.caches.open(CACHE_NAME)
  const cached = await cache.match(MODEL_URL)

  if (cached) {
    const b = await cached.blob()
    ultimoBlob = b
    return b
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
    ultimoBlob = blob
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

  ultimoBlob = blobFinal
  return blobFinal
}

let carregarWasmPromessa: Promise<unknown> | null = null

async function garantirWasm(): Promise<void> {
  if (carregarWasmPromessa) {
    await carregarWasmPromessa
    return
  }
  carregarWasmPromessa = loadLiteRtLm(WASM_CDN_DIR)
  await carregarWasmPromessa
}

let inicializacaoPromessa: Promise<EmbeddingEngine> | null = null
let backendAtivo: Backend = Backend.GPU

async function criarEngine(backend: Backend): Promise<EmbeddingEngine> {
  const blob = await obterBlobModelo()
  await garantirWasm()
  if (backend === Backend.GPU) {
    try {
      await setupDefaultWebGpuDevice()
    } catch (e) {
      console.warn('[GemmaEmbedder] Falha ao configurar WebGPU, usando CPU:', e)
      backend = Backend.CPU
    }
  }

  console.log(
    `[GemmaEmbedder] Criando EmbeddingEngine com Backend.${backend === Backend.GPU ? 'GPU' : 'CPU'}...`,
  )
  const engine = await EmbeddingEngine.create({
    model: blob,
    backend,
    maxInputLength: 1024,
  })
  backendAtivo = backend
  return engine
}

/**
 * Inicializa o motor de embedding LiteRT-LM (WebGPU com fallback automático para CPU).
 */
export async function inicializarEmbedder(forcarBackend?: Backend): Promise<EmbeddingEngine> {
  if (engineInstance) return engineInstance
  if (inicializacaoPromessa) return inicializacaoPromessa

  inicializacaoPromessa = (async () => {
    try {
      console.log('[GemmaEmbedder] Iniciando inicializarEmbedder...')
      notificar('verificando_hardware')
      const temGpu = await suportaWebGpu()
      console.log('[GemmaEmbedder] Suporte a WebGPU:', temGpu)

      const backendDesejado = forcarBackend ?? (temGpu ? Backend.GPU : Backend.CPU)

      notificar('inicializando_gpu')
      const engine = await criarEngine(backendDesejado)
      console.log('[GemmaEmbedder] EmbeddingEngine criado com sucesso!')
      engineInstance = engine
      notificar('pronto')
      return engine
    } catch (err) {
      mensagemErro = err instanceof Error ? err.message : String(err)
      console.error('[GemmaEmbedder] Falha ao inicializar embedder:', err)
      notificar('erro')
      inicializacaoPromessa = null
      throw err
    }
  })()

  return inicializacaoPromessa
}

/**
 * Gera o vetor de embedding da consulta, trunca para 256d e aplica Normalização L2 unitária.
 * Se o backend GPU produzir tensores zerados (comum no WebKit/Metal do iOS),
 * faz fallback automático para CPU (XNNPACK).
 */
export async function embedQuery(texto: string): Promise<Float32Array> {
  const consulta = texto.trim()
  if (!consulta) {
    return new Float32Array(256)
  }

  console.log('[GemmaEmbedder] embedQuery chamada:', { consulta })
  let engine = await inicializarEmbedder()
  let teveFallback = false

  let response = await engine.computeEmbedding(consulta, { normalize: true })
  let raw = response.embedding // array de números originais
  let rawLength = raw?.length ?? 0
  let hasNaN = raw?.some((x) => Number.isNaN(x)) ?? false
  let allZero = raw?.every((x) => x === 0) ?? false

  console.log('[GemmaEmbedder] computeEmbedding retorno inicial:', {
    backend: backendAtivo === Backend.GPU ? 'gpu' : 'cpu',
    inputLength: response.inputLength,
    numChunks: response.numChunks,
    rawLength,
    hasNaN,
    allZero,
    primeiros5: raw?.slice(0, 5),
  })

  // Se o backend GPU retornou vetor vazio ou zerado (comum em Metal/WebGPU no WebKit iOS devido a shaders não vinculados):
  if ((rawLength === 0 || allZero) && backendAtivo === Backend.GPU) {
    console.warn(
      '[GemmaEmbedder] Backend.GPU retornou vetor zerado/vazio. Alternando para Backend.CPU (XNNPACK)...',
    )
    teveFallback = true
    try {
      await engineInstance?.delete()
    } catch {}
    engineInstance = null
    inicializacaoPromessa = null

    engine = await criarEngine(Backend.CPU)
    engineInstance = engine
    response = await engine.computeEmbedding(consulta, { normalize: true })
    raw = response.embedding
    rawLength = raw?.length ?? 0
    hasNaN = raw?.some((x) => Number.isNaN(x)) ?? false
    allZero = raw?.every((x) => x === 0) ?? false

    console.log('[GemmaEmbedder] computeEmbedding retorno após fallback CPU:', {
      inputLength: response.inputLength,
      numChunks: response.numChunks,
      rawLength,
      hasNaN,
      allZero,
      primeiros5: raw?.slice(0, 5),
    })
  }

  ultimoDiagnosticoEmbedder = {
    rawLength,
    inputLength: response.inputLength,
    allZero,
    hasNaN,
    backendUsado: backendAtivo === Backend.GPU ? 'gpu' : 'cpu',
    teveFallbackCpu: teveFallback,
    tamanhoBlobMb: Number(((ultimoBlob?.size ?? 0) / (1024 * 1024)).toFixed(1)),
  }

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

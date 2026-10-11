/**
 * Gera embeddings canônicos para todas as 2.823 perícopes:
 * - 2 vetores por perícope:
 *     1. Bíblico: Título + Epígrafe + Texto Bíblico
 *     2. Temático: Título + Contexto + Resenha + Reflexões + Tópicos
 * - Modelo: embeddinggemma-2:latest (via Ollama local: http://127.0.0.1:11434/api/embed)
 * - Matryoshka Truncation: 768 → 256 dimensões
 * - L2 Normalization unitária em cada vetor
 * - Suporte a checkpoint/resumo incremental: data/embeddings-progresso.json
 * - Saída:
 *     public/data/embeddings-256.bin (Float32Array contíguo: 2.823 * 2 * 256 * 4 bytes ≈ 5,78 MB)
 *     public/data/embeddings-meta.json (metadados e mapeamento de ordens)
 *
 * Uso:
 *   npx tsx scripts/gerar-embeddings.ts --limit=5   (teste rápido)
 *   npx tsx scripts/gerar-embeddings.ts            (execução completa com checkpoint)
 *   npx tsx scripts/gerar-embeddings.ts --force    (ignora checkpoint e regera tudo)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pericope } from '../src/lib/types'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogoPath = join(root, 'data/pericopes.json')
const progressoPath = join(root, 'data/embeddings-progresso.json')
const outDir = join(root, 'public/data')
const binPath = join(outDir, 'embeddings-256.bin')
const metaPath = join(outDir, 'embeddings-meta.json')

// Parâmetros CLI
const args = process.argv.slice(2)
const getArg = (name: string, fallback: string): string => {
  const prefix = `--${name}=`
  const found = args.find((a) => a.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

const LIMIT = Number(getArg('limit', '0')) // 0 = sem limite
const FORCE = args.includes('--force')
const TARGET_DIM = Number(getArg('dim', '256'))
const BATCH_PERICOPES = Number(getArg('batch', '10')) // 10 perícopes = 20 textos por request
const MODEL_NAME = getArg('model', 'embeddinggemma-2:latest')
const OLLAMA_URL = getArg('url', 'http://127.0.0.1:11434')

export function prepararTextoBiblico(p: Pericope): string {
  const partes: string[] = [p.titulo_pericope_pt]
  if (p.sobrescrito) partes.push(p.sobrescrito)
  partes.push(p.texto)
  return partes.join('\n\n')
}

export function prepararTextoTematico(p: Pericope): string {
  const partes: string[] = [p.titulo_pericope_pt]
  if (p.contexto_historico_literario) partes.push(p.contexto_historico_literario)
  if (p.resenha) partes.push(p.resenha)
  if (p.perguntas_reflexao && p.perguntas_reflexao.length > 0) {
    partes.push(p.perguntas_reflexao.join('\n'))
  }
  if (p.topicos_pregar) partes.push(p.topicos_pregar)
  return partes.join('\n\n')
}

/**
 * Trunca para TARGET_DIM (Matryoshka) e aplica Normalização L2 (vetor unitário).
 */
export function matryoshkaL2(vec: number[], dim = TARGET_DIM): number[] {
  const slice = vec.slice(0, dim)
  let sumSq = 0
  for (let i = 0; i < slice.length; i++) {
    sumSq += slice[i] * slice[i]
  }
  const norm = Math.sqrt(sumSq) || 1
  return slice.map((v) => v / norm)
}

type CheckpointData = Record<
  number,
  {
    biblico: number[]
    tematico: number[]
  }
>

async function embedBatch(textos: string[]): Promise<number[][]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      input: textos,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro na API do Ollama (${res.status}): ${errText}`)
  }

  const data = (await res.json()) as { embeddings: number[][] }
  if (!data.embeddings || data.embeddings.length !== textos.length) {
    throw new Error(
      `Ollama retornou ${data.embeddings?.length ?? 0} embeddings para ${textos.length} textos.`,
    )
  }

  return data.embeddings
}

async function main() {
  console.log(`=== Gerador de Embeddings de Perícopes (Matryoshka ${TARGET_DIM}d) ===`)
  console.log(`Modelo Ollama: ${MODEL_NAME} em ${OLLAMA_URL}`)

  if (!existsSync(catalogoPath)) {
    console.error(`Erro: Catálogo não encontrado em ${catalogoPath}`)
    process.exit(1)
  }

  const pericopesRaw = JSON.parse(readFileSync(catalogoPath, 'utf-8')) as Pericope[]
  // O catálogo já deve ser ordenado por seq
  pericopesRaw.sort((a, b) => a.seq - b.seq)

  const pericopes = LIMIT > 0 ? pericopesRaw.slice(0, LIMIT) : pericopesRaw
  console.log(`Total de perícopes a processar: ${pericopes.length}`)

  // Carrega progresso anterior se houver
  let checkpoint: CheckpointData = {}
  if (!FORCE && existsSync(progressoPath)) {
    try {
      checkpoint = JSON.parse(readFileSync(progressoPath, 'utf-8'))
      console.log(`Checkpoint carregado: ${Object.keys(checkpoint).length} perícopes já calculadas.`)
    } catch {
      console.log('Checkpoint inválido. Começando do zero.')
    }
  }

  // Identifica pendentes
  const pendentes = pericopes.filter((p) => !checkpoint[p.ordem])
  console.log(`Pendentes de embedding: ${pendentes.length}`)

  const totalInicio = Date.now()
  let processadosNestaSessao = 0

  // Processa em lotes
  for (let i = 0; i < pendentes.length; i += BATCH_PERICOPES) {
    const lote = pendentes.slice(i, i + BATCH_PERICOPES)
    const textosLote: string[] = []

    for (const p of lote) {
      textosLote.push(prepararTextoBiblico(p))
      textosLote.push(prepararTextoTematico(p))
    }

    try {
      const t0 = Date.now()
      const rawEmbeddings = await embedBatch(textosLote)
      const duracao = Date.now() - t0

      // Mapeia de volta para as perícopes
      for (let j = 0; j < lote.length; j++) {
        const p = lote[j]
        const rawBiblico = rawEmbeddings[j * 2]
        const rawTematico = rawEmbeddings[j * 2 + 1]

        checkpoint[p.ordem] = {
          biblico: matryoshkaL2(rawBiblico, TARGET_DIM),
          tematico: matryoshkaL2(rawTematico, TARGET_DIM),
        }
      }

      processadosNestaSessao += lote.length
      const feitosTotal = Object.keys(checkpoint).length
      const percentual = ((feitosTotal / pericopes.length) * 100).toFixed(1)
      const msPorPericope = (duracao / lote.length).toFixed(0)

      console.log(
        `[${feitosTotal}/${pericopes.length} (${percentual}%)] +${lote.length} perícopes (${msPorPericope}ms/item)`,
      )

      // Salva checkpoint a cada 50 perícopes ou no fim
      if (processadosNestaSessao % 50 === 0 || i + BATCH_PERICOPES >= pendentes.length) {
        writeFileSync(progressoPath, JSON.stringify(checkpoint), 'utf-8')
      }
    } catch (err) {
      console.error(`Erro ao processar lote na posição ${i}:`, err)
      // Salva o que deu até aqui
      writeFileSync(progressoPath, JSON.stringify(checkpoint), 'utf-8')
      process.exit(1)
    }
  }

  // Grava o checkpoint final
  writeFileSync(progressoPath, JSON.stringify(checkpoint), 'utf-8')

  console.log(`\nEmbeddings concluídos em ${((Date.now() - totalInicio) / 1000).toFixed(1)}s!`)
  console.log('Montando arquivo binário e manifesto de metadados...')

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }

  // Gera o arquivo binário contíguo (Float32Array)
  // Estrutura: para cada perícope na ordem da lista:
  // [256 floats bíblico] [256 floats temático]
  const totalFloats = pericopes.length * 2 * TARGET_DIM
  const buffer = new Float32Array(totalFloats)
  const ordens: number[] = []

  let floatOffset = 0
  for (let i = 0; i < pericopes.length; i++) {
    const p = pericopes[i]
    const vetores = checkpoint[p.ordem]
    if (!vetores) {
      throw new Error(`Dados ausentes para a perícope ordem=${p.ordem}`)
    }

    ordens.push(p.ordem)

    // Escreve vetor bíblico
    for (let d = 0; d < TARGET_DIM; d++) {
      buffer[floatOffset + d] = vetores.biblico[d]
    }
    floatOffset += TARGET_DIM

    // Escreve vetor temático
    for (let d = 0; d < TARGET_DIM; d++) {
      buffer[floatOffset + d] = vetores.tematico[d]
    }
    floatOffset += TARGET_DIM
  }

  // Grava binário em data/ e public/data/
  const nodeBuffer = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const dataBinPath = join(root, 'data/embeddings-256.bin')
  writeFileSync(binPath, nodeBuffer)
  writeFileSync(dataBinPath, nodeBuffer)
  console.log(`Salvo binário: ${binPath} (${(nodeBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB)`)

  // Grava manifesto JSON em data/ e public/data/
  const meta = {
    modelo: MODEL_NAME,
    dimensoes: TARGET_DIM,
    totalPericopes: pericopes.length,
    stridePorPericope: TARGET_DIM * 2,
    ordens,
    geradoEm: new Date().toISOString(),
  }
  const metaJson = JSON.stringify(meta, null, 2)
  const dataMetaPath = join(root, 'data/embeddings-meta.json')
  writeFileSync(metaPath, metaJson, 'utf-8')
  writeFileSync(dataMetaPath, metaJson, 'utf-8')
  console.log(`Salvo manifesto: ${metaPath}`)
  console.log('Concluído com sucesso!')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Falha fatal:', err)
    process.exit(1)
  })
}

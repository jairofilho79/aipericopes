/**
 * Script para gerar a perícope completa de Gênesis 1 (ordem 0) com a voz Algenib
 * no Gemini 3.1 Flash TTS (OpenRouter), nas variantes V1 (Dinâmica & Contrastante)
 * e V3 (Ágil com Destaque Dramático).
 *
 * Uso:
 *   npx tsx scripts/gerar-pericope-algenib-completa.ts --variante=v1
 *   npx tsx scripts/gerar-pericope-algenib-completa.ts --variante=v3
 *   npx tsx scripts/gerar-pericope-algenib-completa.ts --variante=ambas
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = join(import.meta.dirname, '..')
const roteiroPath = '/Volumes/SSD 2TB SD/dev/tts-spike/roteiro.jsonl'
const outBaseDir = join(root, 'amostras', 'pericope-completa')

const SR = 24000
const BYTES_POR_SEG = SR * 2 // 16-bit mono = 48.000 bytes/s
const PAUSA_U = 0.4 // pausa entre versículos/unidades da mesma seção
const PAUSA_S = 0.8 // pausa entre seções diferentes

interface UnidadeRoteiro {
  ordem: number
  livro: string
  i: number
  secao: 'titulo' | 'contexto' | 'texto' | 'resenha' | 'palavras' | 'reflexoes'
  texto: string
  n_unid: number
}

function obterOpenRouterKey(): string {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim()
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      if (line.startsWith('OPENROUTER_API_KEY=')) {
        return line.split('=', 2)[1].trim()
      }
    }
  }
  throw new Error('OPENROUTER_API_KEY não encontrada no .env.')
}

const PROMPTS_V1 = {
  base: (
    'Narrate in Brazilian Portuguese with the voice of Algenib as a professional scripture narrator. '
  ),
  titulo: (
    'Announce this title with solemn gravity, like opening a sacred book. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  contexto: (
    'Explain with the warmth of a teacher who loves this story, naturally expressive and engaging. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  texto: (
    'Deliver the narrative and descriptive text with a natural, fluid, and engaging momentum — ' +
    'never dragging, sluggish, or monotonous. Keep the story alive and active for a reader following along. ' +
    'Only when delivering direct speech or solemn decrees from God (such as "E disse Deus: Haja luz"), ' +
    'slow down naturally to add majestic weight, authority, and reverent pause. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  resenha: (
    'Interpret alongside the reader, warm, thoughtful, and fluid, like sharing an exciting discovery. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  palavras: (
    'Explain what this word means plainly and clearly, the way an engaging teacher defines a term. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  reflexoes: (
    'Ask with genuine curiosity — truly inquisitive, inviting quiet contemplation, with a natural rise on the question. ' +
    'Read only the text below, nothing else:\n\n'
  ),
}

const PROMPTS_V3 = {
  base: (
    'Narrate in Brazilian Portuguese with the voice of Algenib as an active, captivating narrator. '
  ),
  titulo: (
    'Deliver this sacred title with crisp, dignified authority. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  contexto: (
    'Deliver this historical background in a brisk, lively, and conversational storytelling rhythm. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  texto: (
    'Use a brisk, expressive and active reading pace throughout the passage. ' +
    'Avoid slow, heavy or liturgical cadences in the narration. ' +
    'Infuse only the words uttered by God with deliberate weight, quiet power, and solemnity. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  resenha: (
    'Explain these insights with energetic momentum, clear, agile, and captivating. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  palavras: (
    'Define these terms briskly, clearly, and engagingly. ' +
    'Read only the text below, nothing else:\n\n'
  ),
  reflexoes: (
    'Ask these questions directly, prompting active personal engagement. ' +
    'Read only the text below, nothing else:\n\n'
  ),
}

async function sintetizarUnidade(
  apiKey: string,
  unidade: UnidadeRoteiro,
  promptSecao: string,
  cacheDir: string,
): Promise<Buffer> {
  const rawFile = join(cacheDir, `u${unidade.i.toString().padStart(2, '0')}.raw`)

  if (existsSync(rawFile)) {
    return readFileSync(rawFile)
  }

  const url = 'https://openrouter.ai/api/v1/audio/speech'
  let ultimoErro: any = null

  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.1-flash-tts-preview',
          voice: 'Algenib',
          input: promptSecao + unidade.texto,
          response_format: 'pcm',
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }

      const ab = await res.arrayBuffer()
      const buf = Buffer.from(ab)

      if (buf.length < 2000) {
        throw new Error(`Resposta curta demais (${buf.length} bytes)`)
      }

      writeFileSync(rawFile, buf)
      return buf
    } catch (err: any) {
      ultimoErro = err
      console.warn(`  [Retry ${tentativa}/4] u${unidade.i.toString().padStart(2, '0')}: ${err.message}`)
      await new Promise((resolve) => setTimeout(resolve, tentativa * 2000))
    }
  }

  throw new Error(`Falha definitiva na unidade ${unidade.i}: ${ultimoErro?.message}`)
}

async function poolExecutar<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      results[idx] = await fn(items[idx], idx)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

async function gerarVariante(varianteKey: 'v1' | 'v3', apiKey: string, unidades: UnidadeRoteiro[]) {
  const nomeVariante = varianteKey === 'v1'
    ? 'Variante 1: Dinâmica e Contrastante'
    : 'Variante 3: Ágil com Destaque Dramático'

  const promptConfig = varianteKey === 'v1' ? PROMPTS_V1 : PROMPTS_V3
  const dirVariante = join(outBaseDir, `algenib_${varianteKey}`)
  const cacheDir = join(dirVariante, 'unidades')
  mkdirSync(cacheDir, { recursive: true })

  console.log(`\n==================================================================`)
  console.log(`  GERANDO PERÍCOPE COMPLETA — ${nomeVariante}`)
  console.log(`  Total de unidades: ${unidades.length} | Concorrência: 6`)
  console.log(`==================================================================`)

  let processadas = 0
  const t0 = Date.now()

  const rawBuffers = await poolExecutar(unidades, 6, async (u) => {
    let promptSecao: string
    if (['Texto Bíblico.', 'Contexto.', 'Resenha.', 'Reflexões.', 'As palavras do trecho.'].includes(u.texto.trim())) {
      promptSecao = promptConfig.base + 'Announce this section heading clearly, naturally and briskly. Read only the text below, nothing else:\n\n'
    } else {
      promptSecao = promptConfig.base + (promptConfig as any)[u.secao]
    }
    const buf = await sintetizarUnidade(apiKey, u, promptSecao, cacheDir)
    processadas++
    const seg = (buf.length / BYTES_POR_SEG).toFixed(1)
    console.log(`  [${processadas}/${unidades.length}] u${u.i.toString().padStart(2, '0')} (${u.secao}): ${seg}s — "${u.texto.slice(0, 45)}..."`)
    return buf
  })

  console.log(`\n⚡ Todas as ${unidades.length} unidades sintetizadas em ${((Date.now() - t0) / 1000).toFixed(1)}s.`)
  console.log(`Costurando áudio com silêncios cênicos (0.4s unidades / 0.8s seções)...`)

  // Costurar com pausas e montar manifesto
  const partes: Buffer[] = []
  const manifestoUnidades = []
  let tempoAcumulado = 0
  let secaoAnterior: string | null = null

  for (let i = 0; i < unidades.length; i++) {
    const u = unidades[i]
    const raw = rawBuffers[i]
    const duracaoSeg = raw.length / BYTES_POR_SEG

    if (i > 0) {
      const pausa = (u.secao !== secaoAnterior ? PAUSA_S : PAUSA_U)
      const pausaBytes = Math.round(pausa * BYTES_POR_SEG)
      partes.push(Buffer.alloc(pausaBytes))
      tempoAcumulado += pausa
    }

    manifestoUnidades.push({
      i: u.i,
      secao: u.secao,
      texto: u.texto,
      inicio: parseFloat(tempoAcumulado.toFixed(3)),
      dur: parseFloat(duracaoSeg.toFixed(3)),
    })

    partes.push(raw)
    tempoAcumulado += duracaoSeg
    secaoAnterior = u.secao
  }

  const masterRawPath = join(dirVariante, '_master.raw')
  const masterBuf = Buffer.concat(partes)
  writeFileSync(masterRawPath, masterBuf)

  const finalM4a = join(outBaseDir, `algenib_${varianteKey}_gn1.m4a`)
  console.log(`Normalizando master EBU R128 (-14.7 LUFS, True Peak -1.0 dBTP)...`)

  const ffmpegCmd = [
    'ffmpeg', '-y', '-v', 'error',
    '-f', 's16le', '-ar', `${SR}`, '-ac', '1',
    '-i', `"${masterRawPath}"`,
    '-af', '"loudnorm=I=-14.7:TP=-1.0:LRA=7"',
    '-c:a', 'aac', '-b:a', '64k',
    '-movflags', '+faststart',
    `"${finalM4a}"`,
  ].join(' ')

  execSync(ffmpegCmd)
  unlinkSync(masterRawPath)

  // Gravar manifesto da perícope
  const manifest = {
    ordem: 0,
    variante: varianteKey,
    voz: 'Algenib',
    dur_total: parseFloat(tempoAcumulado.toFixed(3)),
    unidades: manifestoUnidades,
  }
  const manifestPath = join(outBaseDir, `manifest_${varianteKey}.json`)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  const durFinal = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalM4a}"`,
  ).toString().trim()

  const min = Math.floor(parseFloat(durFinal) / 60)
  const sec = Math.round(parseFloat(durFinal) % 60)

  console.log(`\n✅ ${nomeVariante} concluída!`)
  console.log(`  Arquivo final: ${finalM4a}`)
  console.log(`  Duração:       ${min}m ${sec}s (${parseFloat(durFinal).toFixed(1)}s)`)
  console.log(`  Manifesto:     ${manifestPath}`)
  console.log(`  Para ouvir:    open "${finalM4a}"\n`)

  return { varianteKey, finalM4a, duracao: `${min}m ${sec}s` }
}

async function main() {
  const args = process.argv.slice(2)
  let varianteArg = 'ambas'
  for (const a of args) {
    if (a.startsWith('--variante=')) varianteArg = a.split('=')[1]
  }

  const apiKey = obterOpenRouterKey()

  console.log(`Carregando roteiro canônico de Gênesis 1 de ${roteiroPath}...`)
  const linhas = readFileSync(roteiroPath, 'utf8').split('\n').filter((l) => l.trim())
  const unidades: UnidadeRoteiro[] = linhas
    .map((l) => JSON.parse(l))
    .filter((u: UnidadeRoteiro) => u.ordem === 0)

  if (unidades.length === 0) {
    throw new Error('Nenhuma unidade encontrada para ordem 0 em roteiro.jsonl.')
  }

  mkdirSync(outBaseDir, { recursive: true })

  const resultados = []

  if (varianteArg === 'v1' || varianteArg === 'ambas') {
    const r = await gerarVariante('v1', apiKey, unidades)
    resultados.push(r)
  }

  if (varianteArg === 'v3' || varianteArg === 'ambas') {
    const r = await gerarVariante('v3', apiKey, unidades)
    resultados.push(r)
  }

  console.log('==================================================================')
  console.log('  RESUMO FINAL DA GERAÇÃO COMPLETA')
  console.log('==================================================================')
  for (const r of resultados) {
    console.log(`• ${r.varianteKey.toUpperCase()}: ${r.duracao}`)
    console.log(`  open "${r.finalM4a}"`)
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

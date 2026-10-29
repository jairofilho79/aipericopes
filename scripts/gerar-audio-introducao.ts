/**
 * Gerador de Narração e Manifesto para Introduções dos Livros Bíblicos
 *
 * Utiliza o modelo Gemini 3.8 Flash TTS via Google Interactions API
 * com voz Algenib e masterização EBU R128 (-14.7 LUFS mono AAC 24 kHz).
 *
 * Uso:
 *   npx tsx scripts/gerar-audio-introducao.ts --slug=genesis
 *   npx tsx scripts/gerar-audio-introducao.ts --todos
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, cpSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = join(import.meta.dirname, '..')
const dataIntrosDir = join(root, 'data', 'introducoes')
const publicIntrosDir = join(root, 'public', 'data', 'introducoes')
const corpusDir = join(root, 'amostras', 'corpus-introducoes')

mkdirSync(publicIntrosDir, { recursive: true })
mkdirSync(corpusDir, { recursive: true })

const SR = 24000
const BYTES_POR_SEG = SR * 2 // 16-bit mono = 48.000 B/s
const PAUSA_ENTRE_SECOES = 0.6 // segundos

function obterGeminiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      if (line.startsWith('GEMINI_API_KEY=')) {
        return line.split('=', 2)[1].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
  throw new Error('GEMINI_API_KEY não configurada no .env')
}

const BASE_STYLE =
  'Brazilian Portuguese narrator with native pt-BR accent. An active, captivated, and curious storyteller with genuine vitality and momentum. Bright, warm, and engaging vocal energy. Strictly avoid tired, sleepy, bored, or sluggish delivery. Natural medium pitch, mature and insightful, never childish.'

interface UnidadeNarracao {
  id: string
  subtitulo: string
  texto: string
}

async function sintetizarTexto38(
  texto: string,
  cacheFile: string,
  apiKey: string,
  maxTentativas = 4
): Promise<Buffer> {
  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile)
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/interactions'
  const payload = {
    model: 'gemini-3.8-flash-tts',
    input: [
      {
        type: 'user_input',
        content: [
          {
            type: 'text',
            text: texto,
            annotations: [
              {
                type: 'speech_metadata',
                style: `${BASE_STYLE} Read with reverence, elegance, and natural spoken rhythm.`,
              },
            ],
          },
        ],
      },
    ],
    response_format: { type: 'audio' },
    generation_config: {
      speech_config: [{ voice: 'Algenib' }],
    },
  }

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (res.status === 429 || res.status >= 500) {
      const espera = tentativa * 6
      console.log(`    ⏳ [HTTP ${res.status}] Aguardando ${espera}s (tentativa ${tentativa}/${maxTentativas})...`)
      await new Promise((r) => setTimeout(r, espera * 1000))
      continue
    }

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Google Interactions HTTP ${res.status}: ${errText}`)
    }

    const data = await res.json()
    let b64: string | null = null

    if (data.output_audio?.data) {
      b64 = data.output_audio.data
    } else if (data.steps) {
      for (const s of data.steps) {
        if (s.content) {
          for (const c of s.content) {
            if (c.type === 'audio' && c.data) b64 = c.data
          }
        }
      }
    }

    if (!b64) throw new Error('Resposta sem áudio')

    const tmpWav = `${cacheFile}.tmp.wav`
    writeFileSync(tmpWav, Buffer.from(b64, 'base64'))
    execSync(`ffmpeg -y -v error -i "${tmpWav}" -f s16le -acodec pcm_s16le -ac 1 -ar ${SR} "${cacheFile}"`)
    try { unlinkSync(tmpWav) } catch {}

    return readFileSync(cacheFile)
  }

  throw new Error(`Falha após ${maxTentativas} tentativas de sintetizar`)
}

export async function processarIntroducao(slug: string, apiKey: string) {
  const jsonPath = join(dataIntrosDir, `${slug}.json`)
  if (!existsSync(jsonPath)) {
    throw new Error(`Arquivo não encontrado: ${jsonPath}`)
  }

  const introData = JSON.parse(readFileSync(jsonPath, 'utf8'))
  console.log(`\n🎙️  [${slug}] Gerando narração: "${introData.titulo_introducao}"`)

  const bookCacheDir = join(corpusDir, slug)
  mkdirSync(bookCacheDir, { recursive: true })

  // Construir as unidades de áudio:
  // Unidade 0: Cabeçalho geral
  // Unidades 1..n: Seções com subtítulo + texto
  const unidades: UnidadeNarracao[] = [
    {
      id: 'cabecalho',
      subtitulo: introData.titulo_canonico || introData.livro,
      texto: `${introData.titulo_canonico}. ${introData.titulo_introducao}.`,
    },
    ...introData.secoes.map((s: any) => ({
      id: s.id,
      subtitulo: s.subtitulo,
      texto: `${s.subtitulo}. ${s.texto}`,
    })),
  ]

  const rawBuffers: Buffer[] = []
  for (let i = 0; i < unidades.length; i++) {
    const u = unidades[i]
    const cacheFile = join(bookCacheDir, `u_${i}_${u.id}.raw`)
    const buf = await sintetizarTexto38(u.texto, cacheFile, apiKey)
    rawBuffers.push(buf)
    // pausa de 2s para respeitar limites de taxa se sintetizou novo
    await new Promise((r) => setTimeout(r, 2000))
  }

  // Costura e cálculo do manifesto
  const partes: Buffer[] = []
  const manifestoUnidades = []
  let tempoAcumulado = 0

  for (let i = 0; i < unidades.length; i++) {
    const u = unidades[i]
    const raw = rawBuffers[i]
    const duracaoSeg = raw.length / BYTES_POR_SEG

    if (i > 0) {
      const pausaBytes = Math.round(PAUSA_ENTRE_SECOES * BYTES_POR_SEG)
      partes.push(Buffer.alloc(pausaBytes))
      tempoAcumulado += PAUSA_ENTRE_SECOES
    }

    manifestoUnidades.push({
      i,
      id: u.id,
      subtitulo: u.subtitulo,
      texto: u.texto,
      inicio: parseFloat(tempoAcumulado.toFixed(3)),
      dur: parseFloat(duracaoSeg.toFixed(3)),
    })

    partes.push(raw)
    tempoAcumulado += duracaoSeg
  }

  const masterRaw = join(bookCacheDir, '_master.raw')
  writeFileSync(masterRaw, Buffer.concat(partes))

  const finalM4a = join(publicIntrosDir, `${slug}.m4a`)
  const finalCorpusM4a = join(bookCacheDir, 'intro.m4a')

  const ffmpegCmd = [
    'ffmpeg', '-y', '-v', 'error',
    '-f', 's16le', '-ar', `${SR}`, '-ac', '1',
    '-i', `"${masterRaw}"`,
    '-af', '"loudnorm=I=-14.7:TP=-1.0:LRA=7"',
    '-c:a', 'aac', '-b:a', '64k',
    '-movflags', '+faststart',
    `"${finalM4a}"`,
  ].join(' ')

  execSync(ffmpegCmd)
  cpSync(finalM4a, finalCorpusM4a)
  try { unlinkSync(masterRaw) } catch {}

  // Atualiza os dados da introdução com os metadados de áudio e sincronia
  introData.audio = {
    arquivo: `${slug}.m4a`,
    duracao_segundos: parseFloat(tempoAcumulado.toFixed(3)),
    duracao_minutos: Math.ceil(tempoAcumulado / 60),
    voz: 'Algenib',
    modelo: 'gemini-3.8-flash-tts',
    unidades: manifestoUnidades,
  }

  // Grava de volta em data/ e public/data/
  writeFileSync(jsonPath, JSON.stringify(introData, null, 2))
  writeFileSync(join(publicIntrosDir, `${slug}.json`), JSON.stringify(introData, null, 2))

  console.log(`  ✅ [${slug}] Concluído com sucesso! Duração: ${tempoAcumulado.toFixed(1)}s -> ${finalM4a}`)
}

async function main() {
  const apiKey = obterGeminiKey()
  const args = process.argv.slice(2)
  let slug: string | null = null
  let processarTodos = false

  for (const a of args) {
    if (a.startsWith('--slug=')) slug = a.split('=')[1]
    if (a.startsWith('--livro=')) slug = a.split('=')[1]
    if (a === '--todos') processarTodos = true
  }

  if (slug) {
    await processarIntroducao(slug, apiKey)
  } else if (processarTodos) {
    const arquivos = readdirSync(dataIntrosDir).filter((f) => f.endsWith('.json'))
    console.log(`Encontrados ${arquivos.length} livros para gerar áudio...`)
    for (const f of arquivos) {
      const s = f.replace('.json', '')
      try {
        await processarIntroducao(s, apiKey)
      } catch (err: any) {
        console.error(`❌ Erro em ${s}:`, err.message)
      }
    }
  } else {
    console.log('Uso: npx tsx scripts/gerar-audio-introducao.ts --slug=genesis (ou --todos)')
  }
}

main().catch((err) => {
  console.error('\n❌ Erro geral:', err)
  process.exit(1)
})

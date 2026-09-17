/**
 * Script para testar e calibrar a voz Charon no Gemini 3.1 Flash TTS (via OpenRouter),
 * comparando o prompt histórico ("unhurried") com o prompt calibrado de ritmo fluido,
 * além de Enceladus e Algenib no mesmo motor.
 *
 * Uso: npx tsx scripts/testar-charon-calibrado.ts
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = join(import.meta.dirname, '..')
const outDir = join(root, 'amostras', 'comparativo-charon')

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
  throw new Error('OPENROUTER_API_KEY não encontrada no .env ou no ambiente.')
}

const TEXTO = (
  'No princípio criou Deus os céus e a terra. ' +
  'E a terra estava desordenada e vazia; e as trevas estavam sobre a face do abismo. ' +
  'E o Espírito de Deus se movia sobre a face das águas. ' +
  'E disse Deus: Haja luz. E houve luz.'
)

const TAKES = [
  {
    id: 'charon_original',
    nome: 'Charon (Prompt Histórico 2/set - Lento)',
    voice: 'Charon',
    prompt: (
      'Narrate in Brazilian Portuguese as a professional scripture narrator: ' +
      'deep, warm male voice, genuinely engaged — feeling the text alongside the listener, never flat. ' +
      'This is sacred scripture: solemn reverence, unhurried, letting the weight of each phrase land. ' +
      'Read only the text below, nothing else:\n\n'
    ),
  },
  {
    id: 'charon_calibrado',
    nome: 'Charon (Prompt Calibrado - Ritmo Fluido & Solene)',
    voice: 'Charon',
    prompt: (
      'Narrate in Brazilian Portuguese as a professional scripture narrator: ' +
      'deep, warm male voice, solemn reverence, naturally engaged and expressive — never flat. ' +
      'Maintain a steady, natural and fluent narrative pace: neither rushed nor dragging. ' +
      'Read only the text below, nothing else:\n\n'
    ),
  },
  {
    id: 'enceladus_calibrado',
    nome: 'Enceladus (Prompt Calibrado - Comparativo)',
    voice: 'Enceladus',
    prompt: (
      'Narrate in Brazilian Portuguese as a professional scripture narrator: ' +
      'deep, warm male voice, solemn reverence, naturally engaged and expressive — never flat. ' +
      'Maintain a steady, natural and fluent narrative pace: neither rushed nor dragging. ' +
      'Read only the text below, nothing else:\n\n'
    ),
  },
  {
    id: 'algenib_calibrado',
    nome: 'Algenib (Prompt Calibrado - Comparativo)',
    voice: 'Algenib',
    prompt: (
      'Narrate in Brazilian Portuguese as a professional scripture narrator: ' +
      'solemn reverence, naturally engaged and expressive — never flat. ' +
      'Maintain a steady, natural and fluent narrative pace: neither rushed nor dragging. ' +
      'Read only the text below, nothing else:\n\n'
    ),
  },
]

async function sintetizar(take: typeof TAKES[number], apiKey: string): Promise<string> {
  console.log(`\n🎙️  Gerando ${take.nome}...`)
  const url = 'https://openrouter.ai/api/v1/audio/speech'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.1-flash-tts-preview',
      voice: take.voice,
      input: take.prompt + TEXTO,
      response_format: 'pcm',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro na síntese de ${take.voice} (HTTP ${res.status}): ${errText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  console.log(`   Recebido PCM: ${buffer.length} bytes (~${(buffer.length / 48000).toFixed(1)}s de áudio cru)`)

  const rawPath = join(outDir, `_temp_${take.id}.raw`)
  const m4aPath = join(outDir, `${take.id}.m4a`)

  writeFileSync(rawPath, buffer)

  // Normalização EBU R128 (-14.7 LUFS, TP -1.0) e codificação AAC mono 24 kHz
  const ffmpegCmd = [
    'ffmpeg', '-y', '-v', 'error',
    '-f', 's16le', '-ar', '24000', '-ac', '1',
    '-i', `"${rawPath}"`,
    '-af', '"loudnorm=I=-14.7:TP=-1.0:LRA=7"',
    '-c:a', 'aac', '-b:a', '64k',
    '-movflags', '+faststart',
    `"${m4aPath}"`,
  ].join(' ')

  execSync(ffmpegCmd)
  unlinkSync(rawPath)

  // Medir duração final
  const durStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${m4aPath}"`,
  ).toString().trim()
  const durSec = parseFloat(durStr)

  console.log(`   Salvo: ${m4aPath} (${durSec.toFixed(1)}s, -14.7 LUFS)`)
  return m4aPath
}

async function main() {
  const apiKey = obterOpenRouterKey()
  mkdirSync(outDir, { recursive: true })

  console.log('==================================================================')
  console.log('  TESTE E CALIBRAÇÃO DE PROMPTS — GEMINI 3.1 FLASH TTS')
  console.log('==================================================================')

  const resultados: { id: string; nome: string; path: string; dur: string }[] = []

  for (const take of TAKES) {
    try {
      const path = await sintetizar(take, apiKey)
      const dur = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${path}"`,
      ).toString().trim()
      resultados.push({ id: take.id, nome: take.nome, path, dur: `${parseFloat(dur).toFixed(1)}s` })
    } catch (err: any) {
      console.error(`❌ Erro em ${take.id}:`, err.message)
    }
  }

  console.log('\n==================================================================')
  console.log('  RESULTADOS DOS TAKES')
  console.log('==================================================================')
  for (const r of resultados) {
    console.log(`• [${r.dur}] ${r.nome}`)
    console.log(`  open "${r.path}"`)
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

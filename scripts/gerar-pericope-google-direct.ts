/**
 * Script para gerar a narração completa da perícope diretamente via
 * Google AI Studio API (generativelanguage.googleapis.com) utilizando
 * os créditos promocionais do Google Cloud (US$ 300).
 *
 * Uso:
 *   npx tsx scripts/gerar-pericope-google-direct.ts [--ordem=0] [--voz=Algenib] [--variante=v3]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = join(import.meta.dirname, '..')
const roteiroPath = '/Volumes/SSD 2TB SD/dev/tts-spike/roteiro.jsonl'
const outBaseDir = join(root, 'amostras', 'google-direct')

const SR = 24000
const BYTES_POR_SEG = SR * 2 // 16-bit mono = 48.000 bytes/s
const PAUSA_U = 0.4 // pausa entre unidades da mesma seção
const PAUSA_S = 0.8 // pausa entre seções diferentes

interface UnidadeRoteiro {
  ordem: number
  livro: string
  i: number
  secao: 'titulo' | 'contexto' | 'texto' | 'resenha' | 'palavras' | 'reflexoes'
  texto: string
  n_unid: number
}

function obterGeminiApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      if (line.startsWith('GEMINI_API_KEY=')) {
        return line.split('=', 2)[1].trim()
      }
    }
  }
  const ttsKeyPath = join(root, '.tts-key.local')
  if (existsSync(ttsKeyPath)) {
    return readFileSync(ttsKeyPath, 'utf8').trim()
  }
  throw new Error(
    'Chave GEMINI_API_KEY não encontrada!\n' +
    'Por favor, crie uma chave em https://aistudio.google.com/app/apikey ' +
    'e adicione no arquivo .env: GEMINI_API_KEY="AIzaSy..."'
  )
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
  cabecalho: (
    'Announce this section heading clearly, naturally, and briskly. ' +
    'Read only the text below, nothing else:\n\n'
  ),
}

async function sintetizarGoogleDirect(
  apiKey: string,
  prompt: string,
  voz: string,
  modelo = 'gemini-3.1-flash-tts-preview',
): Promise<{ buffer: Buffer; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voz,
          },
        },
      },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Google API HTTP ${res.status}: ${errorBody}`)
  }

  const json = await res.json()
  const candidate = json.candidates?.[0]
  const part = candidate?.content?.parts?.[0]

  if (!part?.inlineData?.data) {
    throw new Error(`Resposta da API Google não conteve áudio inlineData: ${JSON.stringify(json)}`)
  }

  const mimeType = part.inlineData.mimeType || 'audio/wav'
  const buffer = Buffer.from(part.inlineData.data, 'base64')
  return { buffer, mimeType }
}

async function main() {
  const args = process.argv.slice(2)
  let ordem = 0
  let voz = 'Algenib'
  let modelo = 'gemini-3.1-flash-tts-preview'

  for (const a of args) {
    if (a.startsWith('--ordem=')) ordem = parseInt(a.split('=')[1], 10)
    if (a.startsWith('--voz=')) voz = a.split('=')[1]
    if (a.startsWith('--modelo=')) modelo = a.split('=')[1]
  }

  const apiKey = obterGeminiApiKey()

  console.log('==================================================================')
  console.log('  GERAÇÃO DIRETA GOOGLE AI STUDIO (CRÉDITOS GOOGLE CLOUD)')
  console.log(`  Ordem: ${ordem} | Voz: ${voz} | Modelo: ${modelo}`)
  console.log('==================================================================\n')

  // Teste de conexão
  console.log('🔍 Testando conexão e autenticação com a API do Google...')
  try {
    const pingRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    )
    if (!pingRes.ok) {
      const err = await pingRes.text()
      throw new Error(`Falha na autenticação da chave Google: ${err}`)
    }
    console.log('✅ Chave Google AI Studio autenticada com sucesso!')
  } catch (err: any) {
    console.error('❌ Erro de conexão:', err.message)
    console.log('\n💡 Para ativar a chave nos créditos de US$ 300:')
    console.log('1. Vá em https://aistudio.google.com/app/apikey')
    console.log('2. Crie uma chave selecionando seu projeto do Google Cloud')
    console.log('3. Adicione ao .env: GEMINI_API_KEY="AIzaSy..."\n')
    process.exit(1)
  }

  // Carregar roteiro
  console.log(`Carregando roteiro da ordem ${ordem}...`)
  const linhas = readFileSync(roteiroPath, 'utf8').split('\n').filter((l) => l.trim())
  const unidades: UnidadeRoteiro[] = linhas
    .map((l) => JSON.parse(l))
    .filter((u: UnidadeRoteiro) => u.ordem === ordem)

  if (unidades.length === 0) {
    throw new Error(`Nenhuma unidade encontrada para a ordem ${ordem}.`)
  }

  const outDir = join(outBaseDir, `ordem_${ordem.toString().padStart(4, '0')}_${voz.toLowerCase()}`)
  const cacheDir = join(outDir, 'unidades')
  mkdirSync(cacheDir, { recursive: true })

  console.log(`Total de unidades a sintetizar: ${unidades.length}`)
  console.log(`Diretório de saída: ${outDir}\n`)

  const rawFiles: string[] = []
  const manifestoUnidades = []
  let tempoAcumulado = 0
  let secaoAnterior: string | null = null

  for (let i = 0; i < unidades.length; i++) {
    const u = unidades[i]
    const pcmPath = join(cacheDir, `u${u.i.toString().padStart(2, '0')}.raw`)

    let prompt: string
    if (['Texto Bíblico.', 'Contexto.', 'Resenha.', 'Reflexões.', 'As palavras do trecho.'].includes(u.texto.trim())) {
      prompt = PROMPTS_V3.base + PROMPTS_V3.cabecalho + u.texto
    } else {
      prompt = PROMPTS_V3.base + (PROMPTS_V3 as any)[u.secao] + u.texto
    }

    if (!existsSync(pcmPath)) {
      console.log(`- [${i + 1}/${unidades.length}] Sintetizando u${u.i.toString().padStart(2, '0')} (${u.secao})...`)
      let sintetizado = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { buffer, mimeType } = await sintetizarGoogleDirect(apiKey, prompt, voz, modelo)
          // Salvar temporário para converter com ffmpeg em PCM 24k mono
          const tempAudio = join(cacheDir, `_temp_${u.i}.${mimeType.includes('wav') ? 'wav' : 'mp3'}`)
          writeFileSync(tempAudio, buffer)

          // Converte para PCM s16le 24000 Hz mono
          execSync(
            `ffmpeg -y -v error -i "${tempAudio}" -f s16le -ar ${SR} -ac 1 "${pcmPath}"`,
          )
          unlinkSync(tempAudio)
          sintetizado = true
          break
        } catch (e: any) {
          console.warn(`  Retry ${attempt}/3 u${u.i}: ${e.message}`)
          await new Promise((r) => setTimeout(r, 2000 * attempt))
        }
      }
      if (!sintetizado) {
        throw new Error(`Falha definitiva ao sintetizar u${u.i} no Google AI Studio.`)
      }
      // Rate limit suave para não estourar quotas do tier
      await new Promise((r) => setTimeout(r, 400))
    }

    const rawSize = readFileSync(pcmPath).length
    const duracaoSeg = rawSize / BYTES_POR_SEG

    if (i > 0) {
      const pausa = u.secao !== secaoAnterior ? PAUSA_S : PAUSA_U
      tempoAcumulado += pausa
    }

    manifestoUnidades.push({
      i: u.i,
      secao: u.secao,
      texto: u.texto,
      inicio: parseFloat(tempoAcumulado.toFixed(3)),
      dur: parseFloat(duracaoSeg.toFixed(3)),
    })

    rawFiles.push(pcmPath)
    tempoAcumulado += duracaoSeg
    secaoAnterior = u.secao
  }

  // Costurar master PCM
  console.log('\nCosturando áudio completo...')
  const partes: Buffer[] = []
  secaoAnterior = null
  for (let i = 0; i < unidades.length; i++) {
    const u = unidades[i]
    if (i > 0) {
      const pausa = u.secao !== secaoAnterior ? PAUSA_S : PAUSA_U
      partes.push(Buffer.alloc(Math.round(pausa * BYTES_POR_SEG)))
    }
    partes.push(readFileSync(rawFiles[i]))
    secaoAnterior = u.secao
  }

  const masterRaw = join(outDir, '_master.raw')
  writeFileSync(masterRaw, Buffer.concat(partes))

  const finalM4a = join(outDir, `pericope_${ordem}_${voz.toLowerCase()}.m4a`)
  console.log(`Normalizando para padrão do app (-14.7 LUFS AAC mono): ${finalM4a}`)

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
  unlinkSync(masterRaw)

  const manifest = {
    ordem,
    voz,
    modelo,
    dur_total: parseFloat(tempoAcumulado.toFixed(3)),
    unidades: manifestoUnidades,
  }
  const manifestPath = join(outDir, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  const min = Math.floor(tempoAcumulado / 60)
  const sec = Math.round(tempoAcumulado % 60)

  console.log('\n==================================================================')
  console.log('✅ GERAÇÃO DIRETA GOOGLE CONCLUÍDA!')
  console.log(`  Áudio final: ${finalM4a} (${min}m ${sec}s)`)
  console.log(`  Manifesto:   ${manifestPath}`)
  console.log(`  Para ouvir:  open "${finalM4a}"`)
  console.log('==================================================================\n')
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err.message)
  process.exit(1)
})

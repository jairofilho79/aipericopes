/**
 * Script para gerar testes curtos (~15s) de 5 vozes masculinas no Cloud TTS:
 * Charon, Fenrir, Enceladus, Alnilam, Zubenelgenubi.
 *
 * Uso: npx tsx scripts/testar-5-vozes.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = join(import.meta.dirname, '..')

function obterApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY.trim()
  const keyPath = join(root, '.tts-key.local')
  if (existsSync(keyPath)) return readFileSync(keyPath, 'utf8').trim()
  throw new Error('Nenhuma chave de API encontrada em .tts-key.local.')
}

const VOZES = ['Charon', 'Fenrir', 'Enceladus', 'Alnilam', 'Zubenelgenubi']

const SSML_TEXTO = `<speak>
No princípio criou Deus os céus e a terra. <break time="600ms"/>
E a terra estava desordenada e vazia; <break time="400ms"/>
e as trevas estavam sobre a face do abismo. <break time="800ms"/>
E disse Deus: <break time="500ms"/> &quot;Haja luz&quot;. <break time="700ms"/>
E houve luz.
</speak>`

async function sintetizar(voz: string, apiKey: string): Promise<Buffer> {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`
  const nomeVoz = `pt-BR-Chirp3-HD-${voz}`

  const payload = {
    input: { ssml: SSML_TEXTO },
    voice: {
      languageCode: 'pt-BR',
      name: nomeVoz,
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 24000,
      speakingRate: 0.93,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Erro na síntese da voz ${voz} (HTTP ${res.status}): ${err}`)
  }

  const json = await res.json()
  if (!json.audioContent) throw new Error(`Sem áudio retornado para ${voz}`)
  return Buffer.from(json.audioContent, 'base64')
}

async function main() {
  const apiKey = obterApiKey()
  const outDir = join(root, 'amostras/comparativo-5-vozes')
  mkdirSync(outDir, { recursive: true })

  console.log(`\n=== GERANDO TESTES DE 15s PARA 5 VOZES ===`)
  console.log(`Diretório de saída: ${outDir}\n`)

  for (const voz of VOZES) {
    process.stdout.write(`- Sintetizando ${voz}... `)
    const wavPath = join(outDir, `${voz}.wav`)
    const m4aPath = join(outDir, `${voz}.m4a`)

    try {
      const buf = await sintetizar(voz, apiKey)
      writeFileSync(wavPath, buf)

      // Converte para AAC mono 24kHz normalizado a -14.7 LUFS
      const cmd = `ffmpeg -nostdin -hide_banner -loglevel error -y -i "${wavPath}" ` +
        `-af "loudnorm=I=-14.7:TP=-1.5:LRA=11,aresample=24000" ` +
        `-c:a aac -b:a 96k -ar 24000 -ac 1 "${m4aPath}"`
      execSync(cmd)

      const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${m4aPath}"`
      const dur = parseFloat(execSync(durCmd, { encoding: 'utf8' }).trim())

      console.log(`✅ OK (${dur.toFixed(1)}s) -> ${m4aPath}`)
    } catch (err: any) {
      console.log(`❌ FALHOU: ${err.message}`)
    }
  }

  console.log(`\n🎉 Todos os testes de 15s foram gerados com sucesso!`)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

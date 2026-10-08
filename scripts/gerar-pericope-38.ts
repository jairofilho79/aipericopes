/**
 * Gerador de Narração com Gemini 3.8 Flash TTS via Interactions API
 *
 * Características:
 * - Modelo: gemini-3.8-flash-tts (Google AI Studio)
 * - Voz: Algenib
 * - Metadados estruturados via speech_metadata (evita vazamento de comandos)
 * - Trava estrita de sotaque pt-BR (evita deriva para pt-PT ou espanhol)
 * - Tom interpretativo e acolhedor, pitch equilibrado (evita voz excessivamente grave ou fina)
 * - Caching unitário à prova de falhas
 * - Controle suave de 10 RPM com retry inteligente
 * - Masterização EBU R128 (-14.7 LUFS mono AAC 24 kHz)
 * - Geração de manifest.json para sincronia e realce no app
 *
 * Uso:
 *   npx tsx scripts/gerar-pericope-38.ts --ordem=2058
 *   npx tsx scripts/gerar-pericope-38.ts --ordens=2058..2060
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { createSign } from 'node:crypto'

const root = join(import.meta.dirname, '..')
const roteiroPath = existsSync(join(root, 'data', 'roteiro.jsonl'))
  ? join(root, 'data', 'roteiro.jsonl')
  : '/Volumes/SSD 2TB SD/dev/tts-spike/roteiro.jsonl'
const corpusV3Dir = join(root, 'amostras', 'corpus-algenib-v3')
const corpusAltoDir = join(root, 'amostras', 'corpus-algenib-alto')
const outAmostrasDir = join(root, 'amostras', 'amostras-3.8')

mkdirSync(outAmostrasDir, { recursive: true })

const SR = 24000
const BYTES_POR_SEG = SR * 2 // 16-bit mono = 48.000 B/s
const PAUSA_U = 0.4 // pausa entre versículos da mesma seção
const PAUSA_S = 0.8 // pausa entre seções distintas

interface UnidadeRoteiro {
  ordem: number
  livro: string
  i: number
  secao: 'titulo' | 'contexto' | 'texto' | 'resenha' | 'palavras' | 'reflexoes'
  texto: string
  n_unid: number
}

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

// Estilos estruturados para speech_metadata.style:
// Trava estrita de pt-BR nativo, narrador ativo, curioso, com brilho e vontade de narrar,
// sem soar cansado, sem voz de trailer/grave artificial e sem infantilidade.
const BASE_STYLE =
  'Brazilian Portuguese narrator with native pt-BR accent. An active, captivated, and curious storyteller with genuine vitality and momentum. Bright, warm, and engaging vocal energy. Strictly avoid tired, sleepy, bored, or sluggish delivery. Natural medium pitch, mature and insightful, never childish.'

const STYLES_POR_SECAO = {
  titulo: `${BASE_STYLE} Deliver this title with crisp, inviting clarity and captivating interest.`,
  contexto: `${BASE_STYLE} Brisk, lively, and conversational storytelling rhythm, fascinated by the historical background.`,
  texto: `${BASE_STYLE} Brisk, active, and expressive pace throughout the passage. Expressive and engaged, avoiding slow, heavy or liturgical cadences. Speak divine quotes with deliberate weight and quiet power.`,
  resenha: `${BASE_STYLE} Explain these insights with energetic momentum, clear, agile, and captivating.`,
  palavras: `${BASE_STYLE} Define these terms briskly, clearly, and engagingly in Brazilian Portuguese.`,
  reflexoes: `${BASE_STYLE} Ask these questions directly, prompting active, curious, and personal engagement.`,
  cabecalho: `${BASE_STYLE} Announce this section heading clearly, naturally, and briskly in Brazilian Portuguese.`,
}

function obterEstiloParaUnidade(u: UnidadeRoteiro): string {
  const t = u.texto.trim()
  if (
    ['Texto Bíblico.', 'Contexto.', 'Resenha.', 'Reflexões.', 'As palavras do trecho.'].includes(t) ||
    t.startsWith('Capítulo ')
  ) {
    return STYLES_POR_SECAO.cabecalho
  }
  return STYLES_POR_SECAO[u.secao] || BASE_STYLE
}

interface ServiceAccountKey {
  project_id: string
  client_email: string
  private_key: string
}

let cachedVertexToken: string | null = null
let cachedVertexTokenExpiry = 0

function obterServiceAccountKey(): ServiceAccountKey | null {
  const padrao = join(root, 'google-service-account.json')
  if (existsSync(padrao)) {
    try {
      return JSON.parse(readFileSync(padrao, 'utf8'))
    } catch {}
  }
  return null
}

async function obterTokenVertex(sa: ServiceAccountKey): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  if (cachedVertexToken && agora < cachedVertexTokenExpiry - 60) {
    return cachedVertexToken
  }
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: agora + 3600,
    iat: agora,
  }
  const base64url = (str: string | Buffer) =>
    Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const dataToSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signer = createSign('RSA-SHA256')
  signer.update(dataToSign)
  const signature = signer.sign(sa.private_key, 'base64url')
  const jwt = `${dataToSign}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro OAuth2 Google (${res.status}): ${errText}`)
  }
  const json = await res.json()
  cachedVertexToken = json.access_token
  cachedVertexTokenExpiry = agora + 3600
  return cachedVertexToken!
}

async function sintetizarUnidadeVertex(unidade: UnidadeRoteiro): Promise<Buffer> {
  const sa = obterServiceAccountKey()
  if (!sa) throw new Error('google-service-account.json não encontrado para fallback Vertex AI')
  const token = await obterTokenVertex(sa)
  const endpointTTS = `https://us-central1-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/us-central1/publishers/google/models/gemini-3.1-flash-tts-preview:generateContent`

  const body = {
    contents: [{ role: 'user', parts: [{ text: unidade.texto }] }],
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Algenib',
          },
        },
      },
    },
  }

  const res = await fetch(endpointTTS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro Vertex AI (${res.status}): ${errText}`)
  }

  const data = await res.json()
  const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inline?.data) {
    throw new Error(`Resposta do Vertex AI sem áudio: ${JSON.stringify(data).slice(0, 200)}`)
  }

  const audioBuf = Buffer.from(inline.data, 'base64')
  if (inline.mimeType?.includes('audio/l16') && inline.mimeType?.includes('rate=24000')) {
    return audioBuf
  }

  const tmpIn = join(corpusV3Dir, `_tmp_vertex_${Date.now()}_u${unidade.i}.bin`)
  const tmpRaw = join(corpusV3Dir, `_tmp_vertex_${Date.now()}_u${unidade.i}.raw`)
  writeFileSync(tmpIn, audioBuf)
  try {
    execSync(`ffmpeg -y -v error -i "${tmpIn}" -f s16le -acodec pcm_s16le -ac 1 -ar 24000 "${tmpRaw}"`)
    return readFileSync(tmpRaw)
  } finally {
    try { unlinkSync(tmpIn) } catch {}
    try { unlinkSync(tmpRaw) } catch {}
  }
}

async function sintetizarUnidade38(
  unidade: UnidadeRoteiro,
  apiKey: string,
  cacheDir: string,
  maxTentativas = 5,
): Promise<{ pcmBuf: Buffer; doCache: boolean }> {
  const cacheFile = join(cacheDir, `u${unidade.i.toString().padStart(2, '0')}.raw`)
  if (existsSync(cacheFile)) {
    return { pcmBuf: readFileSync(cacheFile), doCache: true }
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/interactions'
  const style = obterEstiloParaUnidade(unidade)

  const payload = {
    model: 'gemini-3.8-flash-tts',
    input: [
      {
        type: 'user_input',
        content: [
          {
            type: 'text',
            text: unidade.texto,
            annotations: [
              {
                type: 'speech_metadata',
                style,
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
      const errJson = await res.json().catch(() => ({}))
      const errStr = JSON.stringify(errJson)
      const retryDelayStr = errJson?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay
      const retryDelayNum = retryDelayStr ? parseInt(retryDelayStr.replace('s', ''), 10) : 0

      // Detecta esgotamento da cota diária (100 RPD no Tier 1)
      const isDailyQuota =
        errStr.includes('per day') ||
        errStr.includes('100 requests') ||
        errStr.includes('limit: 100') ||
        (retryDelayNum > 300) ||
        (errStr.includes('Resource has been exhausted') && !retryDelayStr)

      if (isDailyQuota) {
        process.stdout.write(
          `\n    🛑 [COTA DIÁRIA ATINGIDA] Limite diário de 100 RPD atingido no Gemini 3.8 Flash TTS: ${errJson?.error?.message || errStr}\n`,
        )
        const erroCota = new Error(
          `COTA_DIARIA_38_ESGOTADA: ${errJson?.error?.message || 'Limite diário de 100 requisições do Tier 1 atingido'}`,
        )
        ;(erroCota as any).isDailyQuota = true
        throw erroCota
      }

      let esperaSeg = res.status >= 500 ? 5 * tentativa : 15
      if (retryDelayNum > 0 && retryDelayNum <= 300) {
        esperaSeg = retryDelayNum + 2
      }
      process.stdout.write(
        `\n    ⏳ [HTTP ${res.status} na unidade ${unidade.i}] Aguardando ${esperaSeg}s antes de tentar novamente (${tentativa}/${maxTentativas})...\n`,
      )
      await new Promise((r) => setTimeout(r, esperaSeg * 1000))
      continue
    }

    if (res.status === 400) {
      const errJson = await res.json().catch(() => ({}))
      const errStr = JSON.stringify(errJson)
      if (errStr.includes('content_blocked') || errStr.includes('policy reason')) {
        process.stdout.write(
          `\n    ⚠️  [Moderação na unidade ${unidade.i}] Filtro disparou content_blocked no AI Studio. Acionando fallback Vertex AI (BLOCK_NONE)...\n`,
        )
        try {
          const vertexPcm = await sintetizarUnidadeVertex(unidade)
          writeFileSync(cacheFile, vertexPcm)
          try {
            const parentDir = join(cacheDir, '..')
            const legacyFile = join(parentDir, 'unidades', `u${unidade.i.toString().padStart(2, '0')}.raw`)
            writeFileSync(legacyFile, vertexPcm)
          } catch {}
          process.stdout.write(
            `    🛡️  [Fallback Vertex AI] Unidade ${unidade.i} sintetizada com sucesso (${(vertexPcm.length / BYTES_POR_SEG).toFixed(1)}s, voz Algenib)!\n`,
          )
          return { pcmBuf: vertexPcm, doCache: false }
        } catch (vertexErr: any) {
          process.stdout.write(`    ❌ Fallback Vertex AI falhou: ${vertexErr.message}\n`)
        }
      }
      throw new Error(`Google Interactions HTTP 400: ${errStr}`)
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

    if (!b64) {
      throw new Error(`Resposta da API sem áudio para unidade ${unidade.i}`)
    }

    // Salva WAV temporário e converte para PCM mono 24 kHz
    const tmpWav = join(cacheDir, `_tmp_u${unidade.i}.wav`)
    const tmpRaw = join(cacheDir, `_tmp_u${unidade.i}.raw`)
    writeFileSync(tmpWav, Buffer.from(b64, 'base64'))

    execSync(`ffmpeg -y -v error -i "${tmpWav}" -f s16le -acodec pcm_s16le -ac 1 -ar 24000 "${tmpRaw}"`)
    const pcmBuf = readFileSync(tmpRaw)

    try { unlinkSync(tmpWav) } catch {}
    try { unlinkSync(tmpRaw) } catch {}

    writeFileSync(cacheFile, pcmBuf)
    try {
      const parentDir = join(cacheDir, '..')
      const legacyFile = join(parentDir, 'unidades', `u${unidade.i.toString().padStart(2, '0')}.raw`)
      writeFileSync(legacyFile, pcmBuf)
    } catch {}
    return { pcmBuf, doCache: false }
  }

  throw new Error(`Excedeu ${maxTentativas} tentativas para unidade ${unidade.i}`)
}

export async function processarPericope38(ordem: number, unidades: UnidadeRoteiro[], apiKey: string) {
  const ordemPad = ordem.toString().padStart(4, '0')
  const tituloUnidade = unidades.find((u) => u.secao === 'titulo')
  console.log(`\n==================================================================`)
  console.log(`🎙️  [${ordemPad}] GEMINI 3.8 FLASH TTS (STUDIO)`)
  console.log(`📖 Livro: ${unidades[0].livro} | "${tituloUnidade?.texto || ''}"`)
  console.log(`📊 Total de unidades: ${unidades.length}`)
  console.log(`==================================================================`)

  const outV3 = join(corpusV3Dir, ordemPad)
  const outAlto = join(corpusAltoDir, ordemPad)
  mkdirSync(outV3, { recursive: true })
  mkdirSync(outAlto, { recursive: true })

  const cacheDir = join(outV3, 'unidades_38')
  const unidadesDir = join(outV3, 'unidades')
  mkdirSync(cacheDir, { recursive: true })
  mkdirSync(unidadesDir, { recursive: true })

  const finalM4a = join(outV3, 'pericope.m4a')
  const manifestPath = join(outV3, 'manifest.json')

  const t0 = Date.now()
  const rawBuffers: Buffer[] = []

  let prog = 0
  for (const u of unidades) {
    const { pcmBuf, doCache } = await sintetizarUnidade38(u, apiKey, cacheDir)
    rawBuffers.push(pcmBuf)
    prog++
    process.stdout.write(`\r  Progresso: ${prog}/${unidades.length} unidades sintetizadas...`)

    // Pausa suave de 6.2s entre novas requisições para respeitar os 10 RPM
    if (!doCache) {
      await new Promise((r) => setTimeout(r, 6200))
    }
  }
  console.log(` Concluído em ${((Date.now() - t0) / 1000).toFixed(1)}s.`)

  // Costura e cálculo do manifesto
  const partes: Buffer[] = []
  const manifestoUnidades = []
  let tempoAcumulado = 0
  let secaoAnterior: string | null = null

  for (let i = 0; i < unidades.length; i++) {
    const u = unidades[i]
    const raw = rawBuffers[i]
    const duracaoSeg = raw.length / BYTES_POR_SEG

    if (i > 0) {
      const pausa = u.secao !== secaoAnterior ? PAUSA_S : PAUSA_U
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

  const masterRawPath = join(outV3, '_master.raw')
  writeFileSync(masterRawPath, Buffer.concat(partes))

  // Normalização EBU R128 (-14.7 LUFS AAC mono 24 kHz)
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

  const manifest = {
    ordem,
    voz: 'Algenib',
    modelo: 'gemini-3.8-flash-tts',
    variante: 'v3_3.8',
    dur_total: parseFloat(tempoAcumulado.toFixed(3)),
    unidades: manifestoUnidades,
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  // Sincronizar cópia para corpus-algenib-alto e amostras de inspeção
  cpSync(finalM4a, join(outAlto, 'pericope.m4a'))
  cpSync(manifestPath, join(outAlto, 'manifest.json'))

  const amostraArquivo = join(outAmostrasDir, `${ordem}_gemini-3.8-flash-tts.m4a`)
  cpSync(finalM4a, amostraArquivo)

  const min = Math.floor(tempoAcumulado / 60)
  const sec = Math.round(tempoAcumulado % 60)
  console.log(`\n  ✅ Perícope ${ordem} concluída com sucesso!`)
  console.log(`     ⏱️  Duração: ${min}m ${sec}s (${tempoAcumulado.toFixed(1)}s)`)
  console.log(`     📁 Salvo em: ${finalM4a}`)
  console.log(`     📁 Salvo em: ${join(outAlto, 'pericope.m4a')}`)
  console.log(`     🎧 Amostra para audição: ${amostraArquivo}`)

  return { duracaoSeg: tempoAcumulado, m4aPath: finalM4a, amostraPath: amostraArquivo }
}

async function main() {
  const args = process.argv.slice(2)
  let ordem = 2058

  for (const a of args) {
    if (a.startsWith('--ordem=')) ordem = parseInt(a.split('=')[1], 10)
  }

  const apiKey = obterGeminiKey()

  // Carregar unidades da ordem
  const linhas = readFileSync(roteiroPath, 'utf8').split('\n').filter(Boolean)
  const unidades: UnidadeRoteiro[] = []
  for (const l of linhas) {
    const u: UnidadeRoteiro = JSON.parse(l)
    if (u.ordem === ordem) unidades.push(u)
  }

  if (unidades.length === 0) {
    throw new Error(`Ordem ${ordem} não encontrada em roteiro.jsonl`)
  }
  unidades.sort((a, b) => a.i - b.i)

  await processarPericope38(ordem, unidades, apiKey)
}

main().catch((err) => {
  console.error('\n❌ Erro:', err)
  process.exit(1)
})

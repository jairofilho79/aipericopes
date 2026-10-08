/**
 * Teste comparativo de TTS na perícope 2057:
 * - gemini-3.1-flash-tts-preview (via Vertex AI ou Gemini API)
 * - gemini-3.8-flash-tts (via Gemini API)
 * - gemini-3.8-flash-lite-tts (via Gemini API)
 *
 * Salva os resultados em amostras/teste-modelos-2057/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createSign } from 'node:crypto'
import { execSync } from 'node:child_process'

const root = join(import.meta.dirname, '..')
const roteiroPath = '/Volumes/SSD 2TB SD/dev/tts-spike/roteiro.jsonl'
const outDir = join(root, 'amostras', 'teste-modelos-2057')
mkdirSync(outDir, { recursive: true })

const SR = 24000
const BYTES_POR_SEG = SR * 2
const PAUSA_U = 0.4
const PAUSA_S = 0.8

interface UnidadeRoteiro {
  ordem: number
  livro: string
  i: number
  secao: 'titulo' | 'contexto' | 'texto' | 'resenha' | 'palavras' | 'reflexoes'
  texto: string
  n_unid: number
}

const PROMPTS_V3 = {
  base: 'Narrate in Brazilian Portuguese with the voice of Algenib as an active, captivating narrator. ',
  titulo: 'Deliver this sacred title with crisp, dignified authority. Read only the text below, nothing else:\n\n',
  contexto: 'Deliver this historical background in a brisk, lively, and conversational storytelling rhythm. Read only the text below, nothing else:\n\n',
  texto: 'Use a brisk, expressive and active reading pace throughout the passage. Avoid slow, heavy or liturgical cadences in the narration. Infuse only the words uttered by God with deliberate weight, quiet power, and solemnity. Read only the text below, nothing else:\n\n',
  resenha: 'Explain these insights with energetic momentum, clear, agile, and captivating. Read only the text below, nothing else:\n\n',
  palavras: 'Define these terms briskly, clearly, and engagingly. Read only the text below, nothing else:\n\n',
  reflexoes: 'Ask these questions directly, prompting active personal engagement. Read only the text below, nothing else:\n\n',
  cabecalho: 'Announce this section heading clearly, naturally, and briskly. Read only the text below, nothing else:\n\n',
}

function obterGeminiKey(): string | null {
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
  return null
}

function base64url(str: string | Buffer): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function obterTokenVertex(sa: any): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: agora + 3600,
    iat: agora,
  }
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signer = createSign('RSA-SHA256')
  signer.update(data)
  const sig = signer.sign(sa.private_key, 'base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${data}.${sig}`,
    }),
  })
  const tokenData = await res.json()
  return tokenData.access_token
}

async function sintetizarUnidadeVertex(
  unidade: UnidadeRoteiro,
  prompt: string,
  token: string,
  sa: any,
  modelo: string,
): Promise<Buffer> {
  const cacheUnitFile = join(outDir, `_raw_${modelo}_u${unidade.i}.raw`)
  if (existsSync(cacheUnitFile) && statSync(cacheUnitFile).size > 1000) {
    return readFileSync(cacheUnitFile)
  }

  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/us-central1/publishers/google/models/${modelo}:generateContent`
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt + unidade.texto }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Algenib' },
        },
      },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Vertex AI HTTP ${res.status}: ${errText}`)
  }

  const json = await res.json()
  const inline = json.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inline?.data) throw new Error('Sem áudio na resposta Vertex AI')
  const buf = Buffer.from(inline.data, 'base64')
  writeFileSync(cacheUnitFile, buf)
  return buf
}

async function sintetizarUnidadeGoogleDirect(
  unidade: UnidadeRoteiro,
  prompt: string,
  apiKey: string,
  modelo: string,
  maxTentativas = 5,
): Promise<Buffer> {
  const cacheUnitFile = join(outDir, `_raw_${modelo}_u${unidade.i}.raw`)
  if (existsSync(cacheUnitFile) && statSync(cacheUnitFile).size > 1000) {
    return readFileSync(cacheUnitFile)
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`
  const textoFinal = modelo.startsWith('gemini-3.8') ? unidade.texto : (prompt + unidade.texto)
  const payload = {
    contents: [{ parts: [{ text: textoFinal }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Algenib' },
        },
      },
    },
  }

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.status === 429 || res.status >= 500) {
      const errJson = await res.json().catch(() => ({}))
      let esperaSeg = res.status >= 500 ? 5 * tentativa : 15
      const retryDelayStr = errJson?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay
      if (retryDelayStr) {
        const parsed = parseInt(retryDelayStr.replace('s', ''), 10)
        if (!isNaN(parsed) && parsed > 0) esperaSeg = parsed + 2
      }
      process.stdout.write(`\n    ⏳ [HTTP ${res.status} na unidade ${unidade.i}] Aguardando ${esperaSeg}s antes de tentar novamente (${tentativa}/${maxTentativas})...\n`)
      await new Promise((r) => setTimeout(r, esperaSeg * 1000))
      continue
    }

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Google Direct HTTP ${res.status}: ${errText}`)
    }

    const json = await res.json()
    const inline = json.candidates?.[0]?.content?.parts?.[0]?.inlineData
    if (!inline?.data) throw new Error('Sem áudio na resposta Google Direct')

    const base64Data = inline.data
    const mimeType = inline.mimeType || 'audio/wav'

    if (mimeType.includes('wav')) {
      const tmpWav = join(outDir, `_tmp_${modelo}_${unidade.i}.wav`)
      const tmpRaw = join(outDir, `_tmp_${modelo}_${unidade.i}.raw`)
      writeFileSync(tmpWav, Buffer.from(base64Data, 'base64'))
      // Usa arquivo temporário de saída para evitar ENOBUFS no buffer de stdout do execSync
      execSync(
        `ffmpeg -y -v error -i "${tmpWav}" -f s16le -acodec pcm_s16le -ac 1 -ar 24000 "${tmpRaw}"`,
      )
      const pcmBuf = readFileSync(tmpRaw)
      try { unlinkSync(tmpWav) } catch {}
      try { unlinkSync(tmpRaw) } catch {}
      writeFileSync(cacheUnitFile, pcmBuf)
      return pcmBuf
    }

    const rawBuf = Buffer.from(base64Data, 'base64')
    writeFileSync(cacheUnitFile, rawBuf)
    return rawBuf
  }

  throw new Error(`Excedeu ${maxTentativas} tentativas para unidade ${unidade.i} no modelo ${modelo}`)
}

function montarM4A(unidades: UnidadeRoteiro[], rawBuffers: Buffer[], outFile: string): number {
  const partes: Buffer[] = []
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

    partes.push(raw)
    tempoAcumulado += duracaoSeg
    secaoAnterior = u.secao
  }

  const masterRaw = join(outDir, `_master_${Date.now()}.raw`)
  writeFileSync(masterRaw, Buffer.concat(partes))

  // Normalização EBU R128 (-14.7 LUFS AAC mono 24 kHz)
  const cmd = [
    'ffmpeg -y -v error',
    `-f s16le -ar ${SR} -ac 1 -i "${masterRaw}"`,
    '-filter_complex "[0:a]loudnorm=I=-14.7:LRA=7:tp=-1.0[out]"',
    '-map "[out]"',
    '-c:a aac -b:a 64k -ar 24000 -ac 1',
    `-movflags +faststart "${outFile}"`,
  ].join(' ')

  execSync(cmd)
  try { unlinkSync(masterRaw) } catch {}

  const dur = parseFloat(
    execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${outFile}"`,
    ).toString().trim(),
  )
  return dur
}

async function main() {
  console.log('==================================================================')
  console.log('  TESTE COMPARATIVO DOS 3 MODELOS TTS NA PERÍCOPE 2057 (João 14)')
  console.log('==================================================================\n')

  // 1. Ler unidades da 2057
  const unidades: UnidadeRoteiro[] = []
  const linhas = readFileSync(roteiroPath, 'utf8').split('\n')
  for (const l of linhas) {
    if (!l.trim()) continue
    const u = JSON.parse(l)
    if (u.ordem === 2057) unidades.push(u)
  }
  unidades.sort((a, b) => a.i - b.i)
  console.log(`Perícope 2057 carregada: ${unidades.length} unidades de fala.\n`)

  const keyFile = join(root, 'google-service-account.json')
  const sa = existsSync(keyFile) ? JSON.parse(readFileSync(keyFile, 'utf8')) : null
  const geminiKey = obterGeminiKey()

  const modelos = [
    { id: 'gemini-3.1-flash-tts-preview', rotulo: 'Gemini 3.1 Flash TTS (Atual)' },
    { id: 'gemini-3.8-flash-tts', rotulo: 'Gemini 3.8 Flash TTS (Novo - Studio)' },
    { id: 'gemini-3.8-flash-lite-tts', rotulo: 'Gemini 3.8 Flash-Lite TTS (Novo - Lite)' },
  ]

  for (const mod of modelos) {
    console.log(`\n------------------------------------------------------------------`)
    console.log(`🎙️  Processando modelo: ${mod.rotulo} (${mod.id})`)
    console.log(`------------------------------------------------------------------`)

    const outM4a = join(outDir, `2057_${mod.id}.m4a`)
    if (existsSync(outM4a) && statSync(outM4a).size > 100000) {
      console.log(`  ✅ Áudio já gerado anteriormente: ${outM4a}`)
      continue
    }

    const t0 = Date.now()
    let rawBuffers: Buffer[] | null = null

    // Tentativa 1: se for 3.1, Vertex AI funciona com a Service Account
    if (mod.id === 'gemini-3.1-flash-tts-preview' && sa) {
      try {
        console.log('  Usando Google Cloud Vertex AI (US$ 300)...')
        const token = await obterTokenVertex(sa)
        let prog = 0
        rawBuffers = []
        for (const u of unidades) {
          let promptSecao: string
          if (
            ['Texto Bíblico.', 'Contexto.', 'Resenha.', 'Reflexões.', 'As palavras do trecho.'].includes(u.texto.trim()) ||
            u.texto.trim().startsWith('Capítulo ')
          ) {
            promptSecao = PROMPTS_V3.base + PROMPTS_V3.cabecalho
          } else {
            promptSecao = PROMPTS_V3.base + (PROMPTS_V3 as any)[u.secao]
          }
          const buf = await sintetizarUnidadeVertex(u, promptSecao, token, sa, mod.id)
          rawBuffers.push(buf)
          prog++
          process.stdout.write(`\r  Progresso: ${prog}/${unidades.length} unidades sintetizadas...`)
        }
        console.log(' Concluído!')
      } catch (err: any) {
        console.warn(`  ⚠️  Vertex AI falhou: ${err.message}`)
      }
    }

    // Tentativa 2: Gemini Direct API (com espaçamento cuidadoso para respeitar cota de 10 RPM)
    if (!rawBuffers && geminiKey) {
      try {
        console.log('  Usando Google Gemini Direct API (respeitando limite de RPM)...')
        let prog = 0
        rawBuffers = []
        for (const u of unidades) {
          let promptSecao: string
          if (
            ['Texto Bíblico.', 'Contexto.', 'Resenha.', 'Reflexões.', 'As palavras do trecho.'].includes(u.texto.trim()) ||
            u.texto.trim().startsWith('Capítulo ')
          ) {
            promptSecao = PROMPTS_V3.base + PROMPTS_V3.cabecalho
          } else {
            promptSecao = PROMPTS_V3.base + (PROMPTS_V3 as any)[u.secao]
          }

          const cacheUnitFile = join(outDir, `_raw_${mod.id}_u${u.i}.raw`)
          const eraCache = existsSync(cacheUnitFile) && statSync(cacheUnitFile).size > 1000

          const buf = await sintetizarUnidadeGoogleDirect(u, promptSecao, geminiKey, mod.id)
          rawBuffers.push(buf)
          prog++
          process.stdout.write(`\r  Progresso: ${prog}/${unidades.length} unidades sintetizadas...`)
          if (!eraCache) {
            // Pausa de 6.2s entre requisições novas (não em cache) para manter < 10 RPM
            await new Promise((r) => setTimeout(r, 6200))
          }
        }
        console.log(' Concluído!')
      } catch (err: any) {
        console.error(`  ❌ Google Gemini API falhou: ${err.message}`)
      }
    }

    if (rawBuffers && rawBuffers.length === unidades.length) {
      const dur = montarM4A(unidades, rawBuffers, outM4a)
      const tempoTotal = ((Date.now() - t0) / 1000).toFixed(1)
      console.log(`  ✅ Áudio masterizado gerado com sucesso:`)
      console.log(`     📁 ${outM4a}`)
      console.log(`     ⏱️  Duração: ${(dur / 60).toFixed(2)} min (${dur.toFixed(1)}s) | Tempo de geração: ${tempoTotal}s`)

      // Limpar cache temporário de unidades raw
      for (const u of unidades) {
        const cacheFile = join(outDir, `_raw_${mod.id}_u${u.i}.raw`)
        try { unlinkSync(cacheFile) } catch {}
      }
    } else {
      console.log(`  ⚠️  Não foi possível gerar com ${mod.id} devido a falta de créditos/acesso na API.`)
    }
  }

  console.log('\n==================================================================')
  console.log(`  Processo finalizado. Arquivos gerados disponíveis em:`)
  console.log(`  📂 ${outDir}`)
  console.log('==================================================================\n')
}

main()

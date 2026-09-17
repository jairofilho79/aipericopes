/**
 * Script de Produção para Geração em Lote de Narração de Perícopes
 * com a voz Algenib (Variante 3 - Ágil & Dinâmica) no Gemini 3.1 Flash TTS.
 *
 * Suporta:
 *   - Checkpoint unitário à prova de falhas (se interromper, retoma de onde parou).
 *   - Concorrência paralela por perícope (6 requisições simultâneas).
 *   - Trava de segurança de saldo (para sozinho ao atingir o teto de crédito).
 *   - Masterização profissional EBU R128 (-14.7 LUFS, True Peak <= -1.0 dBTP).
 *   - Geração automática do manifest.json para realce e sincronia no app.
 *
 * Uso:
 *   npx tsx scripts/gerar-lote.ts --ordem=1
 *   npx tsx scripts/gerar-lote.ts --ordens=0..5
 *   npx tsx scripts/gerar-lote.ts --livro=Gênesis [--limite=10]
 *   npx tsx scripts/gerar-lote.ts --status
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { createSign } from 'node:crypto'
import readline from 'node:readline'

const root = join(import.meta.dirname, '..')
const roteiroPath = '/Volumes/SSD 2TB SD/dev/tts-spike/roteiro.jsonl'
const corpusDir = join(root, 'amostras', 'corpus-algenib-v3')

const SR = 24000
const BYTES_POR_SEG = SR * 2 // 16-bit mono = 48.000 bytes/s
const PAUSA_U = 0.4 // pausa entre versículos da mesma seção
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

async function obterSaldoOpenRouter(apiKey: string): Promise<{ total: number; uso: number; saldo: number }> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return { total: 0, uso: 0, saldo: 999 }
    const json = await res.json()
    const total = json.data?.total_credits || 0
    const uso = json.data?.total_usage || 0
    return { total, uso, saldo: parseFloat((total - uso).toFixed(2)) }
  } catch {
    return { total: 0, uso: 0, saldo: 999 }
  }
}

const PROMPTS_V3 = {
  base: 'Narrate in Brazilian Portuguese with the voice of Algenib as an active, captivating narrator. ',
  titulo: 'Deliver this sacred title with crisp, dignified authority. Read only the text below, nothing else:\n\n',
  contexto: 'Deliver this historical background in a brisk, lively, and conversational storytelling rhythm. Read only the text below, nothing else:\n\n',
  texto: (
    'Use a brisk, expressive and active reading pace throughout the passage. ' +
    'Avoid slow, heavy or liturgical cadences in the narration. ' +
    'Infuse only the words uttered by God with deliberate weight, quiet power, and solemnity. ' +
    'Read only the text below, nothing else:\n\n'
  ),
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

function encontrarArquivoKey(): string | null {
  const padrao = join(root, 'google-service-account.json')
  if (existsSync(padrao)) return padrao
  const arquivos = readdirSync(root)
  const achado = arquivos.find(
    (f) =>
      (f.startsWith('kitchen-auth-') || f.includes('service-account') || f.includes('serviceaccount')) &&
      f.endsWith('.json'),
  )
  return achado ? join(root, achado) : null
}

const saFile = encontrarArquivoKey()

interface ServiceAccountKey {
  project_id: string
  client_email: string
  private_key: string
}

let cachedVertexToken: { token: string; exp: number } | null = null
let cachedSa: ServiceAccountKey | null = null

function obterServiceAccount(): ServiceAccountKey {
  if (cachedSa) return cachedSa
  if (!saFile || !existsSync(saFile)) {
    throw new Error(`Arquivo de Service Account não encontrado (ex: google-service-account.json ou kitchen-auth-*.json)`)
  }
  cachedSa = JSON.parse(readFileSync(saFile, 'utf8'))
  return cachedSa!
}

async function obterTokenAcessoVertexCached(): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  if (cachedVertexToken && cachedVertexToken.exp > agora + 60) {
    return cachedVertexToken.token
  }
  const sa = obterServiceAccount()
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: agora + 3600,
    iat: agora,
  }

  const base64url = (str: string | Buffer) =>
    Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

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
    throw new Error(`Erro OAuth2 Google Vertex (${res.status}): ${errText}`)
  }

  const json = await res.json()
  cachedVertexToken = { token: json.access_token, exp: agora + 3500 }
  return json.access_token
}

async function sintetizarUnidade(
  apiKey: string,
  unidade: UnidadeRoteiro,
  promptSecao: string,
  cacheDir: string,
  provedor: 'openrouter' | 'google' | 'vertex' = 'openrouter',
): Promise<Buffer> {
  const rawFile = join(cacheDir, `u${unidade.i.toString().padStart(2, '0')}.raw`)
  if (existsSync(rawFile)) {
    return readFileSync(rawFile)
  }

  let ultimoErro: any = null

  if (provedor === 'vertex') {
    const token = await obterTokenAcessoVertexCached()
    const sa = obterServiceAccount()
    const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/us-central1/publishers/google/models/gemini-3.1-flash-tts-preview:generateContent`
    const payload = {
      contents: [{ role: 'user', parts: [{ text: promptSecao + unidade.texto }] }],
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

    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Vertex AI HTTP ${res.status}: ${errText}`)
        }

        const json = await res.json()
        const inline = json.candidates?.[0]?.content?.parts?.[0]?.inlineData
        if (!inline?.data) {
          throw new Error('Resposta do Vertex AI sem áudio inlineData')
        }

        const buf = Buffer.from(inline.data, 'base64')
        writeFileSync(rawFile, buf)
        return buf
      } catch (err: any) {
        ultimoErro = err
        console.warn(`    [Retry ${tentativa}/4] u${unidade.i.toString().padStart(2, '0')}: ${err.message}`)
        await new Promise((r) => setTimeout(r, tentativa * 2000))
      }
    }
    throw new Error(`Falha definitiva na unidade ${unidade.i} (Vertex AI): ${ultimoErro?.message}`)
  }

  if (provedor === 'google') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`
    const payload = {
      contents: [{ parts: [{ text: promptSecao + unidade.texto }] }],
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

    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Google API HTTP ${res.status}: ${errText}`)
        }

        const json = await res.json()
        const inline = json.candidates?.[0]?.content?.parts?.[0]?.inlineData
        if (!inline?.data) {
          throw new Error('Resposta do Google sem áudio inlineData')
        }

        const buf = Buffer.from(inline.data, 'base64')
        const tmpFile = join(cacheDir, `_temp_${unidade.i}.wav`)
        writeFileSync(tmpFile, buf)
        execSync(`ffmpeg -y -v error -i "${tmpFile}" -f s16le -ar ${SR} -ac 1 "${rawFile}"`)
        unlinkSync(tmpFile)
        return readFileSync(rawFile)
      } catch (err: any) {
        ultimoErro = err
        console.warn(`    [Retry ${tentativa}/4] u${unidade.i.toString().padStart(2, '0')}: ${err.message}`)
        await new Promise((r) => setTimeout(r, tentativa * 2000))
      }
    }
    throw new Error(`Falha definitiva na unidade ${unidade.i} (Google): ${ultimoErro?.message}`)
  }

  // Provedor OpenRouter
  const url = 'https://openrouter.ai/api/v1/audio/speech'

  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
      console.warn(`    [Retry ${tentativa}/4] u${unidade.i.toString().padStart(2, '0')}: ${err.message}`)
      await new Promise((r) => setTimeout(r, tentativa * 2000))
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

async function processarPericope(
  ordem: number,
  unidades: UnidadeRoteiro[],
  apiKey: string,
  provedor: 'openrouter' | 'google' | 'vertex' = 'openrouter',
  forcar = false,
): Promise<{ duracaoSeg: number; outDir: string; m4aPath: string }> {
  const ordemPad = ordem.toString().padStart(4, '0')
  const outDir = join(corpusDir, ordemPad)
  if (forcar && existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true })
  }
  const cacheDir = join(outDir, 'unidades')
  mkdirSync(cacheDir, { recursive: true })

  const finalM4a = join(outDir, 'pericope.m4a')
  const manifestPath = join(outDir, 'manifest.json')

  // Se já existe e é válido, pula (a menos que forcar seja true)
  if (!forcar && existsSync(finalM4a) && existsSync(manifestPath)) {
    const dur = parseFloat(
      execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalM4a}"`,
      ).toString().trim(),
    )
    console.log(`  ⏩ [${ordemPad}] Já concluída anteriormente (${(dur / 60).toFixed(1)} min). Pulando.`)
    return { duracaoSeg: dur, outDir, m4aPath: finalM4a }
  }

  const tituloUnidade = unidades.find((u) => u.secao === 'titulo')
  console.log(`\n🎙️  [${ordemPad}] (${provedor.toUpperCase()}) ${unidades[0].livro} — "${tituloUnidade?.texto || ''}" (${unidades.length} unidades)`)

  const t0 = Date.now()
  let pr = 0

  const rawBuffers = await poolExecutar(unidades, 6, async (u) => {
    let promptSecao: string
    if (['Texto Bíblico.', 'Contexto.', 'Resenha.', 'Reflexões.', 'As palavras do trecho.'].includes(u.texto.trim())) {
      promptSecao = PROMPTS_V3.base + PROMPTS_V3.cabecalho
    } else {
      promptSecao = PROMPTS_V3.base + (PROMPTS_V3 as any)[u.secao]
    }
    const buf = await sintetizarUnidade(apiKey, u, promptSecao, cacheDir, provedor)
    pr++
    process.stdout.write(`\r    Progresso: ${pr}/${unidades.length} unidades geradas...`)
    return buf
  })
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

  const masterRawPath = join(outDir, '_master.raw')
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
    variante: 'v3',
    dur_total: parseFloat(tempoAcumulado.toFixed(3)),
    unidades: manifestoUnidades,
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  const min = Math.floor(tempoAcumulado / 60)
  const sec = Math.round(tempoAcumulado % 60)
  console.log(`  ✅ Salvo: ${finalM4a} (${min}m ${sec}s, -14.7 LUFS)`)

  return { duracaoSeg: tempoAcumulado, outDir, m4aPath: finalM4a }
}

async function carregarRoteiro(): Promise<Map<number, UnidadeRoteiro[]>> {
  const mapa = new Map<number, UnidadeRoteiro[]>()
  const fileStream = readFileSync(roteiroPath, 'utf8').split('\n')
  for (const line of fileStream) {
    if (!line.trim()) continue
    const u: UnidadeRoteiro = JSON.parse(line)
    if (!mapa.has(u.ordem)) {
      mapa.set(u.ordem, [])
    }
    mapa.get(u.ordem)!.push(u)
  }
  return mapa
}

async function main() {
  const args = process.argv.slice(2)
  let ordemUnica: number | null = null
  let ordensFaixa: [number, number] | null = null
  let livroFiltro: string | null = null
  let limite = Infinity
  let margemMinimaSaldo = 2.0 // trava de segurança em dólares
  let mostrarStatus = false
  let forcar = false

  let provedor: 'openrouter' | 'google' | 'vertex' = existsSync(saFile)
    ? 'vertex'
    : 'openrouter'
  const geminiKey = obterGeminiKey()

  for (const a of args) {
    if (a.startsWith('--ordem=')) ordemUnica = parseInt(a.split('=')[1], 10)
    if (a.startsWith('--ordens=')) {
      const [ini, fim] = a.split('=')[1].split('..').map((v) => parseInt(v, 10))
      ordensFaixa = [ini, fim]
    }
    if (a.startsWith('--livro=')) livroFiltro = a.split('=')[1]
    if (a.startsWith('--limite=')) limite = parseInt(a.split('=')[1], 10)
    if (a.startsWith('--margem=')) margemMinimaSaldo = parseFloat(a.split('=')[1])
    if (a.startsWith('--provedor=')) provedor = a.split('=')[1] as 'openrouter' | 'google' | 'vertex'
    if (a === '--status') mostrarStatus = true
    if (a === '--forcar' || a === '--force') forcar = true
  }

  let apiKey = ''
  let saldo = 999

  if (provedor === 'vertex') {
    if (!existsSync(saFile)) {
      console.error('❌ Para usar --provedor=vertex, o arquivo google-service-account.json deve estar na raiz do projeto.')
      console.error('   Veja as instruções executando: npx tsx scripts/testar-vertex-ai.ts')
      process.exit(1)
    }
    const sa = obterServiceAccount()
    console.log('==================================================================')
    console.log('  PIPELINE DE PRODUÇÃO EM LOTE — GOOGLE CLOUD VERTEX AI (US$ 300 GCP)')
    console.log(`  Projeto: ${sa.project_id} | Modelo: gemini-3.1-flash-tts-preview | Voz: Algenib`)
    console.log('==================================================================')
  } else if (provedor === 'google') {
    if (!geminiKey) {
      console.error('❌ Para usar --provedor=google, defina GEMINI_API_KEY no .env.')
      process.exit(1)
    }
    apiKey = geminiKey
    console.log('==================================================================')
    console.log('  PIPELINE DE PRODUÇÃO EM LOTE — GOOGLE AI STUDIO (PREPAY)')
    console.log('  Provedor: GOOGLE DIRECT | Modelo: gemini-3.1-flash-tts-preview | Voz: Algenib')
    console.log('==================================================================')
  } else {
    apiKey = obterOpenRouterKey()
    const info = await obterSaldoOpenRouter(apiKey)
    saldo = info.saldo
    console.log('==================================================================')
    console.log('  PIPELINE DE PRODUÇÃO EM LOTE — OPENROUTER (GEMINI 3.1 FLASH TTS)')
    console.log(`  Provedor: OPENROUTER | Saldo: US$ ${saldo.toFixed(2)} | Trava: US$ ${margemMinimaSaldo.toFixed(2)}`)
    console.log('==================================================================')

    if (saldo <= margemMinimaSaldo) {
      console.error(`❌ Saldo insuficiente (US$ ${saldo.toFixed(2)} <= margem US$ ${margemMinimaSaldo.toFixed(2)}). Abortando.`)
      process.exit(1)
    }
  }

  console.log('Indexando roteiro de perícopes...')
  const mapaRoteiro = await carregarRoteiro()

  // Se já temos a ordem 0 gerada anteriormente, copiar para o corpus se não estiver lá
  const gn1Final = join(corpusDir, '0000', 'pericope.m4a')
  const gn1Antigo = join(root, 'amostras', 'pericope-completa', 'algenib_v3_gn1.m4a')
  const gn1ManifestAntigo = join(root, 'amostras', 'pericope-completa', 'manifest_v3.json')
  if (!existsSync(gn1Final) && existsSync(gn1Antigo)) {
    mkdirSync(join(corpusDir, '0000'), { recursive: true })
    execSync(`cp "${gn1Antigo}" "${gn1Final}"`)
    execSync(`cp "${gn1ManifestAntigo}" "${join(corpusDir, '0000', 'manifest.json')}"`)
    console.log('📦 Gênesis 1 (ordem 0) já gerada foi importada para o acervo de produção!')
  }

  if (mostrarStatus) {
    let prontas = 0
    for (const ordem of mapaRoteiro.keys()) {
      const pPath = join(corpusDir, ordem.toString().padStart(4, '0'), 'pericope.m4a')
      if (existsSync(pPath)) prontas++
    }
    console.log(`\n📊 Status do Acervo Algenib V3:`)
    console.log(`   Concluídas: ${prontas} / ${mapaRoteiro.size} perícopes (${((prontas / mapaRoteiro.size) * 100).toFixed(1)}%)`)
    return
  }

  // Filtrar perícopes a processar
  let ordensAProcessar: number[] = []

  if (ordemUnica !== null) {
    ordensAProcessar = [ordemUnica]
  } else if (ordensFaixa !== null) {
    for (let o = ordensFaixa[0]; o <= ordensFaixa[1]; o++) {
      if (mapaRoteiro.has(o)) ordensAProcessar.push(o)
    }
  } else if (livroFiltro) {
    for (const [ordem, unidades] of mapaRoteiro.entries()) {
      if (unidades[0]?.livro.toLowerCase() === livroFiltro.toLowerCase()) {
        ordensAProcessar.push(ordem)
      }
    }
    ordensAProcessar.sort((a, b) => a - b)
  } else {
    // Padrão: testa a ordem 1 (continuação de Gênesis)
    ordensAProcessar = [1]
  }

  if (ordensAProcessar.length > limite) {
    ordensAProcessar = ordensAProcessar.slice(0, limite)
  }

  console.log(`Fila de processamento: ${ordensAProcessar.length} perícope(s) selecionada(s).`)

  let processadasCount = 0
  let duracaoTotalSeg = 0

  for (const ordem of ordensAProcessar) {
    const unidades = mapaRoteiro.get(ordem)
    if (!unidades) {
      console.warn(`Ordem ${ordem} não encontrada no roteiro.`)
      continue
    }

    // Conferir saldo a cada perícope se for OpenRouter
    if (provedor === 'openrouter') {
      const infoSaldo = await obterSaldoOpenRouter(apiKey)
      if (infoSaldo.saldo <= margemMinimaSaldo) {
        console.warn(`\n⚠️ Trava de segurança atingida: Saldo US$ ${infoSaldo.saldo.toFixed(2)} <= limite US$ ${margemMinimaSaldo.toFixed(2)}. Parando suavemente.`)
        break
      }
    }

    const { duracaoSeg } = await processarPericope(ordem, unidades, apiKey, provedor, forcar)
    processadasCount++
    duracaoTotalSeg += duracaoSeg
  }

  console.log('\n==================================================================')
  console.log('🏁 EXECUÇÃO CONCLUÍDA')
  console.log(`  Perícopes processadas: ${processadasCount}`)
  console.log(`  Áudio total gerado:    ${(duracaoTotalSeg / 60).toFixed(1)} minutos`)
  if (provedor === 'openrouter') {
    const { saldo: saldoFinal } = await obterSaldoOpenRouter(apiKey)
    console.log(`  Saldo restante:        US$ ${saldoFinal.toFixed(2)} (gasto nesta sessão: ~US$ ${(saldo - saldoFinal).toFixed(2)})`)
  } else if (provedor === 'vertex') {
    console.log(`  Faturamento:           Google Cloud Vertex AI (abatido dos US$ 300 de créditos)`)
  }
  console.log('==================================================================\n')
}

main().catch((err) => {
  console.error('\n❌ Erro no lote:', err)
  process.exit(1)
})

/**
 * Gerador de Narração de Perícope com Gemini 3.1 Flash TTS (Google AI Studio)
 * e Cloud Text-to-Speech (Chirp 3 HD).
 *
 * Gera o áudio completo de uma perícope (ordem N de data/pericopes.json),
 * dividindo em seções estruturadas (titulo, contexto, texto, resenha, palavras, reflexoes),
 * aplicando as regras de normalização do projeto, sintetizando a fala e
 * gerando o master em WAV e a versão normalizada em M4A (-14 LUFS) para o app.
 *
 * Uso:
 *   npx tsx scripts/gerar-pericope-gemini.ts [--ordem=0] [--backend=gemini|cloud-tts] [--voz=Fenrir] [--dry-run]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { parseTexto, groupCorrido } from '../src/lib/parse-texto.ts'
import { prepararParaFalaSSML, dividirSsmlEmChunks } from './oralidade.ts'

const root = join(import.meta.dirname, '..')

// Interfaces da Perícope
interface PericopeRaw {
  ordem: number
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
  titulo_pericope_pt: string
  contexto_historico_literario: string
  texto: string
  resenha: string
  perguntas_reflexao: string[]
}

interface SecaoRoteiro {
  id: 'titulo' | 'contexto' | 'texto' | 'resenha' | 'palavras' | 'reflexoes'
  rotulo: string
  textoFalado: string
}

// 1. Obter chave de API
function obterApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY.trim()
  const keyPath = join(root, '.tts-key.local')
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, 'utf8').trim()
  }
  throw new Error('Nenhuma chave de API encontrada. Defina GEMINI_API_KEY ou configure .tts-key.local.')
}

// 2. Normalizar texto para síntese
function normalizarTextoFala(str: string): string {
  return str
    // Evita soletração de SENHOR
    .replace(/\bSENHOR\b/g, 'Senhor')
    .replace(/\bDEUS\b/g, 'Deus')
    // Remove aspas retas e estranhas
    .replace(/[""]/g, '"')
    // Colapsa espaços
    .replace(/[ \t]+/g, ' ')
    .trim()
}

// 3. Montar o roteiro falado da perícope
function montarRoteiro(p: PericopeRaw): SecaoRoteiro[] {
  const secoes: SecaoRoteiro[] = []

  // Seção: Título e Referência
  let refExtenso = `${p.livro}, capítulo ${p.capitulo_inicio}`
  if (p.capitulo_inicio === p.capitulo_fim) {
    if (p.versiculo_inicio === p.versiculo_fim) {
      refExtenso += `, versículo ${p.versiculo_inicio}.`
    } else {
      refExtenso += `, versículos ${p.versiculo_inicio} a ${p.versiculo_fim}.`
    }
  } else {
    refExtenso += `, versículo ${p.versiculo_inicio}, ao capítulo ${p.capitulo_fim}, versículo ${p.versiculo_fim}.`
  }

  secoes.push({
    id: 'titulo',
    rotulo: 'Título e Referência',
    textoFalado: normalizarTextoFala(`${p.titulo_pericope_pt}. ${refExtenso}`),
  })

  // Seção: Contexto
  if (p.contexto_historico_literario?.trim()) {
    secoes.push({
      id: 'contexto',
      rotulo: 'Contexto',
      textoFalado: normalizarTextoFala(`Contexto. ${p.contexto_historico_literario}`),
    })
  }

  // Seção: Texto Bíblico
  const blocks = parseTexto(p.texto)
  const corrido = groupCorrido(blocks)
  const partesTexto: string[] = ['Texto Bíblico.']

  for (const grupo of corrido) {
    if (grupo.label) {
      partesTexto.push(`${grupo.label}.`)
    }
    for (const v of grupo.verses) {
      partesTexto.push(v.text)
    }
  }

  secoes.push({
    id: 'texto',
    rotulo: 'Texto Bíblico',
    textoFalado: normalizarTextoFala(partesTexto.join(' ')),
  })

  // Seção: Resenha e Palavras (Glossário)
  if (p.resenha?.trim()) {
    const linhas = p.resenha.split('\n')
    const prosa: string[] = []
    const palavras: string[] = []

    for (const l of linhas) {
      const t = l.trim()
      if (!t) continue
      if (t.startsWith('- ') || t.startsWith('* ')) {
        palavras.push(t.replace(/^[-*]\s*/, ''))
      } else {
        prosa.push(t)
      }
    }

    if (prosa.length > 0) {
      secoes.push({
        id: 'resenha',
        rotulo: 'Resenha',
        textoFalado: normalizarTextoFala(`Resenha. ${prosa.join(' ')}`),
      })
    }

    if (palavras.length > 0) {
      secoes.push({
        id: 'palavras',
        rotulo: 'Palavras',
        textoFalado: normalizarTextoFala(`Palavras. ${palavras.join('. ')}.`),
      })
    }
  }

  // Seção: Reflexões
  if (p.perguntas_reflexao && p.perguntas_reflexao.length > 0) {
    const perguntas = p.perguntas_reflexao.map((pergunta, idx) => `Pergunta ${idx + 1}. ${pergunta}`)
    secoes.push({
      id: 'reflexoes',
      rotulo: 'Reflexões',
      textoFalado: normalizarTextoFala(`Reflexões. ${perguntas.join(' ')}`),
    })
  }

  return secoes
}

// 4. Chamada ao Gemini 3.1 Flash TTS (Google AI Studio / Generative Language API)
async function sintetizarGemini(
  texto: string,
  apiKey: string,
  voz: string,
): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`

  const promptCompleto = `[tom sereno, leitura solene, ritmo calmo de narração bíblica, dicção em português do Brasil]\n${texto}`

  const payload = {
    contents: [
      {
        parts: [{ text: promptCompleto }],
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
    if (res.status === 403 && errorBody.includes('SERVICE_DISABLED')) {
      throw new Error(
        `A API do Gemini (generativelanguage.googleapis.com) precisa ser ativada no projeto Google Cloud.\n` +
          `Acesse o link abaixo para habilitar ou use uma chave criada em https://aistudio.google.com/app/apikey:\n` +
          `Detalhes da API: ${errorBody}`,
      )
    }
    throw new Error(`Erro Gemini API HTTP ${res.status}: ${errorBody}`)
  }

  const json = await res.json()
  const candidate = json.candidates?.[0]
  const part = candidate?.content?.parts?.[0]

  if (!part?.inlineData?.data) {
    throw new Error(`Resposta da API não conteve áudio inlineData: ${JSON.stringify(json)}`)
  }

  return Buffer.from(part.inlineData.data, 'base64')
}

// 5. Chamada alternativa ao Cloud Text-to-Speech (Chirp 3 HD ou Neural2)
async function sintetizarCloudTTS(
  texto: string,
  apiKey: string,
  voz: string,
  rate = 0.93,
): Promise<Buffer> {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`

  // Determina o nome exato da voz no Google Cloud TTS
  let nomeVoz = voz
  if (!voz.startsWith('pt-BR-')) {
    if (voz.startsWith('Neural2-') || voz.startsWith('Standard-') || voz.startsWith('Wavenet-')) {
      nomeVoz = `pt-BR-${voz}`
    } else {
      nomeVoz = `pt-BR-Chirp3-HD-${voz}`
    }
  }

  const payload = {
    input: texto.startsWith('<speak>') ? { ssml: texto } : { text: texto },
    voice: {
      languageCode: 'pt-BR',
      name: nomeVoz,
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 24000,
      speakingRate: rate,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Erro Cloud TTS HTTP ${res.status}: ${err}`)
  }

  const json = await res.json()
  if (!json.audioContent) {
    throw new Error(`Resposta Cloud TTS sem áudio: ${JSON.stringify(json)}`)
  }

  return Buffer.from(json.audioContent, 'base64')
}

// 6. Normalização via FFmpeg (-14 LUFS AAC mono 24kHz)
function normalizarAudio(wavPath: string, m4aPath: string) {
  const cmd = `ffmpeg -nostdin -hide_banner -loglevel error -y -i "${wavPath}" ` +
    `-af "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=24000" ` +
    `-c:a aac -b:a 96k -ar 24000 -ac 1 -movflags +faststart "${m4aPath}"`
  execSync(cmd, { stdio: 'inherit' })
}

function obterDuracaoSegundos(filePath: string): number {
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    const out = execSync(cmd, { encoding: 'utf8' }).trim()
    return parseFloat(out) || 0
  } catch {
    return 0
  }
}

// 7. Execução Principal
async function main() {
  const args = process.argv.slice(2)
  let ordem = 0
  let backend: 'gemini' | 'cloud-tts' = 'gemini'
  let voz = 'Fenrir' // Padrão masculino no Gemini TTS
  let rate = 0.93 // Cadência solene ligeiramente mais pausada
  let usarSsml = true
  let dryRun = false

  for (const a of args) {
    if (a.startsWith('--ordem=')) ordem = parseInt(a.split('=')[1], 10)
    if (a.startsWith('--backend=')) backend = a.split('=')[1] as 'gemini' | 'cloud-tts'
    if (a.startsWith('--voz=')) voz = a.split('=')[1]
    if (a.startsWith('--rate=')) rate = parseFloat(a.split('=')[1])
    if (a === '--sem-ssml') usarSsml = false
    if (a === '--dry-run') dryRun = true
  }

  // Se usar cloud-tts com voz Fenrir, adapta para voz padrão Chirp masculina
  const vozEfetiva = backend === 'cloud-tts' && voz === 'Fenrir' ? 'Achird' : voz

  console.log(`\n=== GERAÇÃO DE PERÍCOPE COM TTS ===`)
  console.log(`Ordem: ${ordem} | Backend: ${backend} | Voz: ${vozEfetiva} | Rate: ${rate} | SSML: ${usarSsml}`)

  // Carrega catálogo
  const catalogoPath = join(root, 'data/pericopes.json')
  const catalogo: PericopeRaw[] = JSON.parse(readFileSync(catalogoPath, 'utf8'))
  const pericope = catalogo.find((p) => p.ordem === ordem)

  if (!pericope) {
    throw new Error(`Perícope com ordem ${ordem} não encontrada em data/pericopes.json`)
  }

  console.log(`Perícope: ${pericope.livro} ${pericope.capitulo_inicio}:${pericope.versiculo_inicio}-${pericope.capitulo_fim}:${pericope.versiculo_fim}`)
  console.log(`Título: "${pericope.titulo_pericope_pt}"\n`)

  const roteiro = montarRoteiro(pericope)
  let totalChars = 0

  console.log(`--- Roteiro de Narração (${roteiro.length} seções) ---`)
  for (const s of roteiro) {
    totalChars += s.textoFalado.length
    console.log(`[${s.id}] (${s.textoFalado.length} chars)`)
    console.log(`  "${s.textoFalado.slice(0, 80)}..."`)
  }
  console.log(`\nTotal de caracteres falados: ${totalChars}`)

  if (dryRun) {
    console.log(`\n[DRY RUN] Simulação concluída com sucesso. Nenhum áudio gerado.`)
    return
  }

  const apiKey = obterApiKey()
  const sufixo = usarSsml ? '-expressiva' : ''
  const pastaNome = `${ordem.toString().padStart(4, '0')}-${vozEfetiva.toLowerCase()}${sufixo}`
  const outDir = join(root, 'amostras/gemini-tts', pastaNome)
  mkdirSync(outDir, { recursive: true })

  console.log(`\nIniciando síntese das seções (Pasta: ${pastaNome})...`)
  const arquivosSeções: string[] = []
  const manifestoUnidades = []
  let tempoAcumulado = 0

  for (let i = 0; i < roteiro.length; i++) {
    const s = roteiro[i]
    console.log(`- Sintetizando seção ${i + 1}/${roteiro.length}: ${s.id}...`)

    const wavSecaoPath = join(outDir, `secao_${i}_${s.id}.wav`)

    try {
      if (backend === 'gemini') {
        const audioBuffer = await sintetizarGemini(s.textoFalado, apiKey, vozEfetiva)
        writeFileSync(wavSecaoPath, audioBuffer)
      } else {
        const textoParaSintese = usarSsml ? prepararParaFalaSSML(s.textoFalado, s.id) : s.textoFalado
        const chunks = usarSsml ? dividirSsmlEmChunks(textoParaSintese, 3800) : [textoParaSintese]

        if (chunks.length === 1) {
          const audioBuffer = await sintetizarCloudTTS(chunks[0], apiKey, vozEfetiva, rate)
          writeFileSync(wavSecaoPath, audioBuffer)
        } else {
          console.log(`  (Seção longa dividida em ${chunks.length} partes para o limite da API)`)
          const subFiles: string[] = []
          for (let c = 0; c < chunks.length; c++) {
            const subWavPath = join(outDir, `secao_${i}_${s.id}_sub_${c}.wav`)
            const subBuf = await sintetizarCloudTTS(chunks[c], apiKey, vozEfetiva, rate)
            writeFileSync(subWavPath, subBuf)
            subFiles.push(subWavPath)
          }
          const subConcatList = join(outDir, `secao_${i}_concat.txt`)
          writeFileSync(subConcatList, subFiles.map((f) => `file '${f}'`).join('\n'))
          execSync(
            `ffmpeg -nostdin -hide_banner -loglevel error -y -f concat -safe 0 -i "${subConcatList}" -c copy "${wavSecaoPath}"`,
          )
        }
      }

      arquivosSeções.push(wavSecaoPath)

      const duracao = obterDuracaoSegundos(wavSecaoPath)
      manifestoUnidades.push({
        i,
        secao: s.id,
        texto: s.textoFalado,
        inicio: parseFloat(tempoAcumulado.toFixed(3)),
        dur: parseFloat(duracao.toFixed(3)),
      })
      tempoAcumulado += duracao
    } catch (err: any) {
      console.error(`Falha na síntese da seção ${s.id}:`, err.message)
      if (backend === 'gemini' && err.message.includes('generativelanguage.googleapis.com')) {
        console.log(`\n💡 DICA: Você também pode rodar com o backend alternativo já ativo na chave:`)
        console.log(`   npx tsx scripts/gerar-pericope-gemini.ts --ordem=${ordem} --backend=cloud-tts --voz=Achird\n`)
      }
      throw err
    }
  }

  // Costurar áudios das seções em um master com silêncio entre seções
  console.log(`\nCosturando seções com ffmpeg...`)
  const listaConcatenacao = join(outDir, 'lista_concat.txt')
  const concatLines = arquivosSeções.map((f) => `file '${f}'`).join('\n')
  writeFileSync(listaConcatenacao, concatLines)

  const masterWav = join(outDir, 'pericope_master.wav')
  execSync(`ffmpeg -nostdin -hide_banner -loglevel error -y -f concat -safe 0 -i "${listaConcatenacao}" -c copy "${masterWav}"`)

  // Normalizar para o formato final do app (-14 LUFS AAC-LC mono 24kHz .m4a)
  const finalM4a = join(outDir, 'pericope.m4a')
  console.log(`Normalizando para padrão do app (-14 LUFS AAC mono 24kHz): ${finalM4a}`)
  normalizarAudio(masterWav, finalM4a)

  // Gravar manifesto do app
  const manifesto = {
    ordem,
    dur_total: parseFloat(tempoAcumulado.toFixed(3)),
    unidades: manifestoUnidades,
  }
  const manifestPath = join(outDir, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifesto, null, 2))

  console.log(`\n✅ Sucesso! Arquivos gerados em: ${outDir}`)
  console.log(`- Áudio final: ${finalM4a} (${tempoAcumulado.toFixed(1)}s)`)
  console.log(`- Manifesto:   ${manifestPath}`)
}

main().catch((err) => {
  console.error('\n❌ Erro durante a execução:', err)
  process.exit(1)
})

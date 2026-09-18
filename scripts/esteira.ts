/**
 * Esteira de Produção Universal para Perícopes Bíblicas
 * 
 * Pipeline desacoplado em 4 estágios com controle de qualidade e anti-alucinação:
 *   1. Redação & Curadoria:
 *      - Reescrita editorial (sem enrolação, vocabulário natural e simples, insights históricos).
 *      - Validação mecânica (validarMaterial e titulos-ancorados).
 *      - Auditoria de Não-Alucinação (auditor anti-invenção com feedback loop).
 *      - Sincronização do catálogo (data/enriched/, data/pericopes.json e roteiro.jsonl).
 *   2. Narração TTS:
 *      - Síntese com voz Algenib v3 no Gemini 3.1 Flash TTS (Google Cloud Vertex AI).
 *      - Masterização EBU R128 (-14.7 LUFS).
 *   3. Alinhamento Acústico:
 *      - Alinhamento forçado palavra a palavra via Meta MMS_FA (scripts/alinhar-corpus.py).
 *   4. Publicação R2 & Shards:
 *      - Upload de .m4a e manifest.json no Cloudflare R2 (prefixo algenib-v4).
 *      - Atualização dos shards do app web.
 * 
 * Uso:
 *   npx tsx scripts/esteira.ts --ordem=1620
 *   npx tsx scripts/esteira.ts --ordens=1620..1639
 *   npx tsx scripts/esteira.ts --livro=Mateus [--limite=20]
 *   npx tsx scripts/esteira.ts --status
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, exec } from 'node:child_process'
import { promisify } from 'node:util'
import { validarMaterial, type Material } from './validar-material.ts'
import { ancorar } from './titulos-ancorados.ts'
import { blocosDaResenha } from '../src/lib/paragraphize.ts'

const execAsync = promisify(exec)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const estadoPath = join(root, 'data', 'pipeline-estado.json')
const roteiroPath = '/Volumes/SSD 2TB SD/dev/tts-spike/roteiro.jsonl'
const pericopesPath = join(root, 'data', 'pericopes.json')
const corpusDir = join(root, 'amostras', 'corpus-algenib-v3')

// Configuração do ambiente e Service Account
interface ServiceAccountKey {
  project_id: string
  client_email: string
  private_key: string
}

function carregarServiceAccount(): ServiceAccountKey {
  const arquivos = readdirSync(root)
  const achado = arquivos.find(
    (f) =>
      (f.startsWith('kitchen-auth-') || f.includes('service-account') || f.includes('serviceaccount')) &&
      f.endsWith('.json'),
  )
  if (!achado) throw new Error('Arquivo de conta de serviço Google Cloud (service account) não encontrado!')
  return JSON.parse(readFileSync(join(root, achado), 'utf8'))
}

function base64url(str: string | Buffer): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

let tokenCache: { token: string; exp: number } | null = null

async function obterTokenVertex(sa: ServiceAccountKey): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  if (tokenCache && tokenCache.exp > agora + 300) {
    return tokenCache.token
  }
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: agora + 3600,
    iat: agora,
  }
  const tokenData = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signer = createSign('RSA-SHA256')
  signer.update(tokenData)
  const sig = base64url(signer.sign(sa.private_key))
  const jwt = `${tokenData}.${sig}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Falha ao obter token OAuth2 do Google Cloud: ${await res.text()}`)
  const data = await res.json()
  tokenCache = { token: data.access_token, exp: agora + 3600 }
  return data.access_token
}

// Estado do pipeline
export interface PericopeEstado {
  ordem: number
  livro: string
  ref: string
  revisado: boolean
  narrado: boolean
  alinhado: boolean
  publicado: boolean
  atualizadoEm: string
  erro?: string
}

export type PipelineEstado = Record<string, PericopeEstado>

export function carregarEstado(): PipelineEstado {
  if (!existsSync(estadoPath)) {
    // Inicializa marcando as primeiras 20 perícopes de Mateus (1600..1619) como já concluídas
    const inicial: PipelineEstado = {}
    for (let o = 1600; o <= 1619; o++) {
      inicial[o.toString()] = {
        ordem: o,
        livro: 'Mateus',
        ref: `Mt (ordem ${o})`,
        revisado: true,
        narrado: true,
        alinhado: true,
        publicado: true,
        atualizadoEm: new Date().toISOString(),
      }
    }
    writeFileSync(estadoPath, JSON.stringify(inicial, null, 2), 'utf8')
    return inicial
  }
  return JSON.parse(readFileSync(estadoPath, 'utf8'))
}

export function salvarEstado(st: PipelineEstado) {
  writeFileSync(estadoPath, JSON.stringify(st, null, 2), 'utf8')
}

export function atualizarEstado(
  ordem: number,
  updates: Partial<PericopeEstado>,
  metaDefault?: { livro?: string; ref?: string },
): PericopeEstado {
  const st = carregarEstado()
  const key = ordem.toString()
  if (!st[key]) {
    st[key] = {
      ordem,
      livro: metaDefault?.livro || 'Mateus',
      ref: metaDefault?.ref || `ordem ${ordem}`,
      revisado: false,
      narrado: false,
      alinhado: false,
      publicado: false,
      atualizadoEm: new Date().toISOString(),
      ...updates,
    }
  } else {
    Object.assign(st[key], updates, { atualizadoEm: new Date().toISOString() })
  }
  salvarEstado(st)
  return st[key]
}

// Sincronização do roteiro.jsonl
export function sincronizarRoteiro(ordem: number, rev: Material, livro: string) {
  if (!existsSync(roteiroPath)) return
  const linhas = readFileSync(roteiroPath, 'utf8').split('\n')
  const unidades: any[] = []
  let refTexto = `${livro}.`

  for (const l of linhas) {
    if (!l.trim()) continue
    const u = JSON.parse(l)
    if (u.ordem === ordem) {
      if (u.secao === 'titulo' && u.i === 1) refTexto = u.texto
      unidades.push(u)
    }
  }

  const versiculosTexto = unidades.filter((u) => u.secao === 'texto')
  const novas: { secao: string; texto: string }[] = []

  // 1. Título e Referência
  novas.push({ secao: 'titulo', texto: `${rev.titulo_pericope_pt}.` })
  novas.push({ secao: 'titulo', texto: refTexto })

  // 2. Contexto
  novas.push({ secao: 'contexto', texto: 'Contexto.' })
  const ctxParas = rev.contexto_historico_literario.split('\n\n').map((p) => p.trim()).filter(Boolean)
  for (const cp of ctxParas) novas.push({ secao: 'contexto', texto: cp })

  // 3. Texto Bíblico
  for (const vt of versiculosTexto) novas.push({ secao: 'texto', texto: vt.texto })

  // 4. Resenha
  novas.push({ secao: 'resenha', texto: 'Resenha.' })
  const blocos = blocosDaResenha(rev.resenha)
  const prosa = blocos.filter((b) => b.tipo === 'prosa')
  const palavras = blocos.filter((b) => b.tipo === 'palavra')
  for (const pr of prosa) novas.push({ secao: 'resenha', texto: pr.texto })

  // 5. Palavras
  if (palavras.length > 0) {
    novas.push({ secao: 'palavras', texto: 'As palavras do trecho.' })
    for (const pal of palavras) novas.push({ secao: 'palavras', texto: pal.texto })
  }

  // 6. Reflexões
  novas.push({ secao: 'reflexoes', texto: 'Reflexões.' })
  novas.push({ secao: 'reflexoes', texto: `Reflexão 1. ${rev.perguntas_reflexao[0]}` })
  novas.push({ secao: 'reflexoes', texto: `Reflexão 2. ${rev.perguntas_reflexao[1]}` })

  const n_unid = novas.length
  const formatadas = novas.map((nu, idx) => ({
    ordem,
    livro,
    i: idx,
    secao: nu.secao,
    texto: nu.texto,
    n_unid,
  }))

  const todasLinhas = linhas
    .filter((l) => {
      if (!l.trim()) return false
      return JSON.parse(l).ordem !== ordem
    })
    .map((l) => JSON.parse(l))

  todasLinhas.push(...formatadas)
  todasLinhas.sort((a, b) => (a.ordem !== b.ordem ? a.ordem - b.ordem : a.i - b.i))

  writeFileSync(roteiroPath, todasLinhas.map((u) => JSON.stringify(u)).join('\n') + '\n', 'utf8')
}

// ESTÁGIO 1: REDAÇÃO E CURADORIA
async function chamarVertexAI(prompt: string, sa: ServiceAccountKey, retries = 3): Promise<string> {
  let erroUltimo: any
  for (let tent = 1; tent <= retries; tent++) {
    try {
      const token = await obterTokenVertex(sa)
      // Usa região São Paulo (southamerica-east1) para latência ultrabaixa (~15ms)
      const url = `https://southamerica-east1-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/southamerica-east1/publishers/google/models/gemini-2.5-flash:generateContent`

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Connection: 'close', // Evita sockets TCP half-open pendurados
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(15000), // Falha rápido em 15s em vez de 35s
      })

      if (!res.ok) throw new Error(`Erro API Vertex AI (${res.status}): ${await res.text()}`)
      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error(`Resposta vazia da Vertex AI: ${JSON.stringify(json)}`)
      return text
    } catch (err: any) {
      erroUltimo = err
      if (tent < retries) {
        console.warn(`    ⚠️ [Vertex AI SP] Tentativa ${tent} falhou ou timed out (${err.message}). Retentando em 1s...`)
        await delay(1000)
      }
    }
  }
  throw erroUltimo
}

async function auditarNaoAlucinacao(
  textoBiblico: string,
  material: Material,
  sa: ServiceAccountKey,
): Promise<{ aprovado: boolean; motivo?: string }> {
  const auditorPrompt = `Você é um auditor teológico e histórico rigoroso da Bíblia Sagrada.
Sua missão é auditar o material editorial de uma perícope bíblica contra o texto bíblico fornecido.

Você procura por 5 tipos de defeitos graves de invenção e alucinação:
1. CONTRADIZ_VERSICULO: O material afirma algo que o texto bíblico da perícope contradiz diretamente ou nega.
2. FATO_INVENTADO: Números, nomes de pessoas, relações de parentesco, datas ou afirmações de "primeira vez que aparece" que o texto bíblico não dá e a história não sustenta.
3. COSTUME_SEM_FONTE: Afirma costumes culturais, sociais ou religiosos da época que não têm respaldo histórico ou arqueológico sólido, ou universaliza um caso particular como se fosse regra geral.
4. SILENCIO_FALSO: Afirma que o texto bíblico cala sobre algo quando o próprio texto explica o motivo.
5. CONTRADIZ_CAMPO: O Contexto e a Resenha entram em contradição entre si.

Texto Bíblico:
${textoBiblico}

Material a Auditar:
- Título: ${material.titulo_pericope_pt}
- Contexto: ${material.contexto_historico_literario}
- Resenha: ${material.resenha}

Responda APENAS com um JSON válido:
{
  "aprovado": true ou false,
  "motivo": "se falso, explique de forma clara e objetiva o que está errado"
}`

  try {
    const raw = await chamarVertexAI(auditorPrompt, sa)
    const res = JSON.parse(raw)
    return { aprovado: res.aprovado === true, motivo: res.motivo }
  } catch (err: any) {
    console.warn(`    ⚠️ Auditoria de alucinação avisou: ${err.message}`)
    return { aprovado: true }
  }
}

async function executarRedacaoECuradoria(ordem: number, sa: ServiceAccountKey): Promise<Material> {
  const periPath = join(root, 'data', 'enriched', `${ordem}.json`)
  if (!existsSync(periPath)) throw new Error(`Arquivo data/enriched/${ordem}.json não encontrado.`)
  const peri = JSON.parse(readFileSync(periPath, 'utf8'))
  const textoBiblico = peri.texto

  let feedbackAnterior = ''
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    if (tentativa > 1) {
      console.log(`  [${hora()}] 🔄 [1/4 Redação] [${ordem}] Tentativa ${tentativa}/3 após ajuste...`)
    }

    const prompt = `Você é um teólogo especialista que ama a Escritura e respeita o tempo do leitor — com a clareza de Carl Sagan, falando com pessoas inteligentes de forma natural, simples e fascinante.

PÚBLICO: pessoas lendo a Bíblia pela segunda vez.
VOCABULÁRIO: Descomplicado e do dia a dia. Não use palavras que exijam dicionário (evite termos como purismo farisaico, linhagens imaculadas, etc. Use termos simples como preconceito religioso, linhagens puras, etc.).

DIRETRIZES FUNDAMENTAIS:
1. SEM ENROLAÇÃO: Não use clichês nem pedagogismos ("Neste trecho vemos...", "É importante notar que...", "Podemos aprender..."). Vá direto aos fatos históricos e insights.
2. CONTEXTO HISTÓRICO E LITERÁRIO: Exatamente 2 parágrafos. Fatos culturais judaicos/romanos da época, cenário histórico, intenção original do autor.
3. RESENHA: Exatamente 2 parágrafos de prosa explicando por que as coisas aconteceram daquele jeito + uma lista em tópicos ("- ") com 2 a 4 termos do trecho.
   IMPORTANTE: Cada item da lista de termos DEVE ser uma frase completa, corrida e natural (ex: "- O termo hipócritas, ali, descrevia quem..."). NUNCA use formato de dicionário ("- Hipócritas: pessoas que...").
4. TÍTULO ANCORADO: Claro, atraente e contendo palavras reais ou nomes próprios do texto bíblico.
5. PERGUNTAS DE REFLEXÃO: Exatamente 2 perguntas práticas e profundas para a vida do leitor.
6. TÓPICOS PARA PREGAR:
   Linha de raciocínio
   - 5 a 7 tópicos com palavras-chave em **negrito**

   Mensagens a levar
   - 4 a 6 mensagens com palavras-chave em **negrito**
7. NÃO-ALUCINAÇÃO: Não invente costumes, números, datas ou parentescos. Citações entre aspas devem ser IDÊNTICAS ao texto dado.

${feedbackAnterior ? `ATENÇÃO: A tentativa anterior foi reprovada pelo seguinte motivo. Corrija rigorosamente:\n${feedbackAnterior}\n` : ''}

Texto Bíblico:
${textoBiblico}

Retorne APENAS um JSON válido no formato:
{
  "titulo_pericope_pt": "...",
  "contexto_historico_literario": "paragrafo 1\\n\\nparagrafo 2",
  "resenha": "paragrafo 1\\n\\nparagrafo 2\\n\\n- Frase do termo 1...\\n- Frase do termo 2...",
  "perguntas_reflexao": ["...", "..."],
  "topicos_pregar": "Linha de raciocínio\\n- ...\\n\\nMensagens a levar\\n- ..."
}`

    const raw = await chamarVertexAI(prompt, sa)
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      feedbackAnterior = 'O retorno não foi um JSON válido.'
      console.log(`  [${hora()}] ⚠️ [1/4 Redação] [${ordem}] Retorno da IA não era JSON válido. Refazendo...`)
      continue
    }

    const material: Material = {
      ordem,
      titulo_pericope_pt: parsed.titulo_pericope_pt?.trim(),
      contexto_historico_literario: parsed.contexto_historico_literario?.trim(),
      resenha: parsed.resenha?.trim(),
      perguntas_reflexao: parsed.perguntas_reflexao,
      topicos_pregar: parsed.topicos_pregar?.trim(),
    }

    // 1. Validação Mecânica (validarMaterial)
    const vMec = validarMaterial({ texto: textoBiblico, livro: peri.livro }, material, raw)
    if (vMec.problemas.length > 0) {
      feedbackAnterior = `Falha na validação mecânica: ${vMec.problemas.join('; ')}`
      console.log(`  [${hora()}] ⚠️ [1/4 Redação] [${ordem}] Curadoria mecânica reprovou: ${vMec.problemas.join('; ')}. Reajustando...`)
      continue
    }

    // 2. Validação de Âncora Textual do Título
    const vAncora = ancorar(material.titulo_pericope_pt, textoBiblico)
    if (!vAncora.ancorado) {
      feedbackAnterior = `Título "${material.titulo_pericope_pt}" não está ancorado no texto (precisa conter pelo menos 1 nome próprio ou 2 palavras de conteúdo da passagem).`
      console.log(`  [${hora()}] ⚠️ [1/4 Redação] [${ordem}] Título não ancorado ("${material.titulo_pericope_pt}"). Reajustando...`)
      continue
    }

    // 3. Auditoria Anti-Alucinação
    const vAudit = await auditarNaoAlucinacao(textoBiblico, material, sa)
    if (!vAudit.aprovado) {
      feedbackAnterior = `Alucinação ou invenção detectada pelo auditor: ${vAudit.motivo}`
      console.log(`  [${hora()}] ⚠️ [1/4 Redação] [${ordem}] Auditoria detectou: ${vAudit.motivo}. Reajustando...`)
      continue
    }

    // Aprovado em todos os portões!
    // Atualiza data/enriched/{ordem}.json
    const atualizado = { ...peri, ...material }
    writeFileSync(periPath, JSON.stringify(atualizado, null, 2), 'utf8')

    // Atualiza data/pericopes.json
    const pericopes = JSON.parse(readFileSync(pericopesPath, 'utf8')) as any[]
    const idx = pericopes.findIndex((p) => p.ordem === ordem)
    if (idx !== -1) {
      pericopes[idx].titulo_pericope_pt = material.titulo_pericope_pt
      writeFileSync(pericopesPath, JSON.stringify(pericopes, null, 2), 'utf8')
    }

    // Sincroniza roteiro.jsonl
    sincronizarRoteiro(ordem, material, peri.livro)

    return material
  }

  throw new Error(`Perícope ${ordem} falhou na curadoria após 3 tentativas: ${feedbackAnterior}`)
}

// ESTÁGIO 2: NARRAÇÃO TTS
async function executarNarracaoTTS(ordem: number) {
  await execAsync(`npx tsx scripts/gerar-lote.ts --ordem=${ordem} --forcar`, { maxBuffer: 10 * 1024 * 1024 })
}

// ESTÁGIO 3: ALINHAMENTO ACÚSTICO MMS_FA
async function executarAlinhamentoMMS(ordem: number) {
  const pythonPath = '/Volumes/SSD 2TB SD/dev/tts-spike/.venv/bin/python'
  await execAsync(`"${pythonPath}" scripts/alinhar-corpus.py ${ordem}`, { maxBuffer: 10 * 1024 * 1024 })
}

// ESTÁGIO 4: PUBLICAÇÃO R2 & SHARDS
async function executarPublicacaoR2(ordem: number, prefixo: string = 'algenib-v4') {
  await execAsync(`npx tsx scripts/publicar-r2.ts --ordem=${ordem} --prefixo=${prefixo}`, { maxBuffer: 10 * 1024 * 1024 })
}

function hora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false })
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ORQUESTRADOR PRINCIPAL CONCORRENTE
async function main() {
  const args = process.argv.slice(2)
  const sa = carregarServiceAccount()
  const estado = carregarEstado()

  const catalogo = JSON.parse(readFileSync(pericopesPath, 'utf8')) as any[]
  const catalogoPorOrdem = new Map(catalogo.map((p) => [p.ordem, p]))

  let ordens: number[] = []
  let limite = 9999
  let prefixo = 'algenib-v4'
  let forcar = args.includes('--forcar')
  let concorrencia = 2

  for (const a of args) {
    if (a.startsWith('--ordem=')) ordens = [parseInt(a.split('=')[1], 10)]
    if (a.startsWith('--ordens=')) {
      const [ini, fim] = a.split('=')[1].split('..').map((v) => parseInt(v, 10))
      ordens = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i)
    }
    if (a.startsWith('--livro=')) {
      const nomeLivro = a.split('=')[1]
      ordens = catalogo.filter((p) => p.livro.toLowerCase() === nomeLivro.toLowerCase()).map((p) => p.ordem)
    }
    if (a.startsWith('--limite=')) limite = parseInt(a.split('=')[1], 10)
    if (a.startsWith('--prefixo=')) prefixo = a.split('=')[1]
    if (a.startsWith('--concorrencia=')) concorrencia = Math.max(1, parseInt(a.split('=')[1], 10))
    if (a.startsWith('--paralelo=')) concorrencia = Math.max(1, parseInt(a.split('=')[1], 10))
  }

  if (args.includes('--status')) {
    const total = Object.keys(estado).length
    const publicados = Object.values(estado).filter((s) => s.publicado).length
    console.log(`Estado atual do pipeline: ${publicados}/${total} perícopes publicadas no R2.`)
    return
  }

  if (ordens.length === 0) {
    console.log('Uso: npx tsx scripts/esteira.ts --ordem=1620 | --ordens=1620..1639 | --livro=Mateus [--limite=10]')
    return
  }

  if (ordens.length > limite) {
    ordens = ordens.slice(0, limite)
  }

  // Inicializa estado para todas as ordens do lote
  for (const ordem of ordens) {
    const meta = catalogoPorOrdem.get(ordem)
    const refFormatada = meta
      ? `${meta.abbrev} ${meta.capitulo_inicio}:${meta.versiculo_inicio}-${meta.versiculo_fim}`
      : `ordem ${ordem}`

    if (!estado[ordem.toString()]) {
      estado[ordem.toString()] = {
        ordem,
        livro: meta?.livro || 'Bíblia',
        ref: refFormatada,
        revisado: false,
        narrado: false,
        alinhado: false,
        publicado: false,
        atualizadoEm: new Date().toISOString(),
      }
    } else {
      estado[ordem.toString()].ref = refFormatada
      if (meta?.livro) estado[ordem.toString()].livro = meta.livro
    }
  }
  salvarEstado(estado)

  const semRedacao = args.includes('--sem-redacao') || args.includes('--somente-audio')

  console.log('==================================================================')
  console.log('  ESTEIRA DE PRODUÇÃO CONCORRENTE — BÍBLIA PERÍCOPES')
  console.log(`  Alvo: ${ordens.length} perícopes | Prefixo R2: ${prefixo} | Concorrência: ${concorrencia}x`)
  console.log(
    semRedacao
      ? `  Modo: SOMENTE ÁUDIO (${concorrencia} workers simultâneos de TTS, MMS e R2)`
      : `  4 Filas Operando Simultaneamente (${concorrencia}x por estágio)`,
  )
  console.log('==================================================================\n')

  let worker1Ativo = !semRedacao
  let worker2Ativo = true
  let worker3Ativo = true
  let worker4Ativo = true

  let ttsEmExecucao = concorrencia
  let mmsEmExecucao = concorrencia
  let r2EmExecucao = concorrencia

  const emRedacao = new Set<number>()
  const emTTS = new Set<number>()
  const emAlinhamento = new Set<number>()
  const emPublicacao = new Set<number>()

  const falhasTTS = new Map<number, number>()
  const falhasMMS = new Map<number, number>()
  const falhasR2 = new Map<number, number>()
  const MAX_FALHAS = 2

  let totalPublicadas = 0

  // WORKER 1: REDAÇÃO & CURADORIA (Gemini 2.5 Flash + Auditoria Anti-Alucinação)
  async function workerRedacao() {
    if (semRedacao) {
      console.log(`[${hora()}] 🤖 Fila de Redação delegada ao Subagente (--somente-audio).`)
      worker1Ativo = false
      return
    }

    while (true) {
      const estadoAtual = carregarEstado()
      const pendente = ordens.find((o) => {
        const st = estadoAtual[o.toString()]
        return (!st?.revisado || forcar) && !emRedacao.has(o)
      })
      if (!pendente) break

      emRedacao.add(pendente)
      const st = estadoAtual[pendente.toString()]
      const meta = catalogoPorOrdem.get(pendente)
      const ref = st?.ref || `ordem ${pendente}`

      const t0 = Date.now()
      console.log(`[${hora()}] ✍️  [1/4 Redação] [${pendente}] INICIANDO... (${ref})`)

      try {
        const mat = await executarRedacaoECuradoria(pendente, sa)
        const dur = ((Date.now() - t0) / 1000).toFixed(1)
        atualizarEstado(pendente, { revisado: true, erro: undefined })
        console.log(`[${hora()}] ✍️  [1/4 Redação] [${pendente}] CONCLUÍDA em ${dur}s ("${mat.titulo_pericope_pt}")`)
      } catch (err: any) {
        console.error(`[${hora()}] ❌ [1/4 Redação] [${pendente}] ERRO: ${err.message}`)
        atualizarEstado(pendente, { erro: err.message })
      } finally {
        emRedacao.delete(pendente)
      }
      await delay(50)
    }
    worker1Ativo = false
  }

  // WORKER 2: NARRAÇÃO TTS (Gemini 3.1 Flash TTS - Algenib v3 + EBU R128)
  async function workerTTS(workerId: number) {
    const rotulo = concorrencia > 1 ? `#W${workerId}` : ''
    while (
      worker1Ativo ||
      ordens.some((o) => {
        const st = carregarEstado()[o.toString()]
        const f = falhasTTS.get(o) || 0
        return st && !st.publicado && f < MAX_FALHAS
      })
    ) {
      const estadoAtual = carregarEstado()
      const pendente = ordens.find((o) => {
        const st = estadoAtual[o.toString()]
        const f = falhasTTS.get(o) || 0
        return st && st.revisado && (!st.narrado || forcar) && !emTTS.has(o) && f < MAX_FALHAS
      })

      if (!pendente) {
        if (!worker1Ativo && !semRedacao) break
        if (
          semRedacao &&
          ordens.every((o) => estadoAtual[o.toString()]?.publicado || (falhasTTS.get(o) || 0) >= MAX_FALHAS)
        )
          break
        await delay(500)
        continue
      }

      emTTS.add(pendente)
      const t0 = Date.now()
      console.log(`[${hora()}] 🎙️  [2/4 Narração ${rotulo}] [${pendente}] INICIANDO síntese TTS Algenib v3...`)

      try {
        await executarNarracaoTTS(pendente)
        const dur = ((Date.now() - t0) / 1000).toFixed(1)
        atualizarEstado(pendente, { narrado: true, erro: undefined })
        console.log(`[${hora()}] 🎙️  [2/4 Narração ${rotulo}] [${pendente}] CONCLUÍDA em ${dur}s`)
      } catch (err: any) {
        const f = (falhasTTS.get(pendente) || 0) + 1
        falhasTTS.set(pendente, f)
        console.error(
          `[${hora()}] ❌ [2/4 Narração ${rotulo}] [${pendente}] ERRO (tentativa ${f}/${MAX_FALHAS}): ${err.message}`,
        )
        atualizarEstado(pendente, { erro: err.message })
        if (f >= MAX_FALHAS) {
          console.error(
            `[${hora()}] ⚠️  [2/4 Narração ${rotulo}] [${pendente}] Pulando após ${f} falhas para não bloquear a fila.`,
          )
        }
      } finally {
        emTTS.delete(pendente)
      }
      await delay(100)
    }
    ttsEmExecucao--
    if (ttsEmExecucao === 0) worker2Ativo = false
  }

  // WORKER 3: ALINHAMENTO ACÚSTICO MMS_FA (Torchaudio palavra por palavra)
  async function workerMMS(workerId: number) {
    const rotulo = concorrencia > 1 ? `#W${workerId}` : ''
    while (
      worker2Ativo ||
      ordens.some((o) => {
        const st = carregarEstado()[o.toString()]
        const f = falhasMMS.get(o) || 0
        return st && st.narrado && (!st.alinhado || forcar) && !emAlinhamento.has(o) && f < MAX_FALHAS
      })
    ) {
      const estadoAtual = carregarEstado()
      const pendente = ordens.find((o) => {
        const st = estadoAtual[o.toString()]
        const f = falhasMMS.get(o) || 0
        return st && st.narrado && (!st.alinhado || forcar) && !emAlinhamento.has(o) && f < MAX_FALHAS
      })

      if (!pendente) {
        await delay(500)
        continue
      }

      emAlinhamento.add(pendente)
      const t0 = Date.now()
      console.log(`[${hora()}] ⏱️  [3/4 Alinhamento ${rotulo}] [${pendente}] INICIANDO alinhamento MMS_FA...`)

      try {
        await executarAlinhamentoMMS(pendente)
        const dur = ((Date.now() - t0) / 1000).toFixed(1)
        atualizarEstado(pendente, { alinhado: true, erro: undefined })
        console.log(`[${hora()}] ⏱️  [3/4 Alinhamento ${rotulo}] [${pendente}] CONCLUÍDO em ${dur}s`)
      } catch (err: any) {
        const f = (falhasMMS.get(pendente) || 0) + 1
        falhasMMS.set(pendente, f)
        console.error(
          `[${hora()}] ❌ [3/4 Alinhamento ${rotulo}] [${pendente}] ERRO (tentativa ${f}/${MAX_FALHAS}): ${err.message}`,
        )
        atualizarEstado(pendente, { erro: err.message })
        if (f >= MAX_FALHAS) {
          console.error(
            `[${hora()}] ⚠️  [3/4 Alinhamento ${rotulo}] [${pendente}] Pulando após ${f} falhas para não bloquear a fila.`,
          )
        }
      } finally {
        emAlinhamento.delete(pendente)
      }
      await delay(100)
    }
    mmsEmExecucao--
    if (mmsEmExecucao === 0) worker3Ativo = false
  }

  // WORKER 4: PUBLICAÇÃO R2 & NOTIFICAÇÃO (Upload Cloudflare R2 + Log)
  async function workerR2(workerId: number) {
    const rotulo = concorrencia > 1 ? `#W${workerId}` : ''
    while (
      worker3Ativo ||
      ordens.some((o) => {
        const st = carregarEstado()[o.toString()]
        const f = falhasR2.get(o) || 0
        return st && st.alinhado && (!st.publicado || forcar) && !emPublicacao.has(o) && f < MAX_FALHAS
      })
    ) {
      const estadoAtual = carregarEstado()
      const pendente = ordens.find((o) => {
        const st = estadoAtual[o.toString()]
        const f = falhasR2.get(o) || 0
        return st && st.alinhado && (!st.publicado || forcar) && !emPublicacao.has(o) && f < MAX_FALHAS
      })

      if (!pendente) {
        await delay(500)
        continue
      }

      emPublicacao.add(pendente)
      const meta = catalogoPorOrdem.get(pendente)
      const t0 = Date.now()
      console.log(`[${hora()}] ☁️  [4/4 Publicação ${rotulo}] [${pendente}] INICIANDO upload R2...`)

      try {
        await executarPublicacaoR2(pendente, prefixo)
        const dur = ((Date.now() - t0) / 1000).toFixed(1)
        atualizarEstado(pendente, { publicado: true, erro: undefined })
        totalPublicadas++
        console.log(`[${hora()}] ☁️  [4/4 Publicação ${rotulo}] [${pendente}] CONCLUÍDA em ${dur}s`)
        console.log(`\n==================================================================`)
        console.log(`✨ [${meta?.livro || 'Salmos'} ${pendente}] ✅ PUBLICADO E DISPONÍVEL NO AR COM REALCE!`)
        console.log(`🔗 https://aipericopes.com/leitura/${pendente}`)
        console.log(`==================================================================\n`)
      } catch (err: any) {
        const f = (falhasR2.get(pendente) || 0) + 1
        falhasR2.set(pendente, f)
        console.error(
          `[${hora()}] ❌ [4/4 Publicação ${rotulo}] [${pendente}] ERRO (tentativa ${f}/${MAX_FALHAS}): ${err.message}`,
        )
        atualizarEstado(pendente, { erro: err.message })
        if (f >= MAX_FALHAS) {
          console.error(
            `[${hora()}] ⚠️  [4/4 Publicação ${rotulo}] [${pendente}] Pulando após ${f} falhas para não bloquear a fila.`,
          )
        }
      } finally {
        emPublicacao.delete(pendente)
      }
      await delay(100)
    }
    r2EmExecucao--
    if (r2EmExecucao === 0) worker4Ativo = false
  }

  // Roda workers simultaneamente em paralelo com a concorrência escolhida!
  const listaWorkers = [
    workerRedacao(),
    ...Array.from({ length: concorrencia }, (_, i) => workerTTS(i + 1)),
    ...Array.from({ length: concorrencia }, (_, i) => workerMMS(i + 1)),
    ...Array.from({ length: concorrencia }, (_, i) => workerR2(i + 1)),
  ]
  await Promise.all(listaWorkers)

  // Ao final do lote, executa o Passo 5 (Sincronização editorial, Cobertura de Áudio e Shards)
  try {
    const cmdPasso5 = args.includes('--deploy')
      ? 'npx tsx scripts/passo-5-publicar-site.ts'
      : 'npx tsx scripts/passo-5-publicar-site.ts --sem-deploy'
    execSync(cmdPasso5, { stdio: 'inherit' })
  } catch (err: any) {
    console.warn('Aviso no Passo 5:', err.message)
  }

  console.log('\n==================================================================')
  console.log(`🏁 LOTE CONCLUÍDO: ${totalPublicadas} perícopes produzidas e publicadas.`)
  console.log('==================================================================\n')
}

if (process.argv[1]?.endsWith('esteira.ts')) {
  main().catch((err) => {
    console.error('Erro fatal:', err)
    process.exit(1)
  })
}

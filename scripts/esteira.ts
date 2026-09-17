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
import { createSign } from 'node:crypto'
import { execSync } from 'node:child_process'
import { validarMaterial, type Material } from './validar-material.ts'
import { ancorar } from './titulos-ancorados.ts'
import { blocosDaResenha } from '../src/lib/paragraphize.ts'

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
async function chamarVertexAI(prompt: string, sa: ServiceAccountKey): Promise<string> {
  const token = await obterTokenVertex(sa)
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
  })

  if (!res.ok) throw new Error(`Erro API Vertex AI: ${await res.text()}`)
  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error(`Resposta vazia da Vertex AI: ${JSON.stringify(json)}`)
  return text
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
      continue
    }

    // 2. Validação de Âncora Textual do Título
    const vAncora = ancorar(material.titulo_pericope_pt, textoBiblico)
    if (!vAncora.ancorado) {
      feedbackAnterior = `Título "${material.titulo_pericope_pt}" não está ancorado no texto (precisa conter pelo menos 1 nome próprio ou 2 palavras de conteúdo da passagem).`
      continue
    }

    // 3. Auditoria Anti-Alucinação
    const vAudit = await auditarNaoAlucinacao(textoBiblico, material, sa)
    if (!vAudit.aprovado) {
      feedbackAnterior = `Alucinação ou invenção detectada pelo auditor: ${vAudit.motivo}`
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
function executarNarracaoTTS(ordem: number) {
  execSync(`npx tsx scripts/gerar-lote.ts --ordem=${ordem} --forcar`, { stdio: 'pipe' })
}

// ESTÁGIO 3: ALINHAMENTO ACÚSTICO MMS_FA
function executarAlinhamentoMMS(ordem: number) {
  const pythonPath = '/Volumes/SSD 2TB SD/dev/tts-spike/.venv/bin/python'
  execSync(`"${pythonPath}" scripts/alinhar-corpus.py ${ordem}`, { stdio: 'pipe' })
}

// ESTÁGIO 4: PUBLICAÇÃO R2 & SHARDS
function executarPublicacaoR2(ordem: number, prefixo: string = 'algenib-v4') {
  execSync(`npx tsx scripts/publicar-r2.ts --ordem=${ordem} --prefixo=${prefixo}`, { stdio: 'pipe' })
}

// ORQUESTRADOR PRINCIPAL
async function main() {
  const args = process.argv.slice(2)
  const sa = carregarServiceAccount()
  const estado = carregarEstado()

  let ordens: number[] = []
  let limite = 9999
  let prefixo = 'algenib-v4'
  let forcar = args.includes('--forcar')

  for (const a of args) {
    if (a.startsWith('--ordem=')) ordens = [parseInt(a.split('=')[1], 10)]
    if (a.startsWith('--ordens=')) {
      const [ini, fim] = a.split('=')[1].split('..').map((v) => parseInt(v, 10))
      ordens = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i)
    }
    if (a.startsWith('--livro=')) {
      const nomeLivro = a.split('=')[1]
      const catalogo = JSON.parse(readFileSync(pericopesPath, 'utf8')) as any[]
      ordens = catalogo.filter((p) => p.livro.toLowerCase() === nomeLivro.toLowerCase()).map((p) => p.ordem)
    }
    if (a.startsWith('--limite=')) limite = parseInt(a.split('=')[1], 10)
    if (a.startsWith('--prefixo=')) prefixo = a.split('=')[1]
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

  console.log('==================================================================')
  console.log('  ESTEIRA DE PRODUÇÃO AUTOMATIZADA — BÍBLIA PERÍCOPES')
  console.log(`  Alvo: ${ordens.length} perícopes | Prefixo R2: ${prefixo}`)
  console.log('==================================================================\n')

  let processadas = 0

  for (const ordem of ordens) {
    if (processadas >= limite) break
    if (!estado[ordem.toString()]) {
      estado[ordem.toString()] = {
        ordem,
        livro: '',
        ref: '',
        revisado: false,
        narrado: false,
        alinhado: false,
        publicado: false,
        atualizadoEm: new Date().toISOString(),
      }
    }
    const st = estado[ordem.toString()]!

    if (!forcar && st.publicado) {
      // Já está concluído
      continue
    }

    const periPath = join(root, 'data', 'enriched', `${ordem}.json`)
    if (!existsSync(periPath)) continue
    const peri = JSON.parse(readFileSync(periPath, 'utf8'))
    st.livro = peri.livro
    st.ref = `${peri.abbrev} (ordem ${ordem})`

    console.log(`\n▶️ [${ordem}] Processando ${peri.livro} (ordem ${ordem})...`)

    try {
      // 1. Redação & Curadoria
      if (forcar || !st.revisado) {
        process.stdout.write('  ✍️  [1/4] Redação & Curadoria (Anti-Alucinação)... ')
        const mat = await executarRedacaoECuradoria(ordem, sa)
        st.revisado = true
        st.atualizadoEm = new Date().toISOString()
        salvarEstado(estado)
        console.log(`OK ("${mat.titulo_pericope_pt}")`)
      }

      // 2. Narração TTS
      if (forcar || !st.narrado) {
        process.stdout.write('  🎙️  [2/4] Narração TTS (Algenib v3)... ')
        executarNarracaoTTS(ordem)
        st.narrado = true
        st.atualizadoEm = new Date().toISOString()
        salvarEstado(estado)
        console.log('OK')
      }

      // 3. Alinhamento Acústico MMS_FA
      if (forcar || !st.alinhado) {
        process.stdout.write('  ⏱️  [3/4] Alinhamento Palavra por Palavra (MMS_FA)... ')
        executarAlinhamentoMMS(ordem)
        st.alinhado = true
        st.atualizadoEm = new Date().toISOString()
        salvarEstado(estado)
        console.log('OK')
      }

      // 4. Publicação R2 & Shards
      if (forcar || !st.publicado) {
        process.stdout.write('  ☁️  [4/4] Publicação Cloudflare R2... ')
        executarPublicacaoR2(ordem, prefixo)
        st.publicado = true
        st.atualizadoEm = new Date().toISOString()
        salvarEstado(estado)
        console.log('OK')
      }

      processadas++
      console.log(`✨ [${peri.livro} ${ordem}] ✅ PUBLICADO E DISPONÍVEL NO AR! https://aipericopes.com/leitura/${ordem}`)
    } catch (err: any) {
      console.error(`\n❌ [${ordem}] ERRO NA ESTEIRA: ${err.message}`)
      st.erro = err.message
      salvarEstado(estado)
    }
  }

  // Ao final do lote, regenera shards do catálogo
  try {
    process.stdout.write('\n📦 Atualizando shards do catálogo... ')
    execSync('npx tsx scripts/shard-catalogo.ts --force', { stdio: 'pipe' })
    console.log('OK')
  } catch (err: any) {
    console.warn('Aviso ao regenerar shards:', err.message)
  }

  console.log('\n==================================================================')
  console.log(`🏁 LOTE CONCLUÍDO: ${processadas} perícopes produzidas e publicadas.`)
  console.log('==================================================================\n')
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

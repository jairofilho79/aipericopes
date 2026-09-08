/**
 * Enrich raw pericopes → data/pericopes.json
 *
 * Modes:
 *   --local              heuristic PT titles + didactic templates (default)
 *   --openrouter         OpenRouter API (needs OPENROUTER_API_KEY)
 *   --livro=Gênesis      filter by book
 *   --limit=N            process at most N pending items
 *   --force              re-enrich even non-stub caches
 *   --desatualizados     re-enrich ONLY items whose cached text/bounds went stale
 *   --concurrency=N      parallel OpenRouter calls (default 5)
 *   --commit-every=N     git commit+push every N enriched (default 0 = off)
 *   --no-push            commit without push
 *   --skip-git           never commit/push
 *
 * Usage: npx tsx scripts/enrich-pericopes.ts --local
 *        npm run enrich:all
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pericope, RawPericope } from '../src/lib/types.ts'
import { montarPericope, cacheDesatualizado } from './montar-catalogo.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rawPath = join(root, 'data/raw-pericopes.jsonl')
const enrichedDir = join(root, 'data/enriched')
const statePath = join(root, 'data/enrich-state.json')
const outPath = join(root, 'data/pericopes.json')

const SYSTEM_PROMPT = `Você escreve como um teólogo especialista que ama a Escritura e respeita o tempo do leitor — com a clareza de Carl Sagan, mas falando com jovens e adolescentes.

PÚBLICO: pessoas lendo a Bíblia pela segunda vez. Já conhecem um pouco, querem se aprofundar, mas NÃO têm vocabulário grande. Escreva para eles: inteligente, sem infantilizar; simples, sem empobrecer.

Missão: embasar na Palavra com insights de especialista; traduzir o essencial em português fácil e direto; e — só quando o texto abrir espaço com honestidade — ajudar a conhecer melhor a Deus e a Jesus.

Recebe o título da perícope em inglês e o texto bíblico na versão Bíblia Livre (BLIVRE).
Não altere nem “corrija” o texto bíblico.
Não invente citações literais fora do trecho dado.
Evite jargão denso, polêmica denominacional e frases feitas piedosas.

VOZ E LINGUAGEM (obrigatório):
- Frases curtas ou médias. Ordem natural: sujeito → verbo → complemento.
- Prefira palavras do dia a dia. Em vez de “cosmovisão”, diga “jeito de ver o mundo”; em vez de “antropológica”, diga o que isso muda na prática.
- Densidade alta, extensão baixa: cada frase traz insight ou dado útil.
- Se uma palavra incomum for MESMO necessária (hebraico, termo técnico, nome histórico), use-a e explique na hora, entre parênteses ou numa oração curta logo em seguida. Ex.: “a mulher é chamada ‘ezer kenegdo (uma ajuda à altura, alguém do mesmo nível — não uma empregada)”.
- Nunca deixe termo difícil solto. Nunca acumule três termos difíceis no mesmo parágrafo.
- Proibido: latinismos, academicês, adjetivos pomposos, “é interessante notar que…”.

PROFUNDIDADE (sem aleatoriedade):
- Inclua 1–2 insights de especialista que a maioria não perceberia sozinha — só se iluminarem ESTE trecho.
- Fontes legítimas (escolha o que couber): detalhe literário; dado histórico/cultural que muda o sentido; nuance hebraica/grega (sempre traduzida e explicada); eco claro dentro da Bíblia.
- Proibido: trivia, nomes de autores só para impressionar, digressões.
- Teste: “um especialista que ama o texto, fala com um adolescente inteligente e odeia perder o tempo dele manteria esta frase?” Se não, corte.

Responda APENAS com um JSON válido (sem markdown):
{
  "titulo_pericope_pt": "string curta",
  "contexto_historico_literario": "...",
  "resenha": "...",
  "perguntas_reflexao": ["pergunta 1", "pergunta 2"]
}

CAMPOS:

1) contexto_historico_literario (ANTES da leitura):
- A chave de entrada: o mínimo para chegar preparado, com 1 insight que prepara a leitura (não resumo do enredo).
- 1–2 parágrafos densos e claros (2 frases curtas/médias por parágrafo). Separe parágrafos com linha em branco (\n\n) no JSON.

2) resenha (DEPOIS da leitura):
- O que aconteceu e por quê, em palavras simples e precisas — e o que o texto realmente afirma.
- Integre o insight à história; não jogue “curiosidades” à parte.
- Sobre Deus: o que o próprio trecho mostra do caráter dEle, se estiver lá.
- Sobre Jesus: SOMENTE com abertura real. Sem abertura, silêncio. Prefira omissão a ligação artificial.
- 2–3 parágrafos curtos e densos (~2 frases cada; 3 parágrafos só se o trecho for muito rico). Separe com linha em branco (\n\n) entre eles. Sem tour versículo a versículo.

3) titulo_pericope_pt: natural, não palavra a palavra.
4) perguntas_reflexao: 2 perguntas afiadas, em linguagem jovem (não sim/não). Deus/Jesus só se couber ao trecho.

Português brasileiro. Profundo na ideia, fácil na frase. Surpreenda pelo acerto, não pelo vocabulário.`

const PHRASE_TITLES: Record<string, string> = {
  'The Creation of the Heavens and the Earth': 'A criação dos céus e da terra',
  'Adam and Eve in the Garden of Eden': 'Adão e Eva no jardim do Éden',
  'The Fall of Man': 'A queda do homem',
  'The Descendants of Adam': 'Os descendentes de Adão',
  'Corruption on the Earth': 'A corrupção na terra',
  'The Call of Noah': 'O chamado de Noé',
  'The Flood': 'O dilúvio',
  'The Noahic Covenant': 'A aliança noética',
  'The Descendants of Noah': 'Os descendentes de Noé',
  'The Table of Nations': 'A tábua das nações',
  'The Tower of Babel': 'A torre de Babel',
  'The Genealogy of Abram': 'A genealogia de Abrão',
  'The Call of Abram': 'O chamado de Abrão',
  'Abram and Sarai in Egypt': 'Abrão e Sarai no Egito',
  'Abram and Lot': 'Abrão e Ló',
  'War of the Four Kings vs. the Five Kings': 'Guerra dos quatro reis contra os cinco',
  'Melchizedek Blesses Abram': 'Melquisedeque abençoa Abrão',
  'The Covenant Between the Parts': 'A aliança entre as partes',
  'Hagar and Ishmael': 'Hagar e Ismael',
  'The Covenant of Circumcision': 'A aliança da circuncisão',
  'The Three Visitors': 'Os três visitantes',
  'Sodom and Gomorrah': 'Sodoma e Gomorra',
  'Abraham, Sarah, and Abimelech': 'Abraão, Sara e Abimeleque',
  'The Birth of Isaac': 'O nascimento de Isaque',
  'The Casting Out of Hagar and Ishmael': 'A expulsão de Hagar e Ismael',
  'The Covenant at Beersheba': 'A aliança em Berseba',
  'The Binding of Isaac': 'A ligação de Isaque',
  'Joseph\'s Dreams': 'Os sonhos de José',
  'Joseph Sold into Egypt': 'José vendido ao Egito',
  'The Resurrection of Jesus': 'A ressurreição de Jesus',
  'The Birth of Jesus': 'O nascimento de Jesus',
}

const WORD_MAP: Record<string, string> = {
  creation: 'criação',
  heavens: 'céus',
  heaven: 'céu',
  earth: 'terra',
  fall: 'queda',
  man: 'homem',
  men: 'homens',
  woman: 'mulher',
  women: 'mulheres',
  call: 'chamado',
  covenant: 'aliança',
  flood: 'dilúvio',
  tower: 'torre',
  birth: 'nascimento',
  death: 'morte',
  burial: 'sepultamento',
  descendants: 'descendentes',
  genealogy: 'genealogia',
  dreams: 'sonhos',
  dream: 'sonho',
  prayer: 'oração',
  song: 'cântico',
  songs: 'cânticos',
  blessing: 'bênção',
  blessings: 'bênçãos',
  curse: 'maldição',
  judgment: 'juízo',
  judgments: 'juízos',
  promise: 'promessa',
  promises: 'promessas',
  vision: 'visão',
  visions: 'visões',
  prophecy: 'profecia',
  prophet: 'profeta',
  prophets: 'profetas',
  king: 'rei',
  kings: 'reis',
  queen: 'rainha',
  priest: 'sacerdote',
  priests: 'sacerdotes',
  temple: 'templo',
  tabernacle: 'tabernáculo',
  law: 'lei',
  laws: 'leis',
  commandments: 'mandamentos',
  commandment: 'mandamento',
  journey: 'jornada',
  return: 'retorno',
  exile: 'exílio',
  restoration: 'restauração',
  gospel: 'evangelho',
  parable: 'parábola',
  parables: 'parábolas',
  miracle: 'milagre',
  miracles: 'milagres',
  crucifixion: 'crucificação',
  resurrection: 'ressurreição',
  ascension: 'ascensão',
  church: 'igreja',
  apostles: 'apóstolos',
  apostle: 'apóstolo',
  letter: 'carta',
  epistle: 'epístola',
  faith: 'fé',
  love: 'amor',
  hope: 'esperança',
  wisdom: 'sabedoria',
  praise: 'louvor',
  lament: 'lamento',
  war: 'guerra',
  peace: 'paz',
  garden: 'jardim',
  binding: 'sacrifício',
  sold: 'vendido',
  into: 'a',
  against: 'contra',
  between: 'entre',
  parts: 'partes',
  table: 'tábua',
  nations: 'nações',
  corruption: 'corrupção',
  visitors: 'visitantes',
  casting: 'expulsão',
  out: '',
  of: 'de',
  and: 'e',
  in: 'em',
  on: 'sobre',
  for: 'para',
  to: 'a',
  from: 'de',
  with: 'com',
  his: 'seu',
  her: 'sua',
  their: 'seus',
  vs: 'vs.',
  four: 'quatro',
  five: 'cinco',
  three: 'três',
  two: 'dois',
  first: 'primeiro',
  second: 'segundo',
  third: 'terceiro',
  last: 'último',
  new: 'nova',
  old: 'antiga',
  great: 'grande',
  little: 'pequeno',
  true: 'verdadeiro',
  false: 'falso',
  holy: 'santo',
  spirit: 'Espírito',
  god: 'Deus',
  lord: 'Senhor',
  jesus: 'Jesus',
  christ: 'Cristo',
  israel: 'Israel',
  egypt: 'Egito',
  jerusalem: 'Jerusalém',
  babylon: 'Babilônia',
  canaan: 'Canaã',
  sinai: 'Sinai',
  passover: 'Páscoa',
  sabbath: 'sábado',
  adam: 'Adão',
  eve: 'Eva',
  noah: 'Noé',
  abraham: 'Abraão',
  abram: 'Abrão',
  sarah: 'Sara',
  sarai: 'Sarai',
  isaac: 'Isaque',
  jacob: 'Jacó',
  esau: 'Esaú',
  joseph: 'José',
  moses: 'Moisés',
  aaron: 'Arão',
  joshua: 'Josué',
  david: 'Davi',
  solomon: 'Salomão',
  saul: 'Saul',
  elijah: 'Elias',
  elisha: 'Eliseu',
  isaiah: 'Isaías',
  jeremiah: 'Jeremias',
  ezekiel: 'Ezequiel',
  daniel: 'Daniel',
  peter: 'Pedro',
  paul: 'Paulo',
  john: 'João',
  mary: 'Maria',
  edens: 'Éden',
  eden: 'Éden',
}

function translateTitle(en: string): string {
  if (PHRASE_TITLES[en]) return PHRASE_TITLES[en]
  // strip leading articles; translate content words; skip empty
  const tokens = en.replace(/^((The|A|An)\s+)/i, '').split(/(\s+|[,—-])/)
  const out: string[] = []
  for (const t of tokens) {
    if (/^\s+$/.test(t) || t === '-' || t === '—' || t === ',') {
      out.push(t === ',' ? ',' : t)
      continue
    }
    const bare = t.replace(/[.'']$/g, '')
    const lower = bare.toLowerCase()
    if (lower === 'the' || lower === 'a' || lower === 'an') continue
    const mapped = WORD_MAP[lower]
    if (mapped === '') continue
    if (mapped) out.push(mapped)
    else out.push(bare)
  }
  let s = out.join('').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim()
  if (!s) s = en
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function localEnrich(raw: RawPericope): Omit<
  Pericope,
  | 'ordem'
  | 'livro'
  | 'abbrev'
  | 'capitulo_inicio'
  | 'versiculo_inicio'
  | 'capitulo_fim'
  | 'versiculo_fim'
  | 'texto'
> {
  const ref =
    raw.capitulo_inicio === raw.capitulo_fim && raw.versiculo_inicio === raw.versiculo_fim
      ? `${raw.livro} ${raw.capitulo_inicio}:${raw.versiculo_inicio}`
      : `${raw.livro} ${raw.capitulo_inicio}:${raw.versiculo_inicio}–${raw.capitulo_fim}:${raw.versiculo_fim}`

  const titulo = translateTitle(raw.titulo_en)
  const preview = raw.texto.split('\n').filter((l) => !l.startsWith('Capítulo')).slice(0, 3).join(' ')

  return {
    titulo_pericope_pt: titulo,
    contexto_historico_literario: `Antes de ler ${ref}: estamos no livro de ${raw.livro}. Esta perícope (“${titulo}”) é uma unidade com começo e fim próprios. Observe o cenário e os personagens — o detalhe do que acontece virá na leitura e na resenha.`,
    resenha: `Neste trecho, a narrativa trata de: ${titulo.toLowerCase()}.\n\nResuma mentalmente o que ocorreu e por quê. Se o texto falar de Deus, note o que revela do seu caráter; só faça ponte com Jesus quando o próprio texto ou a trama bíblica abrirem espaço com naturalidade.\n\nTrecho inicial: ${preview.slice(0, 220)}${preview.length > 220 ? '…' : ''}`,
    perguntas_reflexao: [
      `O que mais importa reter de ${ref} depois desta leitura?`,
      'Que atitude concreta este trecho convida você a viver nesta semana?',
    ],
  }
}

type AiPartial = ReturnType<typeof localEnrich>

function parseAiJson(text: string): AiPartial {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const obj = JSON.parse(cleaned) as AiPartial
  const resenha =
    typeof (obj as { resenha?: string }).resenha === 'string'
      ? (obj as { resenha: string }).resenha
      : typeof (obj as { comentario_narrador?: string }).comentario_narrador === 'string'
        ? (obj as { comentario_narrador: string }).comentario_narrador
        : null
  if (
    typeof obj.titulo_pericope_pt !== 'string' ||
    typeof obj.contexto_historico_literario !== 'string' ||
    !resenha ||
    !Array.isArray(obj.perguntas_reflexao) ||
    obj.perguntas_reflexao.length < 2
  ) {
    throw new Error('JSON da IA incompleto')
  }
  return {
    titulo_pericope_pt: obj.titulo_pericope_pt,
    contexto_historico_literario: obj.contexto_historico_literario,
    resenha,
    perguntas_reflexao: obj.perguntas_reflexao.slice(0, 2).map(String),
  }
}

async function openRouterEnrich(
  raw: RawPericope,
): Promise<{ ai: AiPartial; usage: Usage }> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY ausente')
  const model = process.env.OPENROUTER_MODEL || 'google/gemini-3.7-flash'
  const user = `Título (EN): ${raw.titulo_en}
Referência: ${raw.livro} ${raw.capitulo_inicio}:${raw.versiculo_inicio}–${raw.capitulo_fim}:${raw.versiculo_fim}
Texto bíblico:
${raw.texto}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/local/biblia-pericopes',
      'X-Title': 'biblia-pericopes-enrich',
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const err = new Error(`OpenRouter ${res.status}: ${await res.text()}`) as Error & {
      status?: number
    }
    err.status = res.status
    throw err
  }
  const data = (await res.json()) as {
    id?: string
    choices: { message: { content: string } }[]
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
      cost?: number
      native_tokens_prompt?: number
      native_tokens_completion?: number
    }
  }
  const u = data.usage ?? {}
  return {
    ai: parseAiJson(data.choices[0].message.content),
    usage: {
      prompt_tokens: u.prompt_tokens ?? u.native_tokens_prompt ?? 0,
      completion_tokens: u.completion_tokens ?? u.native_tokens_completion ?? 0,
      total_tokens: u.total_tokens ?? 0,
      cost_usd: typeof u.cost === 'number' ? u.cost : 0,
      generation_id: data.id,
    },
  }
}

type Usage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  generation_id?: string
}

function merge(raw: RawPericope, ai: AiPartial): Pericope {
  const prev = readCached(raw.ordem)
  return montarPericope(raw, {
    ...ai,
    ...(prev?.topicos_pregar ? { topicos_pregar: prev.topicos_pregar } : {}),
  })
}

const STUB_PATTERNS = [
  /forma uma unidade narrativa/i,
  // Ancorado no molde inteiro, não só em "Antes de ler ": a frase solta é
  // português natural ("Antes de ler o diálogo, note por que ele existe") e
  // marcava como stub material bom, mandando reenriquecer o que já estava certo.
  /^Antes de ler [^:]{1,60}: estamos no livro de /i,
  /Resuma mentalmente o que ocorreu/i,
  /Leia-o como um bloco contínuo/i,
  /o detalhe do que acontece virá na leitura e na resenha/i,
]

function isStub(p: Pick<Pericope, 'contexto_historico_literario' | 'resenha'>): boolean {
  const t = `${p.contexto_historico_literario}\n${p.resenha}`
  return STUB_PATTERNS.some((r) => r.test(t))
}

function cachePath(ordem: number) {
  return join(enrichedDir, `${ordem}.json`)
}

function readCached(ordem: number): Pericope | null {
  const f = cachePath(ordem)
  if (!existsSync(f)) return null
  const cached = JSON.parse(readFileSync(f, 'utf8')) as Pericope & {
    comentario_narrador?: string
  }
  if (!cached.resenha && cached.comentario_narrador) {
    cached.resenha = cached.comentario_narrador
    delete cached.comentario_narrador
  }
  return cached
}

function needsEnrich(raw: RawPericope, force: boolean, soDesatualizados = false): boolean {
  const cached = readCached(raw.ordem)
  if (soDesatualizados) return cacheDesatualizado(raw, cached)
  if (force) return true
  if (!cached) return true
  // Material escrito sobre um texto que mudou depois vale tão pouco quanto stub.
  return isStub(cached) || cacheDesatualizado(raw, cached)
}

function refLabel(raw: RawPericope) {
  return `${raw.livro} ${raw.capitulo_inicio}:${raw.versiculo_inicio}–${raw.capitulo_fim}:${raw.versiculo_fim}`
}

function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '?'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m${String(r).padStart(2, '0')}s`
  return `${r}s`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function runGit(args: string[]) {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (res.status !== 0) {
    const msg = (res.stderr || res.stdout || '').trim() || `git ${args.join(' ')} failed`
    throw new Error(msg)
  }
  return res
}

function parseArgs(argv: string[]) {
  const opts = {
    mode: 'local' as 'local' | 'openrouter',
    livro: '' as string,
    limit: Infinity,
    force: false,
    soDesatualizados: false,
    concurrency: 5,
    commitEvery: 0,
    noPush: false,
    skipGit: false,
  }
  for (const a of argv) {
    if (a === '--openrouter' || a === '--openai') opts.mode = 'openrouter'
    if (a === '--local') opts.mode = 'local'
    if (a === '--force') opts.force = true
    if (a === '--desatualizados') opts.soDesatualizados = true
    if (a === '--no-push') opts.noPush = true
    if (a === '--skip-git') opts.skipGit = true
    if (a.startsWith('--livro=')) opts.livro = a.slice('--livro='.length)
    if (a.startsWith('--limit=')) opts.limit = Number(a.slice('--limit='.length))
    if (a.startsWith('--concurrency='))
      opts.concurrency = Math.max(1, Number(a.slice('--concurrency='.length)))
    if (a.startsWith('--commit-every='))
      opts.commitEvery = Math.max(0, Number(a.slice('--commit-every='.length)))
  }
  return opts
}

function assembleCatalog(allRaw: RawPericope[]): Pericope[] {
  const catalog: Pericope[] = []
  for (const raw of allRaw) {
    const cached = readCached(raw.ordem)
    catalog.push(cached ? montarPericope(raw, cached) : merge(raw, localEnrich(raw)))
  }
  // Ordena por `seq` (posição de leitura), não por `ordem` (ID). Depois do
  // recorte existe ordem 3000 no meio de ordens 1000, e ordenar por ordem
  // jogaria as perícopes novas para o fim do catálogo.
  catalog.sort((a, b) => (a.seq ?? a.ordem) - (b.seq ?? b.ordem))
  writeFileSync(outPath, JSON.stringify(catalog))
  return catalog
}

function gitPublish(ordems: number[], push: boolean) {
  const a = Math.min(...ordems)
  const b = Math.max(...ordems)
  const msg = `enrich: ${ordems.length} perícopes via OpenRouter (${a}–${b})`
  runGit(['add', 'data/pericopes.json', 'data/cost-run.json'])
  const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root })
  if (staged.status === 0) {
    console.log('  etapa: git → nada a commitar')
    return
  }
  console.log('  etapa: git commit…')
  runGit(['commit', '-m', msg])
  if (push) {
    console.log('  etapa: git push…')
    runGit(['push', 'origin', 'main'])
  }
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let i = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (true) {
      const idx = i++
      if (idx >= items.length) return
      await fn(items[idx])
    }
  })
  await Promise.all(workers)
}

async function openRouterWithRetry(
  raw: RawPericope,
  onRateLimit: () => void,
): Promise<{ ai: AiPartial; usage: Usage }> {
  let last: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await openRouterEnrich(raw)
    } catch (e) {
      last = e
      const status = (e as { status?: number }).status
      if (status === 429) {
        onRateLimit()
        await sleep(2000 * (attempt + 1) ** 2)
        continue
      }
      if (attempt === 0) {
        console.warn(`  retry ordem ${raw.ordem}…`)
        await sleep(1000)
        continue
      }
    }
  }
  throw last
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  mkdirSync(enrichedDir, { recursive: true })
  mkdirSync(dirname(outPath), { recursive: true })

  const rawLines = readFileSync(rawPath, 'utf8').trim().split('\n')
  const allRaw = rawLines.map((l) => JSON.parse(l) as RawPericope)
  let candidates = allRaw.filter((r) => needsEnrich(r, opts.force, opts.soDesatualizados))
  if (opts.livro) candidates = candidates.filter((r) => r.livro === opts.livro)
  if (Number.isFinite(opts.limit)) candidates = candidates.slice(0, opts.limit)

  const AVG_COST_HINT = 0.0038088
  const AVG_SEC_HINT = 11
  let concurrency = opts.concurrency
  const estimatedCost = candidates.length * AVG_COST_HINT
  const estimatedSec = (candidates.length * AVG_SEC_HINT) / concurrency

  console.log('--- Estimativa ---')
  console.log(`pendentes: ${candidates.length} / catálogo ${allRaw.length}`)
  console.log(
    `modo: ${opts.mode} · concurrency: ${concurrency} · commit-every: ${opts.commitEvery || 'off'}`,
  )
  console.log(
    `custo ~$${estimatedCost.toFixed(2)} (~R$${(estimatedCost * 5.5).toFixed(2)} @5.5) · ETA ~${fmtDuration(estimatedSec)}`,
  )
  console.log('------------------\n')

  const state: { done: number[]; mode: string } = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8'))
    : { done: [], mode: opts.mode }

  const costLog: Array<{
    ordem: number
    titulo_en: string
    chars_texto: number
    usage: Usage
  }> = []

  let completed = 0
  let failedStreak = 0
  const runStarted = Date.now()
  const commitBatch: number[] = []

  const writeCostRun = () => {
    const n = costLog.length
    const totalCost = costLog.reduce((s, x) => s + x.usage.cost_usd, 0)
    const avg = n ? totalCost / n : AVG_COST_HINT
    const elapsed = (Date.now() - runStarted) / 1000
    const throughput = n ? n / elapsed : 0
    const remaining = candidates.length - completed
    writeFileSync(
      join(root, 'data/cost-run.json'),
      JSON.stringify(
        {
          model: process.env.OPENROUTER_MODEL || 'google/gemini-3.7-flash',
          concurrency,
          done: n,
          pending_total: candidates.length,
          sample_cost_usd: totalCost,
          avg_cost_usd: avg,
          estimate_remaining_usd: avg * remaining,
          estimate_full_run_usd: avg * candidates.length,
          elapsed_sec: elapsed,
          throughput_per_sec: throughput,
          eta_sec: throughput > 0 ? remaining / throughput : (remaining * AVG_SEC_HINT) / concurrency,
          catalog_total: allRaw.length,
          items: costLog,
        },
        null,
        2,
      ),
    )
  }

  const publishBatch = () => {
    if (opts.skipGit || opts.commitEvery <= 0 || commitBatch.length === 0) return
    console.log(`\n  etapa: catalog + git (lote ${commitBatch.length})`)
    assembleCatalog(allRaw)
    writeCostRun()
    gitPublish([...commitBatch], !opts.noPush)
    commitBatch.length = 0
    console.log('')
  }

  const chunkSize = opts.commitEvery > 0 ? opts.commitEvery : candidates.length || 1
  for (let offset = 0; offset < candidates.length; ) {
    const chunk = candidates.slice(offset, offset + chunkSize)
    offset += chunk.length

    await mapPool(chunk, concurrency, async (raw) => {
      const titleShort = raw.titulo_en.slice(0, 48)
      const t0 = Date.now()
      try {
        let ai: AiPartial
        let usage: Usage | null = null
        const label = () => `[${completed + 1}/${candidates.length}]`
        if (opts.mode === 'openrouter') {
          console.log(
            `${label()} ordem ${raw.ordem} · ${refLabel(raw)} · ${titleShort} · workers ${concurrency}`,
          )
          console.log(`  etapa: openrouter…`)
          const r = await openRouterWithRetry(raw, () => {
            if (concurrency > 1) {
              concurrency = Math.max(1, concurrency - 1)
              console.warn(`  rate limit → concurrency agora ${concurrency}`)
            }
          })
          ai = r.ai
          usage = r.usage
          costLog.push({
            ordem: raw.ordem,
            titulo_en: raw.titulo_en,
            chars_texto: raw.texto.length,
            usage: r.usage,
          })
        } else {
          console.log(`${label()} ordem ${raw.ordem} · ${refLabel(raw)} · local`)
          ai = localEnrich(raw)
        }

        const full = merge(raw, ai)
        writeFileSync(cachePath(raw.ordem), JSON.stringify(full, null, 2))
        state.done.push(raw.ordem)
        state.mode = opts.mode
        writeFileSync(statePath, JSON.stringify(state))

        completed++
        commitBatch.push(raw.ordem)
        failedStreak = 0

        const elapsedItem = (Date.now() - t0) / 1000
        const elapsedRun = (Date.now() - runStarted) / 1000
        const throughput = completed / elapsedRun
        const remaining = candidates.length - completed
        const eta = throughput > 0 ? remaining / throughput : (remaining * AVG_SEC_HINT) / concurrency
        const acum = costLog.reduce((s, x) => s + x.usage.cost_usd, 0)
        const avgCost = costLog.length ? acum / costLog.length : AVG_COST_HINT

        if (usage) {
          console.log(`  etapa: openrouter → ok`)
          console.log(
            `  custo $${usage.cost_usd.toFixed(4)} (acum $${acum.toFixed(2)}) · in ${usage.prompt_tokens} out ${usage.completion_tokens} · ${elapsedItem.toFixed(1)}s · throughput ${throughput.toFixed(2)}/s · ETA ${fmtDuration(eta)} · faltam ${remaining} · est. restante $${(avgCost * remaining).toFixed(2)}`,
          )
        } else {
          console.log(`  etapa: local → ok · faltam ${remaining}`)
        }
      } catch (e) {
        failedStreak++
        console.error(`  etapa: falhou ordem ${raw.ordem}`, e)
        if (failedStreak >= 8) throw new Error(`Abortando: ${failedStreak} falhas seguidas`)
      }
    })

    if (opts.commitEvery > 0 && !opts.skipGit) publishBatch()
  }

  const catalog = assembleCatalog(allRaw)
  writeCostRun()
  if (!opts.skipGit && opts.commitEvery > 0 && commitBatch.length) {
    console.log(`\n  etapa: catalog + git (lote final ${commitBatch.length})`)
    gitPublish(commitBatch, !opts.noPush)
  }

  if (costLog.length) {
    const totalCost = costLog.reduce((s, x) => s + x.usage.cost_usd, 0)
    const n = costLog.length
    const avg = totalCost / n
    const elapsed = (Date.now() - runStarted) / 1000
    console.log('\n--- Custo run ---')
    console.log(`n=${n}  total=$${totalCost.toFixed(6)}  média=$${avg.toFixed(6)}`)
    console.log(`tempo ${fmtDuration(elapsed)} · throughput ${(n / elapsed).toFixed(2)}/s`)
    console.log(`Relatório → data/cost-run.json`)
  }

  const stubsLeft = catalog.filter(isStub).length
  console.log(
    `OK: ${catalog.length} perícopes → ${outPath} (enriquecidos nesta run: ${completed}, stubs restantes: ${stubsLeft}, modo=${opts.mode})`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Add topicos_pregar to existing pericopes (one OpenRouter call each).
 *
 *   npm run preach:sample   — 5 items, Gemini only, no catalog write
 *   npm run preach:all      — fill missing fields, commit every 100
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pericope } from '../src/lib/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = join(root, 'data/pericopes.json')
const enrichedDir = join(root, 'data/enriched')
const sampleDir = join(root, 'data/preach-sample')

const DEFAULT_MODEL = 'google/gemini-3.7-flash'

const SYSTEM_PROMPT = `Você gera tópicos de pregação para uma perícope bíblica (versão Bíblia Livre, BLIVRE). Português brasileiro. Público: jovem/adolescente que já leu a Bíblia uma vez — inteligente, sem vocabulário grande.
Responda APENAS com JSON válido (sem markdown de cerca):
{
  "topicos_pregar": "..."
}

Densidade: cada frase traz um dado ou insight que o leitor comum não notaria sozinho. Prefira o concreto (estrutura do texto, detalhe cultural, nuance do hebraico/grego já traduzida) ao moral genérico. Sem trivia, sem academicês, sem “é interessante notar”. Se um termo incomum for necessário, use-o e explique na hora (ex.: “'ezer kenegdo (ajuda à altura, parceira do mesmo nível)”).

topicos_pregar — para o pregador ler rápido no púlpito:
- Duas seções, nesta ordem, com título numa linha e bullets de 1 linha:
  Linha de raciocínio
  Mensagens a levar
- 5–7 bullets na linha de raciocínio; 4–6 mensagens.
- Cada bullet: 1 observação específica DESTE trecho + 1 palavra-chave em **negrito**.
- Palavras-chave e termos importantes em **negrito** (markdown **assim**).
- Sem sermão escrito, sem introdução, sem citar o texto versículo a versículo.
- Não escreva briefing para outro agente. Só os tópicos.`

type PreachFields = { topicos_pregar: string }

type Usage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  generation_id?: string
}

function refLabel(p: Pericope) {
  if (p.capitulo_inicio === p.capitulo_fim && p.versiculo_inicio === p.versiculo_fim) {
    return `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}`
  }
  return `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}–${p.capitulo_fim}:${p.versiculo_fim}`
}

function hasPreach(p: Pericope) {
  return Boolean(p.topicos_pregar?.trim())
}

function parsePreachJson(text: string): PreachFields {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const obj = JSON.parse(cleaned) as Partial<PreachFields>
  if (!obj.topicos_pregar?.trim()) {
    throw new Error('JSON da IA incompleto')
  }
  return { topicos_pregar: obj.topicos_pregar.trim() }
}

function userPrompt(p: Pericope) {
  return `Título: ${p.titulo_pericope_pt}
Referência: ${refLabel(p)}
Resenha (já na app):
${p.resenha}

Texto bíblico:
${p.texto}`
}

async function openRouterPreach(
  p: Pericope,
  model: string,
): Promise<{ fields: PreachFields; usage: Usage; ms: number }> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY ausente')
  const t0 = Date.now()
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/local/biblia-pericopes',
      'X-Title': 'biblia-pericopes-preach',
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 1536,
      max_completion_tokens: 1536,
      reasoning: { max_tokens: 256, exclude: true },
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(p) },
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
    fields: parsePreachJson(data.choices[0].message.content),
    usage: {
      prompt_tokens: u.prompt_tokens ?? u.native_tokens_prompt ?? 0,
      completion_tokens: u.completion_tokens ?? u.native_tokens_completion ?? 0,
      total_tokens: u.total_tokens ?? 0,
      cost_usd: typeof u.cost === 'number' ? u.cost : 0,
      generation_id: data.id,
    },
    ms: Date.now() - t0,
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
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

async function withRetry(p: Pericope, model: string, on429: () => void) {
  let last: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await openRouterPreach(p, model)
    } catch (e) {
      last = e
      const status = (e as { status?: number }).status
      if (status === 402) throw e
      if (status === 429) {
        on429()
        await sleep(2000 * (attempt + 1) ** 2)
        continue
      }
      if (attempt === 0) {
        console.warn(`  retry ordem ${p.ordem}…`)
        await sleep(1000)
        continue
      }
    }
  }
  throw last
}

function runGit(args: string[]) {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (res.status !== 0) {
    const msg = (res.stderr || res.stdout || '').trim() || `git ${args.join(' ')} failed`
    throw new Error(msg)
  }
}

function parseArgs(argv: string[]) {
  const opts = {
    compare: false,
    force: false,
    limit: Infinity,
    concurrency: 5,
    commitEvery: 0,
    noPush: false,
    skipGit: false,
    offset: 0,
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
  }
  for (const a of argv) {
    if (a === '--compare') opts.compare = true
    if (a === '--force') opts.force = true
    if (a === '--no-push') opts.noPush = true
    if (a === '--skip-git') opts.skipGit = true
    if (a.startsWith('--limit=')) opts.limit = Number(a.slice('--limit='.length))
    if (a.startsWith('--offset=')) opts.offset = Math.max(0, Number(a.slice('--offset='.length)))
    if (a.startsWith('--concurrency='))
      opts.concurrency = Math.max(1, Number(a.slice('--concurrency='.length)))
    if (a.startsWith('--commit-every='))
      opts.commitEvery = Math.max(0, Number(a.slice('--commit-every='.length)))
    if (a.startsWith('--model=')) opts.model = a.slice('--model='.length)
  }
  return opts
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

function writeCatalog(list: Pericope[]) {
  writeFileSync(catalogPath, JSON.stringify(list))
}

function writeEnriched(p: Pericope) {
  mkdirSync(enrichedDir, { recursive: true })
  const f = join(enrichedDir, `${p.ordem}.json`)
  if (existsSync(f)) {
    const prev = JSON.parse(readFileSync(f, 'utf8')) as Pericope
    writeFileSync(f, JSON.stringify({ ...prev, ...p }, null, 2))
    return
  }
  writeFileSync(f, JSON.stringify(p, null, 2))
}

function gitPublish(ordems: number[], push: boolean) {
  const a = Math.min(...ordems)
  const b = Math.max(...ordems)
  const msg = `preach: ${ordems.length} perícopes (${a}–${b})`
  runGit(['add', 'data/pericopes.json'])
  const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root })
  if (staged.status === 0) {
    console.log('  etapa: git → nada a commitar')
    return
  }
  runGit(['commit', '-m', msg])
  if (push) runGit(['push', 'origin', 'HEAD'])
}

type SampleRow = {
  ordem: number
  ref: string
  titulo: string
  model: string
  ms: number
  usage: Usage
  fields: PreachFields
}

async function runCompare(list: Pericope[], limit: number, model: string, offset: number) {
  const n = Number.isFinite(limit) ? limit : 5
  const sample = list.slice(offset, offset + n)
  mkdirSync(sampleDir, { recursive: true })
  const rows: SampleRow[] = []
  const models = [model]
  const slug = model.replaceAll('/', '_')
  mkdirSync(join(sampleDir, slug), { recursive: true })
  console.log(`\n=== ${model} (${sample.length}) ===`)
  for (const p of sample) {
    console.log(`ordem ${p.ordem} · ${refLabel(p)} · ${p.titulo_pericope_pt}`)
    const r = await withRetry(p, model, () => console.warn('  429'))
    rows.push({
      ordem: p.ordem,
      ref: refLabel(p),
      titulo: p.titulo_pericope_pt,
      model,
      ms: r.ms,
      usage: r.usage,
      fields: r.fields,
    })
    writeFileSync(
      join(sampleDir, slug, `${p.ordem}.json`),
      JSON.stringify({ ...r.fields, usage: r.usage, ms: r.ms }, null, 2),
    )
    console.log(
      `  $${r.usage.cost_usd.toFixed(4)} · in ${r.usage.prompt_tokens} out ${r.usage.completion_tokens} · ${(r.ms / 1000).toFixed(1)}s`,
    )
  }

  const items = rows.filter((x) => x.model === model)
  const cost = items.reduce((s, x) => s + x.usage.cost_usd, 0)
  const avg = items.length ? cost / items.length : 0
  const avgMs = items.length ? items.reduce((s, x) => s + x.ms, 0) / items.length : 0
  const byModel = [{ model, n: items.length, cost, avg, avgMs, est2647: avg * 2647 }]

  const md = [
    '# Amostra: só tópicos',
    '',
    `Modelo: \`${model}\`. Offset ${offset}. Catálogo **não** foi alterado.`,
    '',
    '| Modelo | n | Custo amostra | Média/item | Est. 2647 | Tempo médio |',
    '|---|---:|---:|---:|---:|---:|',
    ...byModel.map(
      (m) =>
        `| \`${m.model}\` | ${m.n} | $${m.cost.toFixed(4)} | $${m.avg.toFixed(4)} | $${m.est2647.toFixed(2)} | ${(m.avgMs / 1000).toFixed(1)}s |`,
    ),
    '',
    ...sample.flatMap((p) => {
      const row = rows.find((r) => r.ordem === p.ordem)
      return [
        `## ${p.ordem} · ${refLabel(p)} · ${p.titulo_pericope_pt}`,
        '',
        row?.fields.topicos_pregar ?? '(falhou)',
        '',
      ]
    }),
  ].join('\n')

  writeFileSync(join(sampleDir, 'COMPARE.md'), md)
  writeFileSync(join(sampleDir, 'summary.json'), JSON.stringify({ byModel, rows }, null, 2))
  console.log(`\nRelatório → ${join(sampleDir, 'COMPARE.md')}`)
  for (const m of byModel) {
    console.log(
      `${m.model}: $${m.cost.toFixed(4)} amostra · média $${m.avg.toFixed(4)} · est. lote $${m.est2647.toFixed(2)}`,
    )
  }
}

async function runFill(list: Pericope[], opts: ReturnType<typeof parseArgs>) {
  let candidates = opts.force ? list : list.filter((p) => !hasPreach(p))
  if (Number.isFinite(opts.limit)) candidates = candidates.slice(0, opts.limit)

  let concurrency = opts.concurrency
  const AVG_COST = 0.003
  const AVG_SEC = 10
  console.log('--- Estimativa ---')
  console.log(`pendentes: ${candidates.length} / ${list.length}`)
  console.log(`modelo: ${opts.model} · concurrency ${concurrency}`)
  console.log(
    `custo ~$${(candidates.length * AVG_COST).toFixed(2)} · ETA ~${fmtDuration((candidates.length * AVG_SEC) / concurrency)}`,
  )
  console.log('------------------\n')

  const byOrdem = new Map(list.map((p) => [p.ordem, p]))
  let completed = 0
  let failedStreak = 0
  const runStarted = Date.now()
  const commitBatch: number[] = []
  const costLog: { ordem: number; usage: Usage }[] = []

  const persist = () => {
    // Mesma ordenação do enrich-pericopes: este script REGRAVA o catálogo, e
    // ordenar por `ordem` aqui desfaria a ordem de leitura sem erro nenhum.
    writeCatalog([...byOrdem.values()].sort((a, b) => (a.seq ?? a.ordem) - (b.seq ?? b.ordem)))
  }

  const publish = () => {
    if (opts.skipGit || opts.commitEvery <= 0 || commitBatch.length === 0) return
    persist()
    gitPublish([...commitBatch], !opts.noPush)
    commitBatch.length = 0
  }

  const chunkSize = opts.commitEvery > 0 ? opts.commitEvery : candidates.length || 1
  for (let offset = 0; offset < candidates.length; ) {
    const chunk = candidates.slice(offset, offset + chunkSize)
    offset += chunk.length
    await mapPool(chunk, concurrency, async (p) => {
      const t0 = Date.now()
      try {
        console.log(`[${completed + 1}/${candidates.length}] ordem ${p.ordem} · ${refLabel(p)}`)
        const r = await withRetry(p, opts.model, () => {
          if (concurrency > 1) {
            concurrency = Math.max(1, concurrency - 1)
            console.warn(`  rate limit → concurrency ${concurrency}`)
          }
        })
        const next = { ...p, ...r.fields }
        byOrdem.set(p.ordem, next)
        writeEnriched(next)
        costLog.push({ ordem: p.ordem, usage: r.usage })
        completed++
        commitBatch.push(p.ordem)
        failedStreak = 0
        const elapsed = (Date.now() - runStarted) / 1000
        const throughput = completed / elapsed
        const remaining = candidates.length - completed
        const acum = costLog.reduce((s, x) => s + x.usage.cost_usd, 0)
        console.log(
          `  $${r.usage.cost_usd.toFixed(4)} (acum $${acum.toFixed(2)}) · ${( (Date.now() - t0) / 1000).toFixed(1)}s · ETA ${fmtDuration(throughput > 0 ? remaining / throughput : remaining * AVG_SEC)} · faltam ${remaining}`,
        )
      } catch (e) {
        failedStreak++
        console.error(`  falhou ordem ${p.ordem}`, e)
        if (failedStreak >= 8) throw new Error(`Abortando: ${failedStreak} falhas seguidas`)
      }
    })
    if (opts.commitEvery > 0 && !opts.skipGit) publish()
  }

  persist()
  if (!opts.skipGit && opts.commitEvery > 0 && commitBatch.length) {
    gitPublish(commitBatch, !opts.noPush)
  }
  const total = costLog.reduce((s, x) => s + x.usage.cost_usd, 0)
  console.log(`\nOK: ${completed} preenchidos · $${total.toFixed(4)} · ${catalogPath}`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const list = JSON.parse(readFileSync(catalogPath, 'utf8')) as Pericope[]
  if (opts.compare) {
    await runCompare(
      list,
      Number.isFinite(opts.limit) ? opts.limit : 5,
      opts.model,
      opts.offset,
    )
    return
  }
  await runFill(list, opts)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * Fila em disco da reescrita dos títulos.
 *
 * Por que uma fila e não um mutirão solto: são 1.262 títulos, e a lição da
 * corrida anterior foi que trabalho sem trava e sem gravação cedo se perde
 * inteiro quando a sessão bate no limite. Aqui vale a mesma regra — cada
 * subagente grava o lote dele assim que termina, e quem já foi feito não é
 * refeito.
 *
 * O título final NÃO mora aqui: ele volta para
 * `data/reenriquecimento/saida/<ordem>.json`, que é a fonte de verdade do
 * material editorial. Esta fila é andaime.
 *
 * Uso:
 *   npx tsx scripts/titulos-fila.ts preparar
 *   npx tsx scripts/titulos-fila.ts lote <n>     # monta um lote de n perícopes
 *   npx tsx scripts/titulos-fila.ts status
 *   npx tsx scripts/titulos-fila.ts aplicar      # confere e grava no material
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ancorar } from './titulos-ancorados.ts'
import { colisoes } from './titulos-colididos.ts'

const root = join(import.meta.dirname, '..')
const base = join(root, 'data/titulos')
const dEntrada = join(base, 'entrada')
const dSaida = join(base, 'saida')
const dLotes = join(base, 'lotes')
const materialDir = join(root, 'data/reenriquecimento/saida')

export type Pericope = {
  ordem: number
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
  titulo_pericope_pt: string
  texto: string
}

export const referencia = (p: Pericope) =>
  `${p.abbrev} ${p.capitulo_inicio}:${p.versiculo_inicio}-${p.capitulo_fim}:${p.versiculo_fim}`

function catalogo(): Pericope[] {
  return JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Pericope[]
}

/**
 * Quem entra na fila: título sem âncora, mais os dois lados de cada colisão
 * forte. Reescrevem-se OS DOIS porque daqui não dá para saber qual dos dois é
 * o vago — muitas vezes são os dois.
 */
export function alvos(pericopes: Pericope[], forcaMinima = 0.6): number[] {
  const alvo = new Set<number>()
  for (const p of pericopes) {
    if (!ancorar(p.titulo_pericope_pt, p.texto).ancorado) alvo.add(p.ordem)
  }
  const pares = colisoes(
    pericopes.map((p) => ({ ordem: p.ordem, titulo: p.titulo_pericope_pt })) as never,
  ) as unknown as { a: { ordem: number }; b: { ordem: number }; forca: number }[]
  for (const c of pares) {
    if (c.forca >= forcaMinima) {
      alvo.add(c.a.ordem)
      alvo.add(c.b.ordem)
    }
  }
  return [...alvo].sort((a, b) => a - b)
}

const ordens = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => Number(f.slice(0, -5)))
    : []

function preparar() {
  for (const d of [base, dEntrada, dSaida, dLotes]) mkdirSync(d, { recursive: true })
  const pericopes = catalogo()
  const porOrdem = new Map(pericopes.map((p) => [p.ordem, p]))
  const lista = alvos(pericopes)
  for (const o of lista) {
    const p = porOrdem.get(o)!
    writeFileSync(
      join(dEntrada, `${o}.json`),
      JSON.stringify(
        {
          ordem: o,
          livro: p.livro,
          referencia: referencia(p),
          titulo_atual: p.titulo_pericope_pt,
          texto: p.texto,
        },
        null,
        2,
      ),
    )
  }
  console.log(`${lista.length} títulos na fila em ${dEntrada}`)
}

function status() {
  const total = ordens(dEntrada).length
  const feitas = new Set(ordens(dSaida))
  console.log(
    `fila ${total} · prontos ${feitas.size} (${((100 * feitas.size) / Math.max(1, total)).toFixed(1)}%) · faltam ${total - feitas.size}`,
  )
}

function lote(n: number) {
  const feitas = new Set(ordens(dSaida))
  const emLote = new Set<number>()
  for (const f of readdirSync(dLotes).filter((x) => x.endsWith('.json'))) {
    for (const e of JSON.parse(readFileSync(join(dLotes, f), 'utf8')).entradas) emLote.add(e.ordem)
  }
  const pendentes = ordens(dEntrada)
    .filter((o) => !feitas.has(o) && !emLote.has(o))
    .sort((a, b) => a - b)
  if (!pendentes.length) return console.log('nada pendente')
  const escolhidas = pendentes.slice(0, n)
  const id = `t${Date.now().toString(36)}`
  const entradas = escolhidas.map((o) =>
    JSON.parse(readFileSync(join(dEntrada, `${o}.json`), 'utf8')),
  )
  const arquivo = join(dLotes, `${id}.json`)
  writeFileSync(arquivo, JSON.stringify({ id, entradas }, null, 2))
  console.log(`${arquivo}\n${escolhidas.length} perícopes: ${escolhidas[0]}…${escolhidas.at(-1)}`)
}

/** Confere âncora e colisão, e só então grava no material editorial. */
function aplicar() {
  const pericopes = catalogo()
  const porOrdem = new Map(pericopes.map((p) => [p.ordem, p]))
  const novos = new Map<number, string>()
  for (const o of ordens(dSaida)) {
    const { titulo_pericope_pt } = JSON.parse(readFileSync(join(dSaida, `${o}.json`), 'utf8'))
    novos.set(o, titulo_pericope_pt)
  }

  const problemas: string[] = []
  for (const [o, t] of novos) {
    const p = porOrdem.get(o)
    if (!p) {
      problemas.push(`${o}: não existe no catálogo`)
      continue
    }
    if (!t?.trim()) problemas.push(`${o}: título vazio`)
    else if (!ancorar(t, p.texto).ancorado) problemas.push(`${o} (${referencia(p)}): sem âncora — "${t}"`)
  }

  // A colisão precisa ser conferida contra o catálogo INTEIRO já com os novos
  // aplicados, senão troca-se uma repetição por outra.
  const depois = pericopes.map((p) => ({
    ordem: p.ordem,
    titulo: novos.get(p.ordem) ?? p.titulo_pericope_pt,
  }))
  const pares = colisoes(depois as never) as unknown as {
    a: { ordem: number; titulo: string }
    b: { ordem: number; titulo: string }
    forca: number
  }[]
  // Pendente = está na fila e ainda não voltou. Colidir com um título que ainda
  // VAI ser reescrito não é problema — é a fila no meio do caminho. Sem esta
  // guarda, o primeiro lote a chegar não aplicava nada, porque batia nos
  // títulos velhos que ele mesmo tinha vindo substituir.
  const pendentes = new Set(ordens(dEntrada).filter((o) => !novos.has(o)))
  const emColisao = new Set<number>()
  for (const c of pares) {
    const tocaNovo = novos.has(c.a.ordem) || novos.has(c.b.ordem)
    const esperaFila = pendentes.has(c.a.ordem) || pendentes.has(c.b.ordem)
    if (c.forca >= 0.85 && tocaNovo && !esperaFila) {
      problemas.push(`${c.a.ordem}×${c.b.ordem}: colidem — "${c.a.titulo}" / "${c.b.titulo}"`)
      emColisao.add(c.a.ordem)
      emColisao.add(c.b.ordem)
    }
  }

  // Sem âncora é motivo para não gravar NADA: é sinal de que o lote inteiro veio
  // errado. Colisão não — ela é local, e travar as outras mil por causa de um
  // par empurra o trabalho todo para o fim da fila. Pula-se o par e segue.
  const semAncora = problemas.filter((x) => x.includes('sem âncora') || x.includes('vazio'))
  if (semAncora.length) {
    console.log(`❌ ${semAncora.length} problema(s) de âncora; nada gravado:`)
    for (const x of semAncora.slice(0, 40)) console.log(`  ${x}`)
    process.exitCode = 1
    return
  }
  if (emColisao.size) {
    console.log(`⚠️  ${problemas.length} par(es) em colisão — pulados, o resto vai:`)
    for (const x of problemas.slice(0, 20)) console.log(`  ${x}`)
  }

  let n = 0
  for (const [o, t] of novos) {
    if (emColisao.has(o)) continue
    const arq = join(materialDir, `${o}.json`)
    const m = JSON.parse(readFileSync(arq, 'utf8'))
    if (m.titulo_pericope_pt === t) continue
    m.titulo_pericope_pt = t
    writeFileSync(arq, JSON.stringify(m, null, 2))
    n++
  }
  console.log(`✅ ${n} títulos gravados em ${materialDir} (rode reenrich:aplicar depois)`)
}

if (process.argv[1]?.endsWith('titulos-fila.ts')) {
  const cmd = process.argv[2]
  if (cmd === 'preparar') preparar()
  else if (cmd === 'status') status()
  else if (cmd === 'lote') lote(Number(process.argv[3] ?? 60))
  else if (cmd === 'aplicar') aplicar()
  else console.log('uso: titulos-fila.ts preparar|lote <n>|status|aplicar')
}

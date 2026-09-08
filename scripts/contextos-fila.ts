/**
 * Fila em disco da reescrita dos contextos.
 *
 * Terceira fila com a mesma forma (entrada/saida/lotes, um arquivo por
 * perícope, gravar cedo) depois de `titulos-fila` e `registro-fila`. A repetição
 * é consciente: generalizar as três enquanto agentes escrevem nelas trocaria
 * risco por elegância. Se aparecer uma quarta, aí sim vale a extração.
 *
 * O contexto reescrito volta para `data/reenriquecimento/saida/<ordem>.json`,
 * que segue sendo a fonte de verdade do material.
 *
 * Uso:
 *   npx tsx scripts/contextos-fila.ts preparar | lote <n> | status | aplicar
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { diagnosticar } from './contextos-duros.ts'

const root = join(import.meta.dirname, '..')
const base = join(root, 'data/contextos')
const dEntrada = join(base, 'entrada')
const dSaida = join(base, 'saida')
const dLotes = join(base, 'lotes')
const materialDir = join(root, 'data/reenriquecimento/saida')
const entradaDir = join(root, 'data/reenriquecimento/entrada')

type P = {
  ordem: number
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
  contexto_historico_literario: string
  texto: string
}

const ordens = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => Number(f.slice(0, -5)))
    : []

const catalogo = (): P[] =>
  JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as P[]

function preparar() {
  for (const d of [base, dEntrada, dSaida, dLotes]) mkdirSync(d, { recursive: true })
  let n = 0
  for (const p of catalogo()) {
    if (diagnosticar(p.contexto_historico_literario).duro) continue
    const e = JSON.parse(readFileSync(join(entradaDir, `${p.ordem}.json`), 'utf8'))
    writeFileSync(
      join(dEntrada, `${p.ordem}.json`),
      JSON.stringify(
        {
          ordem: p.ordem,
          livro: p.livro,
          referencia: `${p.abbrev} ${p.capitulo_inicio}:${p.versiculo_inicio}-${p.capitulo_fim}:${p.versiculo_fim}`,
          contexto_atual: p.contexto_historico_literario,
          diagnostico: diagnosticar(p.contexto_historico_literario),
          texto: e.texto,
          ...(e.sobrescrito ? { sobrescrito: e.sobrescrito } : {}),
        },
        null,
        2,
      ),
    )
    n++
  }
  console.log(`${n} contextos na fila em ${dEntrada}`)
}

function status() {
  const total = ordens(dEntrada).length
  const feitas = new Set(ordens(dSaida))
  console.log(`fila ${total} · prontos ${feitas.size} · faltam ${total - feitas.size}`)
}

function lote(n: number) {
  const feitas = new Set(ordens(dSaida))
  const emLote = new Set<number>()
  for (const f of readdirSync(dLotes).filter((x) => x.endsWith('.json'))) {
    for (const e of JSON.parse(readFileSync(join(dLotes, f), 'utf8')).entradas) emLote.add(e.ordem)
  }
  const pendentes = ordens(dEntrada).filter((o) => !feitas.has(o) && !emLote.has(o)).sort((a, b) => a - b)
  if (!pendentes.length) return console.log('nada pendente')
  const escolhidas = pendentes.slice(0, n)
  const id = `c${Date.now().toString(36)}`
  const arquivo = join(dLotes, `${id}.json`)
  writeFileSync(
    arquivo,
    JSON.stringify(
      { id, entradas: escolhidas.map((o) => JSON.parse(readFileSync(join(dEntrada, `${o}.json`), 'utf8'))) },
      null,
      2,
    ),
  )
  console.log(`${arquivo}\n${escolhidas.length} perícopes`)
}

/** Grava só o que passou a dar dado duro, e nunca o que encolheu. */
function aplicar() {
  const problemas: string[] = []
  let n = 0
  for (const o of ordens(dSaida)) {
    const { contexto_historico_literario: novo } = JSON.parse(
      readFileSync(join(dSaida, `${o}.json`), 'utf8'),
    ) as { contexto_historico_literario: string }
    const arq = join(materialDir, `${o}.json`)
    const m = JSON.parse(readFileSync(arq, 'utf8'))
    const velho: string = m.contexto_historico_literario
    if (!novo?.trim()) {
      problemas.push(`${o}: vazio`)
      continue
    }
    if (!diagnosticar(novo).duro) {
      problemas.push(`${o}: continua sem dado duro ou fecha apontando`)
      continue
    }
    // O campo tem piso de 200 caracteres no portão, e a reescrita costuma
    // ENCHER e não encolher — quem encolhe provavelmente cortou em vez de trocar.
    if (novo.length < Math.min(velho.length, 200)) {
      problemas.push(`${o}: encolheu de ${velho.length} para ${novo.length}`)
      continue
    }
    m.contexto_historico_literario = novo
    writeFileSync(arq, JSON.stringify(m, null, 2))
    n++
  }
  if (problemas.length) {
    console.log(`⚠️  ${problemas.length} recusado(s):`)
    for (const x of problemas.slice(0, 30)) console.log(`  ${x}`)
  }
  console.log(`✅ ${n} contextos gravados (rode validar-material e reenrich:aplicar depois)`)
}

if (process.argv[1]?.endsWith('contextos-fila.ts')) {
  const cmd = process.argv[2]
  if (cmd === 'preparar') preparar()
  else if (cmd === 'status') status()
  else if (cmd === 'lote') lote(Number(process.argv[3] ?? 40))
  else if (cmd === 'aplicar') aplicar()
  else console.log('uso: contextos-fila.ts preparar|lote <n>|status|aplicar')
}

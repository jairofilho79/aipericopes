/**
 * Fila em disco do conserto de registro.
 *
 * A varredura (`varrer-registro.ts`) acha 217 suspeitas em 193 perícopes:
 * "a gente" no lugar de "nós" (118), coloquialismo, humor onde não cabe,
 * metáfora de marketing. O portão de qualidade não alcança nada disso — é
 * julgamento de tom, não regra contável.
 *
 * A escolha de desenho é **cirurgia, e não reescrita**. O material dessas 193
 * já passou pelo portão e está bom no resto; mandar reescrever a perícope
 * inteira por causa de um "a gente" jogaria fora trabalho aprovado e traria de
 * volta o risco de citação quebrada. A fila entrega o campo inteiro (para dar
 * contexto) e cobra de volta o campo inteiro com o trecho consertado.
 *
 * Uso:
 *   npx tsx scripts/registro-fila.ts preparar
 *   npx tsx scripts/registro-fila.ts lote <n>
 *   npx tsx scripts/registro-fila.ts status
 *   npx tsx scripts/registro-fila.ts aplicar
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { varrer, type Suspeita } from './varrer-registro.ts'

const root = join(import.meta.dirname, '..')
const base = join(root, 'data/registro')
const dEntrada = join(base, 'entrada')
const dSaida = join(base, 'saida')
const dLotes = join(base, 'lotes')
const materialDir = join(root, 'data/reenriquecimento/saida')
const entradaDir = join(root, 'data/reenriquecimento/entrada')

const ordens = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => Number(f.slice(0, -5)))
    : []

function materialDe(ordem: number) {
  return JSON.parse(readFileSync(join(materialDir, `${ordem}.json`), 'utf8')) as Record<
    string,
    unknown
  >
}

/** Suspeitas por perícope, lidas do material que está em disco. */
export function suspeitas(): Map<number, Suspeita[]> {
  const por = new Map<number, Suspeita[]>()
  for (const o of ordens(materialDir)) {
    const achados = varrer(materialDe(o))
    if (achados.length) por.set(o, achados)
  }
  return por
}

function preparar() {
  for (const d of [base, dEntrada, dSaida, dLotes]) mkdirSync(d, { recursive: true })
  const por = suspeitas()
  for (const [o, achados] of por) {
    const m = materialDe(o)
    const e = JSON.parse(readFileSync(join(entradaDir, `${o}.json`), 'utf8'))
    // Só os campos acusados vão na entrada. Mandar os cinco convidaria a
    // reescrever o que está bom.
    const campos = [...new Set(achados.map((a) => a.campo))]
    writeFileSync(
      join(dEntrada, `${o}.json`),
      JSON.stringify(
        {
          ordem: o,
          livro: e.livro,
          referencia: e.referencia ?? '',
          achados: achados.map((a) => ({ campo: a.campo, motivo: a.motivo, trecho: a.trecho })),
          campos: Object.fromEntries(campos.map((c) => [c, m[c]])),
        },
        null,
        2,
      ),
    )
  }
  console.log(`${por.size} perícopes na fila em ${dEntrada}`)
}

function status() {
  const total = ordens(dEntrada).length
  const feitas = new Set(ordens(dSaida))
  console.log(
    `fila ${total} · prontos ${feitas.size} · faltam ${total - feitas.size} · suspeitas vivas ${[...suspeitas().values()].flat().length}`,
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
  const id = `r${Date.now().toString(36)}`
  const arquivo = join(dLotes, `${id}.json`)
  writeFileSync(
    arquivo,
    JSON.stringify(
      {
        id,
        entradas: escolhidas.map((o) =>
          JSON.parse(readFileSync(join(dEntrada, `${o}.json`), 'utf8')),
        ),
      },
      null,
      2,
    ),
  )
  console.log(`${arquivo}\n${escolhidas.length} perícopes`)
}

/**
 * Grava no material, campo a campo — e recusa o que não melhorou.
 *
 * O guarda que importa: o campo devolvido não pode trazer MAIS suspeitas do que
 * o original. Sem ele, um subagente que troque um "a gente" por outro passaria.
 */
function aplicar() {
  const problemas: string[] = []
  let n = 0
  for (const o of ordens(dSaida)) {
    const devolvido = JSON.parse(readFileSync(join(dSaida, `${o}.json`), 'utf8')) as {
      campos: Record<string, string | string[]>
    }
    const m = materialDe(o)
    const antes = varrer(m).length
    const proposto = { ...m, ...devolvido.campos }
    const depois = varrer(proposto).length
    if (depois >= antes && antes > 0) {
      problemas.push(`${o}: ${antes} suspeita(s) antes, ${depois} depois — não melhorou`)
      continue
    }
    for (const [campo, valor] of Object.entries(devolvido.campos)) {
      // `perguntas_reflexao` é ARRAY no material, não string. A primeira versão
      // deste guarda recusava array como "campo vazio" e pulava a perícope em
      // silêncio — seis das sete afetadas não gravariam nada. Achado por um
      // subagente antes de eu rodar o aplicar.
      const vazio =
        typeof valor === 'string'
          ? !valor.trim()
          : !Array.isArray(valor) || valor.length === 0
      if (vazio) {
        problemas.push(`${o}: campo ${campo} vazio`)
        continue
      }
      m[campo] = valor
    }
    writeFileSync(join(materialDir, `${o}.json`), JSON.stringify(m, null, 2))
    n++
  }
  if (problemas.length) {
    console.log(`⚠️  ${problemas.length} recusada(s):`)
    for (const x of problemas.slice(0, 30)) console.log(`  ${x}`)
  }
  console.log(`✅ ${n} perícopes gravadas (rode validar-material e reenrich:aplicar depois)`)
}

if (process.argv[1]?.endsWith('registro-fila.ts')) {
  const cmd = process.argv[2]
  if (cmd === 'preparar') preparar()
  else if (cmd === 'status') status()
  else if (cmd === 'lote') lote(Number(process.argv[3] ?? 50))
  else if (cmd === 'aplicar') aplicar()
  else console.log('uso: registro-fila.ts preparar|lote <n>|status|aplicar')
}

/**
 * Procura na Bíblia inteira e devolve versículo com referência — é assim que a
 * âncora se confere sem carregar 31.102 versículos na conversa.
 *
 * No piloto cada leitor escreveu a sua própria versão disto, e a busca foi a
 * maior parte do custo. Uma vez escrita, sai do preço de todo mundo.
 *
 * uso: node .claude/skills/leitor-cetico/scripts/buscar.mjs "<regex>" [limite]
 *      node .claude/skills/leitor-cetico/scripts/buscar.mjs --ref "Gn 14:2"
 */
import { readFileSync } from 'node:fs'

const arr = JSON.parse(readFileSync('data/pericopes.json', 'utf8'))

/** Quebra o texto da perícope em versículos com capítulo — as que atravessam capítulo reiniciam a numeração. */
function* versos(p) {
  let cap = p.capitulo_inicio
  for (const linha of p.texto.split('\n')) {
    const capitulo = linha.match(/^Cap[íi]tulo (\d+)/)
    if (capitulo) {
      cap = Number(capitulo[1])
      continue
    }
    const m = linha.match(/^(\d+) (.+)$/)
    if (m) yield { livro: p.livro, abbrev: p.abbrev, cap, num: Number(m[1]), texto: m[2] }
  }
}

if (process.argv[2] === '--ref') {
  const [ab, cv] = process.argv[3].split(/\s+/)
  const [c, v] = cv.split(':').map(Number)
  for (const p of arr) {
    if (p.abbrev !== ab) continue
    for (const x of versos(p)) if (x.cap === c && x.num === v) console.log(`${ab} ${c}:${v} — ${x.texto}`)
  }
} else {
  const re = new RegExp(process.argv[2], 'iu')
  const limite = Number(process.argv[3] ?? 25)
  let n = 0
  for (const p of arr) {
    for (const x of versos(p)) {
      if (!re.test(x.texto)) continue
      console.log(`${x.abbrev} ${x.cap}:${x.num} — ${x.texto}`)
      if (++n >= limite) {
        console.log(`… (parei em ${limite}; refine a busca)`)
        process.exit(0)
      }
    }
  }
  if (!n) console.log('nada encontrado')
}

/**
 * Extrai as citações que não batem com o texto bíblico, agrupadas por perícope,
 * num formato pronto para a passada de correção.
 *
 * Existe porque a correção é cirúrgica: o material está bom, só as aspas é que
 * derivaram. Reprocessar a perícope inteira gastaria mais e arriscaria perder
 * material que já passou. Cada entrada traz a citação, o campo onde ela está e
 * a linha do texto bíblico mais parecida — que é quase sempre a forma correta.
 *
 * Usage: npx tsx scripts/listar-citacoes-suspeitas.ts <dir-entrada> <dir-saida> <arquivo-saida.json>
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CAMPOS = ['contexto_historico_literario', 'resenha', 'topicos_pregar'] as const

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function citacoes(texto: string): string[] {
  const partes = texto.replace(/[“”]/g, '"').split('"')
  return partes
    .filter((_, i) => i % 2 === 1)
    .map((c) => c.trim())
    .filter((c) => c.split(/\s+/).length >= 4 && c.length <= 200)
    .filter((c) => !c.includes('…') && !c.includes('...'))
}

/** Linha do texto bíblico com mais palavras em comum — quase sempre a origem. */
function linhaMaisParecida(citacao: string, texto: string): string | null {
  const alvo = new Set(normalizar(citacao).split(' ').filter((w) => w.length >= 4))
  if (alvo.size === 0) return null
  let melhor: { linha: string; n: number } | null = null
  for (const linha of texto.split('\n')) {
    if (/^Capítulo \d+$/.test(linha)) continue
    const n = normalizar(linha)
      .split(' ')
      .filter((w) => alvo.has(w)).length
    if (!melhor || n > melhor.n) melhor = { linha, n }
  }
  return melhor && melhor.n >= 2 ? melhor.linha : null
}

function main() {
  const [dirEntrada, dirSaida, out] = process.argv.slice(2)
  if (!dirEntrada || !dirSaida || !out) {
    console.error('uso: listar-citacoes-suspeitas.ts <dir-entrada> <dir-saida> <saida.json>')
    process.exit(2)
  }

  const lista: {
    ordem: number
    livro: string
    ref: string
    itens: { campo: string; citacao: string; linhaProvavel: string | null }[]
  }[] = []

  for (const f of readdirSync(dirEntrada).filter((x) => x.endsWith('.json'))) {
    const ordem = Number(f.replace('.json', ''))
    const saidaF = join(dirSaida, f)
    if (!existsSync(saidaF)) continue
    const e = JSON.parse(readFileSync(join(dirEntrada, f), 'utf8'))
    const m = JSON.parse(readFileSync(saidaF, 'utf8'))
    const alvo = normalizar(e.texto)

    const itens: { campo: string; citacao: string; linhaProvavel: string | null }[] = []
    for (const campo of CAMPOS) {
      for (const c of citacoes(m[campo] ?? '')) {
        if (alvo.includes(normalizar(c))) continue
        itens.push({ campo, citacao: c, linhaProvavel: linhaMaisParecida(c, e.texto) })
      }
    }
    if (itens.length) {
      lista.push({
        ordem,
        livro: e.livro,
        ref: `${e.capitulo_inicio}:${e.versiculo_inicio}-${e.capitulo_fim}:${e.versiculo_fim}`,
        itens,
      })
    }
  }

  lista.sort((a, b) => a.ordem - b.ordem)
  writeFileSync(out, JSON.stringify(lista, null, 2))
  const total = lista.reduce((s, x) => s + x.itens.length, 0)
  const semOrigem = lista.reduce(
    (s, x) => s + x.itens.filter((i) => i.linhaProvavel === null).length,
    0,
  )
  console.log(`${lista.length} perícopes com ${total} citação(ões) a conferir → ${out}`)
  console.log(`  ${total - semOrigem} têm linha provável no texto (candidatas a citação derivada)`)
  console.log(`  ${semOrigem} sem linha parecida (provável glosa ou citação de outro livro)`)
}

main()

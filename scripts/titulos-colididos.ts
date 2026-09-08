/**
 * Acha títulos parecidos demais entre perícopes diferentes.
 *
 * **Por que isto não pode ser um portão por perícope.** Cada subagent escreve
 * o seu lote sem ver os outros, então nenhum deles tem como saber que outro
 * chamou o trecho dele de "O pacto que Deus fez sozinho". A colisão só existe
 * no catálogo, e só pode ser vista depois que os 2.823 títulos existem.
 *
 * E nem toda colisão é erro de escrita: Gn 21 e Gn 26 são a MESMA cena em
 * Berseba, uma com Abraão e outra com Isaque — os títulos saíram parecidos
 * porque as passagens são parecidas. O que não pode é o leitor abrir o índice
 * e ver duas linhas quase iguais sem saber qual é qual. Por isso a saída aqui
 * é uma lista para decidir, não um conserto automático.
 *
 * Usage: npx tsx scripts/titulos-colididos.ts [--dir=data/enriched] [--minimo=2]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type Titulo = { ordem: number; titulo: string; ref?: string }
export type Colisao = {
  a: Titulo
  b: Titulo
  comuns: string[]
  identicos: boolean
  /**
   * Quanto do título MENOR é dividido com o outro. Contagem crua engana: dois
   * títulos de seis palavras que dividem duas são parecidos de longe; dois de
   * três palavras que dividem duas são quase o mesmo título.
   */
  forca: number
}

/**
 * Palavras que qualquer título divide sem significar nada. Sem esta lista,
 * "A casa de Deus" e "A palavra de Deus" colidiriam por "deus"... e por "de".
 */
const VAZIAS = new Set([
  // conjunções e advérbios
  'que', 'como', 'mais', 'quem', 'onde', 'quando', 'depois', 'antes', 'ainda',
  'também', 'tambem', 'ate', 'até', 'entre', 'sobre', 'contra', 'assim',
  // preposições e contrações — contar "para" como conteúdo fazia "Sete dias
  // para fazer" e "Sete dias depois que para" dividirem uma palavra falsa
  'com', 'para', 'por', 'pelo', 'pela', 'pelos', 'pelas', 'dos', 'das', 'nos',
  'nas', 'num', 'numa', 'nele', 'nela', 'dele', 'dela', 'deles', 'delas',
  // determinantes e pronomes
  'uma', 'não', 'nao', 'sem', 'seu', 'sua', 'seus', 'suas', 'ele', 'ela',
  'este', 'esta', 'esse', 'essa', 'aquele', 'aquela', 'isso', 'isto',
  'mesmo', 'mesma', 'todo', 'toda', 'todos', 'todas', 'tudo', 'cada',
  // verbos de ligação e auxiliares
  'ser', 'era', 'foi', 'são', 'sao', 'está', 'esta', 'tem', 'têm', 'teve',
  'vai', 'vem', 'fica', 'ficou',
])

/** Palavras de conteúdo do título, sem acento e sem as vazias. */
export function palavrasDoTitulo(t: string): string[] {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !VAZIAS.has(w))
}

/**
 * Pares que dividem `minimo` ou mais palavras de conteúdo. O padrão é 2: uma
 * palavra em comum é coincidência ("Deus", "Jesus"), duas já é fórmula
 * repetida.
 */
export function colisoes(titulos: Titulo[], minimo = 2): Colisao[] {
  const palavras = titulos.map((t) => new Set(palavrasDoTitulo(t.titulo)))
  const achadas: Colisao[] = []
  for (let i = 0; i < titulos.length; i++) {
    for (let j = i + 1; j < titulos.length; j++) {
      const comuns = [...palavras[i]].filter((w) => palavras[j].has(w))
      if (comuns.length < minimo) continue
      achadas.push({
        a: titulos[i],
        b: titulos[j],
        comuns,
        identicos: titulos[i].titulo.trim() === titulos[j].titulo.trim(),
        forca: comuns.length / Math.max(1, Math.min(palavras[i].size, palavras[j].size)),
      })
    }
  }
  // Idênticos primeiro, depois os mais parecidos proporcionalmente.
  return achadas.sort(
    (x, y) => Number(y.identicos) - Number(x.identicos) || y.forca - x.forca || y.comuns.length - x.comuns.length,
  )
}

function main() {
  const arg = (n: string, p: string) =>
    process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? p
  const dir = arg('dir', 'data/enriched')
  const minimo = Number(arg('minimo', '2'))
  // Metade do título menor em comum já é o mesmo título com outras palavras.
  const forcaMin = Number(arg('forca', '0.5'))

  const titulos: Titulo[] = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
    .filter((m) => m.titulo_pericope_pt)
    .map((m) => ({
      ordem: m.ordem,
      titulo: m.titulo_pericope_pt,
      ref: m.abbrev ? `${m.abbrev}` : undefined,
    }))
    .sort((a, b) => a.ordem - b.ordem)

  const todas = colisoes(titulos, minimo)
  const achadas = todas.filter((c) => c.forca >= forcaMin)
  const identicos = achadas.filter((c) => c.identicos).length
  console.log(
    `${titulos.length} títulos · ${achadas.length} par(es) com força ≥ ${forcaMin} · ${identicos} idêntico(s) · ${todas.length - achadas.length} par(es) fracos omitidos`,
  )
  for (const c of achadas) {
    const marca = c.identicos ? '‼️ ' : '  '
    console.log(`${marca}${c.a.ordem} «${c.a.titulo}»`)
    console.log(`   ${c.b.ordem} «${c.b.titulo}»   [${c.comuns.join(', ')}] força ${c.forca.toFixed(2)}`)
  }
}

if (process.argv[1]?.endsWith('titulos-colididos.ts')) main()

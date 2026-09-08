/**
 * Confere a tabela de cortes contra o catálogo e a fonte bíblica, antes de qualquer
 * geração. Um corte errado só aparece depois de gastar LLM e TTS — este script
 * é a barreira barata.
 *
 * Verifica, por corte: a perícope original existe e bate com `de`; as partes
 * cobrem exatamente a faixa dela, sem buraco e sem sobreposição; e cada faixa
 * existe de fato na fonte.
 *
 * Usage: npx tsx scripts/validar-cortes.ts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CORTES, faixasDeSalmos } from './cortes.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

type LivroFonte = { abbrev: string; chapters: unknown[][] }
type Row = {
  ordem: number
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
}

const ponto = (c: number, v: number) => c * 100_000 + v

function parseFaixa(f: string) {
  const m = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(f)
  if (!m) throw new Error(`faixa inválida: ${f}`)
  return { ci: +m[1], vi: +m[2], cf: +m[3], vf: +m[4] }
}

function main() {
  const fonte = JSON.parse(readFileSync(join(root, 'data/BLIVRE.json'), 'utf8')) as LivroFonte[]
  const lens = new Map(fonte.map((b) => [b.abbrev, b.chapters.map((c) => c.length)]))
  const rows = readFileSync(join(root, 'data/raw-pericopes-brutas.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row)
  const porOrdem = new Map(rows.map((r) => [r.ordem, r]))

  const erros: string[] = []
  let totalPartes = 0

  for (const corte of CORTES) {
    const r = porOrdem.get(corte.ordem)
    if (!r) {
      erros.push(`#${corte.ordem}: não existe nas perícopes brutas`)
      continue
    }
    const real = `${r.livro} ${r.capitulo_inicio}:${r.versiculo_inicio}-${r.capitulo_fim}:${r.versiculo_fim}`
    if (real !== corte.de) {
      erros.push(`#${corte.ordem}: tabela diz "${corte.de}", catálogo diz "${real}"`)
      continue
    }
    const l = lens.get(r.abbrev)
    if (!l) {
      erros.push(`#${corte.ordem}: abbrev ${r.abbrev} fora da fonte`)
      continue
    }

    totalPartes += corte.partes.length
    if (corte.partes.length < 2) erros.push(`#${corte.ordem}: corte com menos de 2 partes`)

    // As partes têm de encadear exatamente: a primeira começa onde a original
    // começa, a última termina onde ela termina, e cada uma retoma no versículo
    // seguinte ao fim da anterior.
    let esperado = ponto(r.capitulo_inicio, r.versiculo_inicio)
    for (const [i, parte] of corte.partes.entries()) {
      const { ci, vi, cf, vf } = parseFaixa(parte.faixa)
      if (ci < 1 || ci > l.length || cf < 1 || cf > l.length) {
        erros.push(`#${corte.ordem} parte ${i + 1}: capítulo fora de ${r.livro}`)
        continue
      }
      if (vi < 1 || vi > l[ci - 1]) {
        erros.push(`#${corte.ordem} parte ${i + 1}: ${ci}:${vi} não existe (cap tem ${l[ci - 1]})`)
      }
      if (vf < 1 || vf > l[cf - 1]) {
        erros.push(`#${corte.ordem} parte ${i + 1}: ${cf}:${vf} não existe (cap tem ${l[cf - 1]})`)
      }
      if (ponto(ci, vi) !== esperado) {
        erros.push(
          `#${corte.ordem} parte ${i + 1} (${parte.faixa}): começa em ${ci}:${vi}, esperado ` +
            `${Math.floor(esperado / 100_000)}:${esperado % 100_000} — ${i === 0 ? 'não casa com o início da original' : 'buraco ou sobreposição com a parte anterior'}`,
        )
      }
      if (ponto(cf, vf) < ponto(ci, vi)) {
        erros.push(`#${corte.ordem} parte ${i + 1}: fim antes do início`)
      }
      // Próxima parte começa no versículo seguinte: se `vf` é o último do
      // capítulo, o seguinte é o 1 do capítulo de baixo.
      esperado = vf >= l[cf - 1] ? ponto(cf + 1, 1) : ponto(cf, vf + 1)
      if (!parte.titulo.trim()) erros.push(`#${corte.ordem} parte ${i + 1}: sem título`)
    }
    const fimOriginal =
      r.versiculo_fim >= l[r.capitulo_fim - 1]
        ? ponto(r.capitulo_fim + 1, 1)
        : ponto(r.capitulo_fim, r.versiculo_fim + 1)
    if (esperado !== fimOriginal) {
      erros.push(
        `#${corte.ordem}: as partes terminam antes ou depois do fim da original (${corte.de})`,
      )
    }
    if (!corte.motivo || corte.motivo.length < 40) {
      erros.push(`#${corte.ordem}: motivo ausente ou raso`)
    }
  }

  // Salmos
  const sl = lens.get('Sl')
  const faixas = faixasDeSalmos()
  const cobertos = new Set<number>()
  for (const f of faixas) for (const s of f.salmos) cobertos.add(s)
  if (sl) {
    for (let s = 1; s <= 150; s++) if (!cobertos.has(s)) erros.push(`Salmo ${s} fora das faixas`)
  }

  console.log(`Cortes manuais: ${CORTES.length} perícopes → ${totalPartes} partes`)
  console.log(`Salmos: 150 salmos → ${faixas.length} perícopes`)
  console.log(`TOTAL de perícopes novas: ${totalPartes + faixas.length}`)
  console.log(`Perícopes originais substituídas: ${CORTES.length + 5}`)
  if (erros.length) {
    console.log(`\n❌ ${erros.length} erro(s):`)
    for (const e of erros) console.log(`  ${e}`)
    process.exitCode = 1
  } else {
    console.log('\n✅ tabela consistente: partes encadeiam sem buraco nem sobreposição')
  }
}

main()

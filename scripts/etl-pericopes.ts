/**
 * ETL: limites do KJV_Pericopes × data/BLIVRE.json → data/raw-pericopes.jsonl
 * Usage: npx tsx scripts/etl-pericopes.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOK_MAP } from './book-map.ts'
import { resolveBounds } from './pericope-bounds.ts'
import { ajustarVersificacao } from './versificacao.ts'
import { gerarNovas } from './gerar-novas.ts'
import { ordenarParaLeitura, atribuirSeq } from './aplicar-cortes.ts'
import { extrairTexto } from './extrair-texto.ts'
import type { LivroBlivre } from './blivre-fonte.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fontePath = join(root, 'data/BLIVRE.json')
const kjvPath = join(root, 'data/raw/PericopeGroupedKJVVerses.json')
const outPath = join(root, 'data/raw-pericopes.jsonl')
/** As perícopes ANTES do recorte — é delas que os cortes partem. */
const brutasPath = join(root, 'data/raw-pericopes-brutas.jsonl')
const warnPath = join(root, 'data/etl-warnings.json')

type KjvRow = {
  Pericope: string
  'Reference Start': string
  'Reference End': string
  /** Fonte de verdade dos limites: ver scripts/pericope-bounds.ts. */
  Verses?: { Reference: string; Text: string }[]
}

type Warning = { ordem: number; type: string; detail: string }

function main() {
  const fonte = JSON.parse(readFileSync(fontePath, 'utf8')) as LivroBlivre[]
  const byAbbrev = new Map(fonte.map((b) => [b.abbrev, b]))
  const kjv = JSON.parse(readFileSync(kjvPath, 'utf8')) as KjvRow[]
  const warnings: Warning[] = []
  const lines: string[] = []

  for (let i = 0; i < kjv.length; i++) {
    const row = kjv[i]
    const bruto = resolveBounds(row)
    // Depois do resolveBounds, nunca antes: a tabela de versificação é escrita
    // contra a faixa REAL da perícope, não contra a declarada no dataset.
    const { start, end, ajustado } = ajustarVersificacao(i, bruto.start, bruto.end)
    const corrigido = bruto.corrigido
    if (ajustado) {
      warnings.push({
        ordem: i,
        type: 'versificacao_ajustada',
        detail: `${start.livroEn} ${start.capitulo}:${start.versiculo}→${end.capitulo}:${end.versiculo}`,
      })
    }
    if (corrigido) {
      warnings.push({
        ordem: i,
        type: 'limite_corrigido',
        detail: `declarado ${row['Reference Start']}→${row['Reference End']}, real ${start.livroEn} ${start.capitulo}:${start.versiculo}→${end.capitulo}:${end.versiculo}`,
      })
    }
    const mapped = BOOK_MAP[start.livroEn]
    if (!mapped) {
      warnings.push({ ordem: i, type: 'livro_desconhecido', detail: start.livroEn })
      continue
    }
    if (start.livroEn !== end.livroEn) {
      warnings.push({
        ordem: i,
        type: 'span_multi_livro',
        detail: `${row['Reference Start']} → ${row['Reference End']}`,
      })
      continue
    }
    const book = byAbbrev.get(mapped.abbrev)
    if (!book) {
      warnings.push({ ordem: i, type: 'abbrev_fonte', detail: mapped.abbrev })
      continue
    }

    const { texto, sobrescrito, versiculos: count, avisos } = extrairTexto(
      book,
      start.capitulo,
      start.versiculo,
      end.capitulo,
      end.versiculo,
    )
    for (const detail of avisos) {
      warnings.push({ ordem: i, type: 'versiculo', detail })
    }
    if (count === 0) {
      warnings.push({ ordem: i, type: 'vazio', detail: row.Pericope })
      continue
    }

    const raw = {
      ordem: i,
      titulo_en: row.Pericope,
      livro_en: start.livroEn,
      livro: mapped.name,
      abbrev: mapped.abbrev,
      capitulo_inicio: start.capitulo,
      versiculo_inicio: start.versiculo,
      capitulo_fim: end.capitulo,
      versiculo_fim: end.versiculo,
      texto,
      ...(sobrescrito ? { sobrescrito } : {}),
    }
    lines.push(JSON.stringify(raw))
  }

  // --- RECORTE ---
  // As perícopes grandes demais viram várias. `ordem` das existentes NUNCA muda
  // (é chave de progresso, anotação, destaque, jornada e do áudio no R2); as
  // novas entram com ordem >= 3000 na POSIÇÃO CANÔNICA, e `seq` passa a ser a
  // ordem de leitura. Ver scripts/cortes.ts e docs/estado-cobertura-e-cortes.md.
  const existentes = lines.map((l) => JSON.parse(l) as Record<string, unknown> & { ordem: number })
  mkdirSync(dirname(brutasPath), { recursive: true })
  writeFileSync(brutasPath, lines.join('\n') + '\n')
  const novas = gerarNovas(root, existentes as unknown as Parameters<typeof gerarNovas>[1])
  const naOrdemDeLeitura = ordenarParaLeitura(
    existentes as unknown as Parameters<typeof ordenarParaLeitura>[0],
    novas,
  )
  const comSeq = atribuirSeq(naOrdemDeLeitura)

  const substituidas = new Set(novas.map((n) => n.substitui))
  console.log(
    `Recorte: ${substituidas.size} perícopes viraram ${novas.length} · ` +
      `catálogo ${existentes.length} → ${comSeq.length}`,
  )

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, comSeq.map((x) => JSON.stringify(x)).join('\n') + '\n')
  writeFileSync(warnPath, JSON.stringify(warnings, null, 2))
  console.log(`OK: ${comSeq.length} perícopes → ${outPath}`)
  console.log(`Avisos: ${warnings.length} → ${warnPath}`)
}

main()

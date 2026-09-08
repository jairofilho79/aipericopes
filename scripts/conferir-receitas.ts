/**
 * Confere que o PIPELINE reproduz, versículo a versículo, o texto bíblico que o
 * app serve hoje em `data/pericopes.json`.
 *
 * Uso:
 *   npx tsx scripts/conferir-receitas.ts
 *
 * Por que isto existe. As correções da Escritura moram em dois lugares com
 * naturezas opostas: `blivre-correcoes.ts` é a RECEITA, que o pipeline reaplica
 * a cada build a partir do VPL oficial; `data/pericopes.json` é o RESULTADO, que
 * é o que o leitor lê. Um conserto feito só no resultado sobrevive até alguém
 * rodar `npm run pipeline`, e some sem erro nenhum — o build passa, os testes
 * passam, e o versículo volta ao defeito. Aconteceu: 156 consertos ficaram um
 * dia inteiro só no resultado.
 *
 * Este script é a única coisa que enxerga essa diferença. Ele não substitui os
 * testes de `blivre-correcoes.test.ts` (que travam o tamanho das tabelas e a
 * forma das receitas): aqueles perguntam se a tabela está sã, este pergunta se
 * ela é SUFICIENTE.
 *
 * Não é teste de vitest de propósito — depende de `data/bliv-tr_vpl.txt`, que é
 * gitignorado, e um teste que lê arquivo derivado passa aqui e quebra na CI.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { corrigirVersiculo } from './blivre-correcoes.ts'
import { MAPA_LIVROS } from './blivre-fonte.ts'
import { separarEpigrafe } from './blivre-epigrafes.ts'
import { removerColchetes } from './blivre-texto.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LINHA = /^([A-Z0-9]{3}) (\d+):(\d+) ?(.*)$/

/** `GEN 26:29` → o versículo como o pipeline o entrega. */
function doPipeline(): Map<string, string> {
  const fora = new Map<string, string>()
  const bruto = readFileSync(join(root, 'data/bliv-tr_vpl.txt'), 'utf8').replace(/^﻿/, '')
  for (const linha of bruto.split(/\r?\n/)) {
    if (!linha.trim()) continue
    const m = LINHA.exec(linha)
    if (!m) throw new Error(`Linha fora do formato VPL: "${linha.slice(0, 60)}"`)
    const [, cod, c, v, corpo] = m
    const corrigido = corrigirVersiculo(cod, Number(c), Number(v), corpo.trim())
    const { epigrafe, tipo, texto } = separarEpigrafe(cod, Number(c), Number(v), corrigido)
    const limpo = removerColchetes(texto)
    // O rótulo estrutural (Sl 119, Cantares) volta para a linha do versículo,
    // que é como o catálogo o serve. Sem isto a conferência acusa 46 falsos.
    fora.set(`${cod} ${c}:${v}`, tipo === 'rotulo' && epigrafe ? `${epigrafe}: ${limpo}` : limpo)
  }
  return fora
}

/** `GEN 26:29` → o versículo como o catálogo o serve. */
function doCatalogo(): Map<string, string> {
  const porAbbrev = new Map(Object.entries(MAPA_LIVROS).map(([cod, l]) => [l.abbrev, cod]))
  const fora = new Map<string, string>()
  type P = { abbrev: string; capitulo_inicio: number; texto: string }
  for (const p of JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as P[]) {
    const cod = porAbbrev.get(p.abbrev)
    if (!cod) throw new Error(`Abreviatura fora do mapa: ${p.abbrev}`)
    let cap = p.capitulo_inicio
    for (const linha of p.texto.split('\n')) {
      const capNovo = /^Capítulo (\d+)$/.exec(linha)
      if (capNovo) {
        cap = Number(capNovo[1])
        continue
      }
      const verso = /^(\d+) (.*)$/.exec(linha)
      if (verso) fora.set(`${cod} ${cap}:${verso[1]}`, verso[2])
    }
  }
  return fora
}

const pipeline = doPipeline()
const catalogo = doCatalogo()

const divergem: string[] = []
for (const [ref, servido] of catalogo) {
  const gerado = pipeline.get(ref)
  if (gerado === undefined) throw new Error(`${ref} está no catálogo e não no VPL`)
  if (gerado !== servido) divergem.push(ref)
}

if (divergem.length === 0) {
  console.log(
    `OK: ${catalogo.size.toLocaleString('pt-BR')} versículos — o pipeline reproduz o catálogo servido.`,
  )
  process.exit(0)
}

console.error(
  `${divergem.length} versículo(s) que um \`npm run pipeline\` REVERTERIA — falta receita para eles:\n`,
)
for (const ref of divergem) {
  console.error(`  ${ref}`)
  console.error(`    pipeline: ${pipeline.get(ref)}`)
  console.error(`    servido : ${catalogo.get(ref)}`)
}
process.exit(1)

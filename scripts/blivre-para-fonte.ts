/**
 * Gera `data/BLIVRE.json` a partir do VPL oficial da Bíblia Livre.
 *
 * Uso:
 *   npx tsx scripts/blivre-para-fonte.ts
 *
 * Entrada: `data/bliv-tr_vpl.txt` — baixar do release oficial
 *   https://github.com/blivre/BibliaLivre/releases → bliv-tr_vpl.zip
 * Saída:   `data/BLIVRE.json` — o que o ETL consome (ambos gitignorados).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { converterVpl } from './blivre-fonte.ts'
import {
  DUPLICADAS,
  PARENTESES_ORFAOS,
  CORRECOES,
  SUBSCRICOES,
  OMISSOES,
} from './blivre-correcoes.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entrada = join(root, 'data/bliv-tr_vpl.txt')
const saida = join(root, 'data/BLIVRE.json')

/** O cânone protestante. Se estes números mudarem, a fonte trocou. */
const LIVROS_ESPERADOS = 66
const VERSICULOS_ESPERADOS = 31_102

function main() {
  const livros = converterVpl(readFileSync(entrada, 'utf8'))

  let versiculos = 0
  let sobrescritos = 0
  let rotulos = 0
  for (const l of livros) {
    for (const cap of l.chapters) {
      versiculos += cap.length
      for (const v of cap) {
        if (v.e) sobrescritos++
        if (v.r) rotulos++
      }
    }
  }

  if (livros.length !== LIVROS_ESPERADOS) {
    throw new Error(`Esperava ${LIVROS_ESPERADOS} livros, vieram ${livros.length}`)
  }
  if (versiculos !== VERSICULOS_ESPERADOS) {
    throw new Error(`Esperava ${VERSICULOS_ESPERADOS} versículos, vieram ${versiculos}`)
  }

  writeFileSync(saida, JSON.stringify(livros))
  console.log(
    `OK: ${livros.length} livros · ${versiculos.toLocaleString('pt-BR')} versículos · ` +
      `${sobrescritos} sobrescritos · ${rotulos} rótulos · ` +
      `${DUPLICADAS.length + PARENTESES_ORFAOS.length + CORRECOES.length} correções · ` +
      `${SUBSCRICOES.length} subscrições fora · ${OMISSOES.length} frases restauradas → ${saida}`,
  )
}

main()

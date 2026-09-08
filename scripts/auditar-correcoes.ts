/**
 * O buraco entre o catálogo e o conserto.
 *
 * `defeitos-blivre.ts` guarda TODA referência onde alguém leu um defeito.
 * `blivre-correcoes.ts` guarda só as que já sabem virar texto certo. Entre as
 * duas mora a pergunta desta fase: o que ainda chega torto na tela?
 *
 * Um defeito catalogado ou já tem receita à mão, ou está EM ABERTO. Não dá
 * para decidir por máquina se a ETL o resolveu: `removerColchetes` mexe em
 * quase todo versículo com colchete, e ter mexido não quer dizer ter
 * consertado o defeito que alguém leu. O que a auditoria faz é separar o que
 * está provado resolvido do que ainda precisa de olho, e marcar quais dos
 * abertos a ETL tocou — porque nesses a suspeita de que o erro era MEU, de
 * normalização, e não da fonte, é a primeira a conferir.
 *
 * Rode: `npx tsx scripts/auditar-correcoes.ts [--lista]`
 */
import { readFileSync } from 'node:fs'
import { DEFEITOS } from './defeitos-blivre.ts'
import { corrigirVersiculo } from './blivre-correcoes.ts'
import { removerColchetes } from './blivre-texto.ts'
import { separarEpigrafe } from './blivre-epigrafes.ts'

const LINHA_VPL = /^([1-3A-Z]{3})\s(\d+):(\d+)\s(.+)$/

export type Situacao = 'receita' | 'aberto'

export type Achado = {
  ref: string
  classe: string
  situacao: Situacao
  /** A ETL mexeu neste versículo — pista de que o defeito podia ser meu. */
  etlMexeu: boolean
  bruto: string
  servido: string
}

export function auditar(vpl: string): Achado[] {
  const bruto = new Map<string, { cod: string; cap: number; ver: number; texto: string }>()
  for (const linha of vpl.replace(/^﻿/, '').split(/\r?\n/)) {
    const m = LINHA_VPL.exec(linha)
    if (!m) continue
    bruto.set(`${m[1]} ${m[2]}:${m[3]}`, {
      cod: m[1], cap: Number(m[2]), ver: Number(m[3]), texto: m[4],
    })
  }

  const achados: Achado[] = []
  for (const { classe, refs } of DEFEITOS) {
    for (const ref of refs) {
      const v = bruto.get(ref)
      if (!v) throw new Error(`${ref} não existe no VPL — o catálogo mente.`)

      // A mesma ordem de `converterVpl`: receita, epígrafe, colchetes. Sem a
      // epígrafe no meio, salmo com sobrescrito aparecia aqui com o dois-pontos
      // colado — defeito que não existe na tela, e que eu quase fui consertar.
      const comReceita = corrigirVersiculo(v.cod, v.cap, v.ver, v.texto)
      const servido = removerColchetes(
        separarEpigrafe(v.cod, v.cap, v.ver, comReceita).texto,
      )
      const situacao: Situacao = comReceita !== v.texto ? 'receita' : 'aberto'
      const etlMexeu = removerColchetes(separarEpigrafe(v.cod, v.cap, v.ver, v.texto).texto) !== v.texto

      achados.push({ ref, classe, situacao, etlMexeu, bruto: v.texto, servido })
    }
  }
  return achados
}

// O caminho do projeto tem espaços, e `file://${argv[1]}` não bate com
// a URL escapada de import.meta — o idioma do resto do repo é o sufixo.
if (process.argv[1]?.endsWith('auditar-correcoes.ts')) {
  const achados = auditar(readFileSync('data/bliv-tr_vpl.txt', 'utf8'))
  const por = (s: Situacao) => achados.filter((a) => a.situacao === s)

  const abertos = por('aberto')
  console.log(`catálogo: ${achados.length} referências`)
  console.log(`  com receita à mão: ${por('receita').length}`)
  console.log(`  EM ABERTO:         ${abertos.length}`)
  console.log(`    destes, a ETL tocou o versículo: ${abertos.filter((a) => a.etlMexeu).length}`)

  if (process.argv.includes('--lista')) {
    console.log('\n--- em aberto ---')
    for (const a of abertos) console.log(`${a.ref}\t${a.etlMexeu ? 'etl' : '---'}\t${a.classe}\t${a.servido}`)
  }
}

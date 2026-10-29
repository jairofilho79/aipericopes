/**
 * Gera public/data/referencias/<slug>.json — as referências cruzadas da ARC por
 * livro, com o ponto de cada letrinha já alinhado ao texto da Bíblia Livre.
 *
 * Fontes (ambas derivadas do EPUB da ARC e fora do git, como pericopes-arc.json):
 *   data/referencias-cruzadas-arc.json  — scripts/extrair_referencias_cruzadas_arc.py
 *   data/referencias-ancoras-arc.json   — scripts/extrair_ancoras_referencias_arc.py
 *
 * Quem clona o repositório sem o EPUB não tem as fontes: o script avisa e sai
 * sem apagar nada, e o app simplesmente não mostra referências (nada quebra).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { livroSlug } from '../src/lib/livro-slug'
import { parseTexto } from '../src/lib/parse-texto'
import type { Pericope } from '../src/lib/types'
import {
  chaveLivro,
  montarShardLivro,
  type AncoraArc,
  type EstatisticasShard,
  type NotaArc,
} from './referencias-ancoras'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogoPath = join(root, 'data/pericopes.json')
const notasPath = join(root, 'data/referencias-cruzadas-arc.json')
const ancorasPath = join(root, 'data/referencias-ancoras-arc.json')
const outDir = join(root, 'public/data/referencias')

function main(): void {
  if (!existsSync(notasPath) || !existsSync(ancorasPath)) {
    console.log('[referencias] fontes da ARC ausentes — nada a fazer (o app segue sem referências)')
    return
  }

  const catalogo = JSON.parse(readFileSync(catalogoPath, 'utf8')) as Pericope[]
  const notas = (JSON.parse(readFileSync(notasPath, 'utf8')) as { notas: NotaArc[] }).notas
  const ancoras = (
    JSON.parse(readFileSync(ancorasPath, 'utf8')) as { livros: Record<string, Record<string, AncoraArc[]>> }
  ).livros

  const notasPorId = new Map(notas.map((n) => [n.id, n]))
  const nomeNoCatalogo = new Map<string, string>()
  const versiculosPorLivro = new Map<string, Map<string, string>>()
  for (const p of catalogo) {
    nomeNoCatalogo.set(chaveLivro(p.livro), p.livro)
    const mapa = versiculosPorLivro.get(p.livro) ?? new Map<string, string>()
    for (const b of parseTexto(p.texto)) {
      if (b.kind === 'verse' && b.verse > 0) mapa.set(b.id, b.text)
    }
    versiculosPorLivro.set(p.livro, mapa)
  }

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const total: EstatisticasShard = {
    notas: 0,
    exata: 0,
    parcial: 0,
    estimada: 0,
    semVersiculo: 0,
    alvosDescartados: 0,
  }
  const semCatalogo: string[] = []
  for (const [livroArc, porVersiculo] of Object.entries(ancoras)) {
    const livro = nomeNoCatalogo.get(chaveLivro(livroArc))
    if (!livro) {
      semCatalogo.push(livroArc)
      continue
    }
    const { shard, stats } = montarShardLivro(
      livro,
      porVersiculo,
      notasPorId,
      versiculosPorLivro.get(livro) ?? new Map(),
      nomeNoCatalogo,
    )
    writeFileSync(join(outDir, `${livroSlug(livro)}.json`), JSON.stringify(shard))
    for (const k of Object.keys(total) as (keyof EstatisticasShard)[]) total[k] += stats[k]
  }

  const confiavel = total.exata + total.parcial
  console.log(
    `[referencias] ${total.notas} notas — ponto exato ${total.exata}, parcial ${total.parcial}, ` +
      `estimado ${total.estimada}, versículo ausente ${total.semVersiculo}; ` +
      `${total.alvosDescartados} alvos descartados (${((100 * confiavel) / Math.max(total.notas, 1)).toFixed(1)}% por palavra)`,
  )
  if (semCatalogo.length) console.warn(`[referencias] livros sem correspondência no catálogo: ${semCatalogo.join(', ')}`)
}

main()

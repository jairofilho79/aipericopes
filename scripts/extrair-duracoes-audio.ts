/**
 * Extrai a duração real em segundos de cada narração publicada a partir dos
 * manifestos oficiais (Algenib V4 / gam-ash2 / novos lotes) e salva em data/audio-duracoes.json.
 *
 * Garante que o app conheça os tempos reais de áudio sem precisar fazer requisições
 * de rede ou depender do volume de áudio local durante builds em outros ambientes.
 *
 * Suporta diretórios adicionais via argumentos de linha de comando ou pela variável TTS_CORPUS.
 * Mescla com durações já existentes, permitindo atualizações parciais ou totais.
 *
 * Uso:
 *   npm run audio:duracoes
 *   npx tsx scripts/extrair-duracoes-audio.ts [/caminho/para/novo-corpus]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const coberturaPath = join(root, 'data/audio-cobertura.json')
const algenibPath = join(root, 'src/lib/algenib-ordens.json')
const saidaPath = join(root, 'data/audio-duracoes.json')

const ttsBase = process.env.TTS_CORPUS || '/Volumes/SSD 2TB SD/dev/tts-corpus'
const corpusAlgenib = join(root, 'amostras/corpus-algenib-v3')
const corpusG31 = join(ttsBase, 'g31')
const corpusAsh2 = join(ttsBase, 'gam-ash2')

// Diretórios extras passados como argumentos (têm máxima prioridade)
const diretoriosExtras = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))

function lerDurTotalDe(pasta: string, pad: string): number | null {
  const p = join(pasta, pad, 'manifest.json')
  if (!existsSync(p)) return null
  try {
    const m = JSON.parse(readFileSync(p, 'utf8')) as { dur_total?: number }
    if (typeof m.dur_total === 'number' && m.dur_total > 0) {
      return m.dur_total
    }
  } catch {}
  return null
}

function main() {
  if (!existsSync(coberturaPath)) {
    console.error('❌ data/audio-cobertura.json não encontrado.')
    process.exit(1)
  }

  const { ordens } = JSON.parse(readFileSync(coberturaPath, 'utf8')) as { ordens: number[] }
  const algenibOrdens = new Set<number>(
    existsSync(algenibPath) ? (JSON.parse(readFileSync(algenibPath, 'utf8')) as number[]) : [],
  )
  algenibOrdens.add(2) // Gn 3:1-24 já migrada

  // Carrega durações existentes como base para suportar atualizações incrementais
  const duracoesExistentes: Record<number, number> = existsSync(saidaPath)
    ? (JSON.parse(readFileSync(saidaPath, 'utf8')) as Record<number, number>)
    : {}

  const duracoes: Record<number, number> = { ...duracoesExistentes }
  let deExtras = 0
  let deAlgenib = 0
  let deAsh2 = 0
  let preservadas = 0
  let naoEncontradas = 0

  for (const ordem of ordens) {
    const pad = String(ordem).padStart(4, '0')
    let dur: number | null = null

    // 1. Prioridade máxima: diretórios extras passados na CLI
    for (const extra of diretoriosExtras) {
      dur = lerDurTotalDe(extra, pad)
      if (dur !== null) {
        deExtras++
        break
      }
    }

    // 2. Voz Algenib (v3/v4 ou g31)
    if (dur === null && algenibOrdens.has(ordem)) {
      dur = lerDurTotalDe(corpusAlgenib, pad)
      if (dur !== null) {
        deAlgenib++
      } else {
        dur = lerDurTotalDe(corpusG31, pad)
        if (dur !== null) deAlgenib++
      }
    }

    // 3. Voz Ash (gam-ash2)
    if (dur === null) {
      dur = lerDurTotalDe(corpusAsh2, pad)
      if (dur !== null) {
        deAsh2++
      }
    }

    // 4. Se não achou nos caminhos locais nesta execução, mantém a já registrada anteriormente
    if (dur !== null) {
      duracoes[ordem] = Math.round(dur * 10) / 10
    } else if (typeof duracoesExistentes[ordem] === 'number') {
      preservadas++
    } else {
      naoEncontradas++
    }
  }

  writeFileSync(saidaPath, JSON.stringify(duracoes))
  console.log(`✅ ${Object.keys(duracoes).length} durações salvas em ${saidaPath}`)
  if (deExtras > 0) console.log(`   - De diretórios customizados: ${deExtras}`)
  console.log(`   - Voz Algenib V3/V4: ${deAlgenib}`)
  console.log(`   - Voz Ash (gam-ash2): ${deAsh2}`)
  if (preservadas > 0) console.log(`   - Preservadas de registros anteriores: ${preservadas}`)
  if (naoEncontradas > 0) {
    console.warn(`   ⚠️ ${naoEncontradas} perícopes sem manifesto local encontrado`)
  }
}

main()

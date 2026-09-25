/**
 * Script de normalização de áudio para ganho de volume (+13 dB) e upload no R2
 * com limitador sobreamostrado para o acervo de perícopes da voz Algenib.
 *
 * Uso:
 *   npx tsx scripts/normalizar-algenib.ts --ordem=0
 *   npx tsx scripts/normalizar-algenib.ts --ordens=0..10
 *   npx tsx scripts/normalizar-algenib.ts --todas --concorrencia=4
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const root = join(import.meta.dirname, '..')
const corpusDir = join(root, 'amostras', 'corpus-algenib-v3')
const cacheDir = join(root, 'amostras', 'corpus-algenib-alto')
const BUCKET = 'biblia-pericopes-audio'
const PREFIXO_DEFAULT = 'algenib-v5'
const GANHO_DEFAULT = '13dB'
const TETO_DEFAULT = '0.707' // -3.0 dBFS limitador
const BITRATE_DEFAULT = '96k'

async function processarPericope(
  ordem: number,
  prefixo: string,
  ganho: string,
  teto: string,
  bitrate: string,
): Promise<{ ok: boolean; motivo?: string }> {
  const pad = ordem.toString().padStart(4, '0')
  const dirSrc = join(corpusDir, pad)
  const m4aSrc = join(dirSrc, 'pericope.m4a')
  const jsonSrc = join(dirSrc, 'manifest.json')

  if (!existsSync(m4aSrc) || !existsSync(jsonSrc)) {
    return { ok: false, motivo: 'origem ausente' }
  }

  const dirOut = join(cacheDir, pad)
  mkdirSync(dirOut, { recursive: true })
  const m4aOut = join(dirOut, 'pericope.m4a')
  const jsonOut = join(dirOut, 'manifest.json')
  const marcadorR2 = join(dirOut, `.subiu_r2_${prefixo}`)

  // 1. Processar áudio com ffmpeg caso não exista ou seja mais antigo que o master
  const precisaFfmpeg = !existsSync(m4aOut) || statSync(m4aSrc).mtimeMs > statSync(m4aOut).mtimeMs
  if (precisaFfmpeg) {
    const af = `aresample=96000,volume=${ganho},alimiter=limit=${teto}:attack=5:release=50:level=disabled,aresample=24000`
    const cmd = `ffmpeg -nostdin -hide_banner -loglevel error -y -i "${m4aSrc}" -af "${af}" -c:a aac -b:a ${bitrate} -ar 24000 -ac 1 -movflags +faststart "${m4aOut}"`
    await execAsync(cmd)
    writeFileSync(jsonOut, readFileSync(jsonSrc))
  }

  // 2. Upload para R2 caso ainda não tenha subido
  const precisaUpload = !existsSync(marcadorR2) || statSync(m4aOut).mtimeMs > statSync(marcadorR2).mtimeMs
  if (precisaUpload) {
    // Upload do M4A
    await execAsync(
      `npx wrangler r2 object put "${BUCKET}/${prefixo}/${ordem}.m4a" --file="${m4aOut}" --content-type="audio/mp4" --remote`,
    )
    // Upload do JSON
    await execAsync(
      `npx wrangler r2 object put "${BUCKET}/${prefixo}/${ordem}.json" --file="${jsonOut}" --content-type="application/json" --remote`,
    )
    writeFileSync(marcadorR2, new Date().toISOString())
  }

  return { ok: true }
}

async function main() {
  const args = process.argv.slice(2)
  let prefixo = PREFIXO_DEFAULT
  let ganho = GANHO_DEFAULT
  let teto = TETO_DEFAULT
  let bitrate = BITRATE_DEFAULT
  let concorrencia = 4
  let ordens: number[] = []

  for (const a of args) {
    if (a.startsWith('--prefixo=')) prefixo = a.split('=')[1]
    if (a.startsWith('--ganho=')) ganho = a.split('=')[1]
    if (a.startsWith('--teto=')) teto = a.split('=')[1]
    if (a.startsWith('--bitrate=')) bitrate = a.split('=')[1]
    if (a.startsWith('--concorrencia=')) concorrencia = parseInt(a.split('=')[1], 10)
    if (a.startsWith('--ordem=')) ordens = [parseInt(a.split('=')[1], 10)]
    if (a.startsWith('--ordens=')) {
      const [ini, fim] = a.split('=')[1].split('..').map((v) => parseInt(v, 10))
      ordens = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i)
    }
    if (a === '--todas') {
      ordens = readdirSync(corpusDir)
        .filter((d) => /^\d{4}$/.test(d))
        .map((d) => parseInt(d, 10))
        .sort((a, b) => a - b)
    }
  }

  if (ordens.length === 0) {
    console.log('Uso: npx tsx scripts/normalizar-algenib.ts [--ordem=0 | --ordens=0..10 | --todas] [--concorrencia=4]')
    process.exit(1)
  }

  console.log('==================================================================')
  console.log(`  NORMALIZAÇÃO DE ÁUDIO COM GANHO ${ganho} — ${BUCKET}`)
  console.log(`  Prefixo: ${prefixo} | Perícopes a processar: ${ordens.length}`)
  console.log(`  Concorrência: ${concorrencia} | Teto limitador: ${teto}`)
  console.log('==================================================================\n')

  let concluidas = 0
  let erros = 0

  async function executarFila() {
    let index = 0
    const workers = Array.from({ length: concorrencia }, async (_, wId) => {
      while (index < ordens.length) {
        const i = index++
        const ordem = ordens[i]
        const pad = ordem.toString().padStart(4, '0')
        const t0 = Date.now()
        process.stdout.write(`[W${wId + 1}] [${pad}] Processando (+${ganho} -> ${prefixo})... `)
        try {
          const res = await processarPericope(ordem, prefixo, ganho, teto, bitrate)
          if (res.ok) {
            concluidas++
            const dur = ((Date.now() - t0) / 1000).toFixed(1)
            console.log(`OK (${dur}s) [${concluidas}/${ordens.length}]`)
          } else {
            erros++
            console.log(`PULOU (${res.motivo})`)
          }
        } catch (err: any) {
          erros++
          console.error(`ERRO: ${err.message}`)
        }
      }
    })
    await Promise.all(workers)
  }

  await executarFila()

  console.log('\n==================================================================')
  console.log(`Concluídas: ${concluidas} | Erros/Puladas: ${erros}`)
  console.log('==================================================================')
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

/**
 * Script de publicação oficial de áudio e manifesto no Cloudflare R2
 * para o acervo de perícopes da Bíblia Livre.
 *
 * Uso:
 *   npx tsx scripts/publicar-r2.ts --ordens=1600..1619
 *   npx tsx scripts/publicar-r2.ts --ordem=1600
 *   npx tsx scripts/publicar-r2.ts --prefixo=algenib-v3
 */

import { existsSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = join(import.meta.dirname, '..')
const defaultCorpus = join(root, 'amostras', 'corpus-algenib-v3')
const BUCKET = 'biblia-pericopes-audio'

async function main() {
  const args = process.argv.slice(2)
  let prefixo = 'algenib-v4'
  let ordens: number[] = []

  for (const a of args) {
    if (a.startsWith('--prefixo=')) prefixo = a.split('=')[1]
    if (a.startsWith('--ordem=')) ordens = [parseInt(a.split('=')[1], 10)]
    if (a.startsWith('--ordens=')) {
      const [ini, fim] = a.split('=')[1].split('..').map((v) => parseInt(v, 10))
      ordens = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i)
    }
  }

  if (ordens.length === 0) {
    console.log('Uso: npx tsx scripts/publicar-r2.ts --ordens=1600..1619 [--prefixo=algenib-v4]')
    process.exit(1)
  }

  console.log('==================================================================')
  console.log(`  PUBLICAÇÃO CLOUDFLARE R2 — ${BUCKET}`)
  console.log(`  Prefixo: ${prefixo} | Perícopes a publicar: ${ordens.length}`)
  console.log('==================================================================\n')

  let subiuM4a = 0
  let subiuJson = 0
  let pulados = 0

  for (const ordem of ordens) {
    const pad = ordem.toString().padStart(4, '0')
    const dir = join(defaultCorpus, pad)
    const m4a = join(dir, 'pericope.m4a')
    const json = join(dir, 'manifest.json')

    if (!existsSync(m4a) || !existsSync(json)) {
      console.warn(`⚠️ [${pad}] Arquivo m4a ou manifest.json ausente. Pulei.`)
      continue
    }

    const marcadorAudio = join(dir, `.subiu_r2_${prefixo}`)
    const marcadorJson = join(dir, `.subiu_r2_json_${prefixo}`)

    // Upload do Áudio .m4a
    const precisaSubirAudio =
      !existsSync(marcadorAudio) || statSync(m4a).mtimeMs > statSync(marcadorAudio).mtimeMs

    if (precisaSubirAudio) {
      process.stdout.write(`  ⬆️ [${pad}] Subindo áudio ${prefixo}/${ordem}.m4a... `)
      try {
        execSync(
          `npx wrangler r2 object put "${BUCKET}/${prefixo}/${ordem}.m4a" --file="${m4a}" --content-type="audio/mp4" --remote`,
          { stdio: 'pipe' },
        )
        writeFileSync(marcadorAudio, new Date().toISOString())
        process.stdout.write('OK\n')
        subiuM4a++
      } catch (err: any) {
        console.error(`FALHA no áudio: ${err.message}`)
      }
    }

    // Upload do Manifesto .json
    const precisaSubirJson =
      !existsSync(marcadorJson) || statSync(json).mtimeMs > statSync(marcadorJson).mtimeMs

    if (precisaSubirJson) {
      process.stdout.write(`  ⬆️ [${pad}] Subindo manifesto ${prefixo}/${ordem}.json... `)
      try {
        execSync(
          `npx wrangler r2 object put "${BUCKET}/${prefixo}/${ordem}.json" --file="${json}" --content-type="application/json" --remote`,
          { stdio: 'pipe' },
        )
        writeFileSync(marcadorJson, new Date().toISOString())
        process.stdout.write('OK\n')
        subiuJson++
      } catch (err: any) {
        console.error(`FALHA no json: ${err.message}`)
      }
    }

    if (!precisaSubirAudio && !precisaSubirJson) {
      pulados++
    }
  }

  console.log('\n==================================================================')
  console.log('🏁 PUBLICAÇÃO R2 CONCLUÍDA')
  console.log(`  Áudios (.m4a) enviados:       ${subiuM4a}`)
  console.log(`  Manifestos (.json) enviados:  ${subiuJson}`)
  console.log(`  Perícopes já em dia (puladas): ${pulados}`)
  console.log('==================================================================\n')
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

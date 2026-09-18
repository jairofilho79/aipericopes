/**
 * PASSO 5: PUBLICAÇÃO DO SITE & DEPLOY NO AR
 * 
 * Este script executa a etapa final do pipeline, podendo ser executado
 * sob demanda ou retroativamente para qualquer lote de perícopes:
 * 
 * 1. Sincroniza retroativamente todo o conteúdo revisado (título, contexto,
 *    resenha, reflexões, tópicos) de data/revisoes/ para data/pericopes.json.
 * 2. Atualiza a cobertura de áudio em data/audio-cobertura.json com as perícopes
 *    que já foram publicadas no Cloudflare R2 (prefixo algenib-v4).
 * 3. Regenera os shards estáticos de metadados e estudo (scripts/shard-catalogo.ts).
 * 4. Compila o frontend React/Vite (npm run build).
 * 5. Publica no Cloudflare via wrangler deploy, colocando as alterações no ar em aipericopes.com.
 * 
 * Uso:
 *   npx tsx scripts/passo-5-publicar-site.ts
 *   npx tsx scripts/passo-5-publicar-site.ts --ordem=1630
 *   npx tsx scripts/passo-5-publicar-site.ts --ordens=1630..1747
 *   npx tsx scripts/passo-5-publicar-site.ts --sem-deploy (apenas sincroniza e gera shards)
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { carregarEstado } from './esteira.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pericopesPath = join(root, 'data', 'pericopes.json')
const revisoesDir = join(root, 'data', 'revisoes')
const coberturaPath = join(root, 'data', 'audio-cobertura.json')
const corpusDir = join(root, 'amostras', 'corpus-algenib-v3')

async function main() {
  const args = process.argv.slice(2)
  const semDeploy = args.includes('--sem-deploy')
  let ordensFiltro: number[] | null = null

  for (const a of args) {
    if (a.startsWith('--ordem=')) ordensFiltro = [parseInt(a.split('=')[1], 10)]
    if (a.startsWith('--ordens=')) {
      const [ini, fim] = a.split('=')[1].split('..').map((v) => parseInt(v, 10))
      ordensFiltro = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i)
    }
  }

  console.log('==================================================================')
  console.log('  PASSO 5: PUBLICAÇÃO DE CONTEÚDO NO SITE & DEPLOY CLOUDFLARE')
  console.log('  aipericopes.com')
  console.log('==================================================================\n')

  // 1. SINCRONIZAÇÃO RETROATIVA DE REVISÕES EDITORAIS
  console.log('📝 [1/5] Sincronizando revisões editoriais para data/pericopes.json...')
  if (!existsSync(pericopesPath)) {
    console.error('❌ data/pericopes.json não encontrado.')
    process.exit(1)
  }

  const pericopes = JSON.parse(readFileSync(pericopesPath, 'utf8')) as any[]
  const periMap = new Map<number, any>(pericopes.map((p) => [p.ordem, p]))

  let atualizadas = 0
  if (existsSync(revisoesDir)) {
    const arquivos = readdirSync(revisoesDir).filter((f) => f.endsWith('.json'))
    for (const f of arquivos) {
      const ordem = parseInt(f.replace('.json', ''), 10)
      if (isNaN(ordem)) continue
      if (ordensFiltro && !ordensFiltro.includes(ordem)) continue

      try {
        const mat = JSON.parse(readFileSync(join(revisoesDir, f), 'utf8'))
        const p = periMap.get(ordem)
        if (p) {
          p.titulo_pericope_pt = mat.titulo_pericope_pt ?? p.titulo_pericope_pt
          p.contexto_historico_literario = mat.contexto_historico_literario ?? p.contexto_historico_literario
          p.resenha = mat.resenha ?? p.resenha
          p.perguntas_reflexao = mat.perguntas_reflexao ?? p.perguntas_reflexao
          p.topicos_pregar = mat.topicos_pregar ?? p.topicos_pregar
          atualizadas++
        }
      } catch (err: any) {
        console.warn(`  ⚠️ Falha ao ler revisão ${f}: ${err.message}`)
      }
    }
  }

  writeFileSync(pericopesPath, JSON.stringify(pericopes, null, 2), 'utf8')
  console.log(`  ✅ ${atualizadas} perícopes sincronizadas com texto editorial completo em data/pericopes.json.\n`)

  // 2. ATUALIZAÇÃO DA COBERTURA DE ÁUDIO E LISTA DE ALGENIB-V4
  console.log('🎙️ [2/5] Atualizando cobertura de áudio e mapeamento Algenib V4...')
  const estado = carregarEstado()
  let coberturaOrdens = new Set<number>()
  const algenibOrdens = new Set<number>()

  if (existsSync(coberturaPath)) {
    try {
      const c = JSON.parse(readFileSync(coberturaPath, 'utf8')) as { ordens: number[] }
      coberturaOrdens = new Set(c.ordens || [])
    } catch {}
  }

  let novosAudios = 0
  for (const [k, v] of Object.entries(estado)) {
    const o = parseInt(k, 10)
    if (isNaN(o)) continue
    // Se o estado marcou como publicado ou se o marcador de upload R2 existe no disco
    const pad = o.toString().padStart(4, '0')
    const marcadorR2 = join(corpusDir, pad, '.subiu_r2_algenib-v4')
    if (v.publicado || existsSync(marcadorR2)) {
      algenibOrdens.add(o)
      if (!coberturaOrdens.has(o)) {
        coberturaOrdens.add(o)
        novosAudios++
      }
    }
  }

  if (existsSync(corpusDir)) {
    for (const d of readdirSync(corpusDir)) {
      if (/^\d{4}$/.test(d) && existsSync(join(corpusDir, d, '.subiu_r2_algenib-v4'))) {
        algenibOrdens.add(parseInt(d, 10))
      }
    }
  }

  const algenibPath = join(root, 'src', 'lib', 'algenib-ordens.json')
  writeFileSync(algenibPath, JSON.stringify(Array.from(algenibOrdens).sort((a, b) => a - b), null, 2) + '\n', 'utf8')
  console.log(`  ✅ ${algenibOrdens.size} perícopes mapeadas para Algenib V4 em src/lib/algenib-ordens.json.`)

  const coberturaFinal = {
    atualizadoEm: new Date().toISOString(),
    total: coberturaOrdens.size,
    ordens: Array.from(coberturaOrdens).sort((a, b) => a - b),
  }
  writeFileSync(coberturaPath, JSON.stringify(coberturaFinal, null, 2), 'utf8')
  console.log(`  ✅ Cobertura de áudio atualizada: ${coberturaFinal.total} perícopes (+${novosAudios} novas com áudio no R2).\n`)

  // 3. REGENERAÇÃO DOS SHARDS ESTÁTICOS
  console.log('📦 [3/5] Regenerando shards estáticos do catálogo...')
  try {
    execSync('npx tsx scripts/shard-catalogo.ts --force', { stdio: 'inherit', cwd: root })
    console.log('  ✅ Shards regenerados com sucesso.\n')
  } catch (err: any) {
    console.error(`❌ Erro ao gerar shards: ${err.message}`)
    process.exit(1)
  }

  if (semDeploy) {
    console.log('⏸️ Modo --sem-deploy ativo. Finalizado sem compilar ou fazer upload no Cloudflare.')
    return
  }

  // 4. BUILD DO FRONTEND (REACT / VITE PWA)
  console.log('🛠️ [4/5] Compilando aplicação frontend (npm run build)...')
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: root })
    console.log('  ✅ Build concluído com sucesso.\n')
  } catch (err: any) {
    console.error(`❌ Erro no build: ${err.message}`)
    process.exit(1)
  }

  // 5. DEPLOY NO CLOUDFLARE VIA WRANGLER
  console.log('🚀 [5/5] Publicando no Cloudflare (npx wrangler deploy)...')
  try {
    execSync('npx wrangler deploy', { stdio: 'inherit', cwd: root })
    console.log('\n==================================================================')
    console.log('✨ PUBLICAÇÃO CONCLUÍDA COM SUCESSO!')
    console.log('O conteúdo textual e os áudios atualizados estão no ar em:')
    console.log('🔗 https://aipericopes.com/leitura/1630')
    console.log('==================================================================\n')
  } catch (err: any) {
    console.error(`❌ Erro no deploy da Cloudflare: ${err.message}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

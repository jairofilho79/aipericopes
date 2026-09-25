/**
 * Esteira Contínua de Produção de Áudio — Bíblia Perícopes
 * 
 * Modo Daemon / Watcher:
 *   - Monitora data/pipeline-estado.json e data/pericopes.json continuamente.
 *   - Processa perícopes na ordem canônica (seq) assim que forem marcadas com revisado: true.
 *   - Opera em 3 estágios concorrentes: TTS (Vertex AI) -> MMS_FA -> Publicação R2.
 *   - Quando a fila esvazia, entra em espera passiva (sem fechar o terminal).
 *   - Quando novas perícopes são revisadas pelo agente/subagentes, ele as pega no mesmo instante!
 *   - Quando você quiser parar, aperte Ctrl + C.
 * 
 * Uso:
 *   npx tsx scripts/esteira-continua.ts
 *   npx tsx scripts/esteira-continua.ts --concorrencia=2
 *   npx tsx scripts/esteira-continua.ts --concorrencia=3
 *   npx tsx scripts/esteira-continua.ts --livro=Jeremias (opcional, para restringir a um livro)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const estadoPath = join(root, 'data', 'pipeline-estado.json')
const pericopesPath = join(root, 'data', 'pericopes.json')

interface PericopeEstado {
  ordem: number
  livro: string
  ref: string
  revisado: boolean
  narrado: boolean
  alinhado: boolean
  publicado: boolean
  erro?: string
  atualizadoEm: string
}

type PipelineEstado = Record<string, PericopeEstado>

function carregarEstado(): PipelineEstado {
  if (!existsSync(estadoPath)) return {}
  try {
    return JSON.parse(readFileSync(estadoPath, 'utf8'))
  } catch {
    return {}
  }
}

function salvarEstado(st: PipelineEstado) {
  writeFileSync(estadoPath, JSON.stringify(st, null, 2), 'utf8')
}

function atualizarEstado(
  ordem: number,
  updates: Partial<PericopeEstado>,
  metaDefault?: { livro?: string; ref?: string },
): PericopeEstado {
  const st = carregarEstado()
  const key = ordem.toString()
  if (!st[key]) {
    st[key] = {
      ordem,
      livro: metaDefault?.livro || 'Bíblia',
      ref: metaDefault?.ref || `ordem ${ordem}`,
      revisado: false,
      narrado: false,
      alinhado: false,
      publicado: false,
      atualizadoEm: new Date().toISOString(),
      ...updates,
    }
  } else {
    Object.assign(st[key], updates, { atualizadoEm: new Date().toISOString() })
  }
  salvarEstado(st)
  return st[key]
}

async function executarNarracaoTTS(ordem: number) {
  await execAsync(`npx tsx scripts/gerar-lote.ts --ordem=${ordem} --forcar`, { maxBuffer: 10 * 1024 * 1024 })
}

async function executarAlinhamentoMMS(ordem: number) {
  const pythonPath = '/Volumes/SSD 2TB SD/dev/tts-spike/.venv/bin/python'
  await execAsync(`"${pythonPath}" scripts/alinhar-corpus.py ${ordem}`, { maxBuffer: 10 * 1024 * 1024 })
}

async function executarPublicacaoR2(ordem: number, prefixo: string = 'algenib-v4') {
  await execAsync(`npx tsx scripts/publicar-r2.ts --ordem=${ordem} --prefixo=${prefixo}`, { maxBuffer: 10 * 1024 * 1024 })
}

function hora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false })
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const args = process.argv.slice(2)
  let prefixo = 'algenib-v4'
  let concorrencia = 2
  let livroFiltro: string | null = null
  let tetoBRL: number | null = null
  let limitePericopes: number | null = null

  for (const a of args) {
    if (a.startsWith('--concorrencia=')) concorrencia = Math.max(1, parseInt(a.split('=')[1], 10))
    if (a.startsWith('--paralelo=')) concorrencia = Math.max(1, parseInt(a.split('=')[1], 10))
    if (a.startsWith('--prefixo=')) prefixo = a.split('=')[1]
    if (a.startsWith('--teto-reais=') || a.startsWith('--teto-brl=')) {
      tetoBRL = parseFloat(a.split('=')[1])
    }
    if (a.startsWith('--teto-usd=') || a.startsWith('--teto-dolares=')) {
      tetoBRL = parseFloat(a.split('=')[1]) * 5.50
    }
    if (a.startsWith('--limite=')) {
      limitePericopes = parseInt(a.split('=')[1], 10)
    }
    if (a.startsWith('--livro=')) {
      livroFiltro = a.split('=')[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    }
  }

  const catalogoBruto = JSON.parse(readFileSync(pericopesPath, 'utf8')) as any[]
  // Ordena por ordem canônica seq
  let catalogo = [...catalogoBruto].sort((a, b) => a.seq - b.seq)

  if (livroFiltro) {
    let achados = catalogo.filter((p) => p.livro.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === livroFiltro)
    if (achados.length === 0) {
      achados = catalogo.filter((p) => (p.abbrev || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === livroFiltro)
    }
    if (achados.length === 0) {
      achados = catalogo.filter((p) => p.livro.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith(livroFiltro))
    }
    catalogo = achados
  }

  const catalogoPorOrdem = new Map(catalogo.map((p) => [p.ordem, p]))
  const todasOrdens = catalogo.map((p) => p.ordem)

  console.log('==================================================================')
  console.log('  ESTEIRA CONTÍNUA (DAEMON) — BÍBLIA PERÍCOPES')
  console.log(`  Escopo: ${livroFiltro ? `Livro filtrado (${catalogo.length} perícopes)` : `Bíblia Completa (${catalogo.length} perícopes)`}`)
  console.log(`  Concorrência: ${concorrencia}x workers simultâneos por estágio`)
  if (tetoBRL !== null) {
    console.log(`  🛡️  TETO DE ORÇAMENTO ATIVO: R$ ${tetoBRL.toFixed(2)} (~US$ ${(tetoBRL / 5.50).toFixed(2)})`)
  }
  if (limitePericopes !== null) {
    console.log(`  🛡️  LIMITE DE PERÍCOPES: máximo ${limitePericopes} perícopes nesta sessão`)
  }
  console.log(`  Prefixo R2: ${prefixo}`)
  console.log('  Status: Rodando continuamente. Pressione Ctrl + C para encerrar.')
  console.log('==================================================================\n')

  let rodando = true
  let totalPublicadas = 0

  process.on('SIGINT', () => {
    console.log('\n\n==================================================================')
    console.log(`🛑 Esteira contínua interrompida pelo usuário.`)
    console.log(`Perícopes publicadas nesta sessão: ${totalPublicadas}`)
    console.log('Nenhum progresso foi perdido (tudo salvo no R2 e pipeline-estado.json).')
    console.log('\nPara sincronizar durações e colocar o site no ar agora:')
    console.log('  1. npm run audio:duracoes')
    console.log('  2. npm run build (ou npm run deploy)')
    console.log('==================================================================\n')
    process.exit(0)
  })

  const emTTS = new Set<number>()
  const emAlinhamento = new Set<number>()
  const emPublicacao = new Set<number>()

  const falhasTTS = new Map<number, number>()
  const falhasMMS = new Map<number, number>()
  const falhasR2 = new Map<number, number>()
  const MAX_FALHAS = 2

  let ultimoLogEsperaTTS = 0
  let custoAcumuladoSessaoBRL = 0
  let pericopeCountSessao = 0

  function estimarCustoBRL(ordem: number): number {
    const f = join(root, 'data', 'enriched', `${ordem}.json`)
    if (!existsSync(f)) return 0.28
    try {
      const d = JSON.parse(readFileSync(f, 'utf8'))
      const chars = (d.titulo_pericope_pt || '').length + (d.contexto_historico_literario || '').length + (d.texto || '').length + (d.resenha || '').length + (d.perguntas_reflexao?.join('\n') || '').length
      return (chars / 1000000) * 16.0 * 5.50
    } catch {
      return 0.28
    }
  }

  let tetoAtingido = false

  // WORKER 1: NARRAÇÃO TTS
  async function workerTTS(workerId: number) {
    const rotulo = concorrencia > 1 ? `#W${workerId}` : ''
    while (rodando) {
      if ((tetoBRL !== null && custoAcumuladoSessaoBRL >= tetoBRL) || (limitePericopes !== null && pericopeCountSessao >= limitePericopes)) {
        tetoAtingido = true
        if (workerId === 1) {
          console.log(`\n🛑 [TETO/LIMITE ATINGIDO] Limite alcançado nesta sessão (Gasto: R$ ${custoAcumuladoSessaoBRL.toFixed(2)} | Perícopes: ${pericopeCountSessao}). Aguardando alinhamento e upload das perícopes pendentes...\n`)
        }
        break
      }

      const estadoAtual = carregarEstado()
      const pendente = todasOrdens.find((o) => {
        const st = estadoAtual[o.toString()]
        const f = falhasTTS.get(o) || 0
        return st && st.revisado && !st.narrado && !emTTS.has(o) && f < MAX_FALHAS
      })

      if (pendente === undefined) {
        if (workerId === 1 && Date.now() - ultimoLogEsperaTTS > 20000) {
          const revisados = Object.values(estadoAtual).filter((s) => s.revisado).length
          const publicados = Object.values(estadoAtual).filter((s) => s.publicado).length
          console.log(`[${hora()}] 💤 [Fila Contínua] Sem perícopes pendentes de narração no momento (${publicados}/${revisados} publicadas). Aguardando novos materiais...`)
          ultimoLogEsperaTTS = Date.now()
        }
        await delay(3000)
        continue
      }

      emTTS.add(pendente)
      const t0 = Date.now()
      console.log(`[${hora()}] 🎙️  [1/3 Narração ${rotulo}] [${pendente}] INICIANDO síntese TTS Algenib v3...`)

      try {
        await executarNarracaoTTS(pendente)
        const dur = ((Date.now() - t0) / 1000).toFixed(1)
        atualizarEstado(pendente, { narrado: true, erro: undefined })
        const custoDesta = estimarCustoBRL(pendente)
        custoAcumuladoSessaoBRL += custoDesta
        pericopeCountSessao++
        const infoTeto = tetoBRL !== null
          ? ` | 💰 Sessão: R$ ${custoAcumuladoSessaoBRL.toFixed(2)} / R$ ${tetoBRL.toFixed(2)} (Restam: R$ ${Math.max(0, tetoBRL - custoAcumuladoSessaoBRL).toFixed(2)})`
          : ` | 💰 Sessão: R$ ${custoAcumuladoSessaoBRL.toFixed(2)} acumulados`
        console.log(`[${hora()}] 🎙️  [1/3 Narração ${rotulo}] [${pendente}] CONCLUÍDA em ${dur}s (~R$ ${custoDesta.toFixed(2)})${infoTeto}`)
      } catch (err: any) {
        const f = (falhasTTS.get(pendente) || 0) + 1
        falhasTTS.set(pendente, f)
        console.error(`[${hora()}] ❌ [1/3 Narração ${rotulo}] [${pendente}] ERRO (tentativa ${f}/${MAX_FALHAS}): ${err.message}`)
        atualizarEstado(pendente, { erro: err.message })
        if (f >= MAX_FALHAS) {
          console.error(`[${hora()}] ⚠️  [1/3 Narração ${rotulo}] [${pendente}] Pulando após ${f} falhas para não bloquear a fila.`)
        }
      } finally {
        emTTS.delete(pendente)
      }
      await delay(100)
    }
  }

  // WORKER 2: ALINHAMENTO ACÚSTICO MMS_FA
  async function workerMMS(workerId: number) {
    const rotulo = concorrencia > 1 ? `#W${workerId}` : ''
    while (rodando) {
      const estadoAtual = carregarEstado()
      const pendente = todasOrdens.find((o) => {
        const st = estadoAtual[o.toString()]
        const f = falhasMMS.get(o) || 0
        return st && st.narrado && !st.alinhado && !emAlinhamento.has(o) && f < MAX_FALHAS
      })

      if (pendente === undefined) {
        if (tetoAtingido && emTTS.size === 0) {
          break
        }
        await delay(2000)
        continue
      }

      emAlinhamento.add(pendente)
      const t0 = Date.now()
      console.log(`[${hora()}] ⏱️  [2/3 Alinhamento ${rotulo}] [${pendente}] INICIANDO alinhamento MMS_FA...`)

      try {
        await executarAlinhamentoMMS(pendente)
        const dur = ((Date.now() - t0) / 1000).toFixed(1)
        atualizarEstado(pendente, { alinhado: true, erro: undefined })
        console.log(`[${hora()}] ⏱️  [2/3 Alinhamento ${rotulo}] [${pendente}] CONCLUÍDO em ${dur}s`)
      } catch (err: any) {
        const f = (falhasMMS.get(pendente) || 0) + 1
        falhasMMS.set(pendente, f)
        console.error(`[${hora()}] ❌ [2/3 Alinhamento ${rotulo}] [${pendente}] ERRO (tentativa ${f}/${MAX_FALHAS}): ${err.message}`)
        atualizarEstado(pendente, { erro: err.message })
        if (f >= MAX_FALHAS) {
          console.error(`[${hora()}] ⚠️  [2/3 Alinhamento ${rotulo}] [${pendente}] Pulando após ${f} falhas para não bloquear a fila.`)
        }
      } finally {
        emAlinhamento.delete(pendente)
      }
      await delay(100)
    }
  }

  // WORKER 3: PUBLICAÇÃO R2
  async function workerR2(workerId: number) {
    const rotulo = concorrencia > 1 ? `#W${workerId}` : ''
    while (rodando) {
      const estadoAtual = carregarEstado()
      const pendente = todasOrdens.find((o) => {
        const st = estadoAtual[o.toString()]
        const f = falhasR2.get(o) || 0
        return st && st.alinhado && !st.publicado && !emPublicacao.has(o) && f < MAX_FALHAS
      })

      if (pendente === undefined) {
        if (tetoAtingido && emTTS.size === 0 && emAlinhamento.size === 0) {
          break
        }
        await delay(2000)
        continue
      }

      emPublicacao.add(pendente)
      const meta = catalogoPorOrdem.get(pendente)
      const t0 = Date.now()
      console.log(`[${hora()}] ☁️  [3/3 Publicação ${rotulo}] [${pendente}] INICIANDO upload R2...`)

      try {
        await executarPublicacaoR2(pendente, prefixo)
        const dur = ((Date.now() - t0) / 1000).toFixed(1)
        atualizarEstado(pendente, { publicado: true, erro: undefined })
        totalPublicadas++
        console.log(`[${hora()}] ☁️  [3/3 Publicação ${rotulo}] [${pendente}] CONCLUÍDA em ${dur}s`)
        console.log(`\n==================================================================`)
        console.log(`✨ [${meta?.livro || 'Bíblia'} ${pendente}] ✅ PUBLICADO E DISPONÍVEL NO AR COM REALCE!`)
        console.log(`🔗 https://aipericopes.com/leitura/${pendente}`)
        console.log(`==================================================================\n`)
      } catch (err: any) {
        const f = (falhasR2.get(pendente) || 0) + 1
        falhasR2.set(pendente, f)
        console.error(`[${hora()}] ❌ [3/3 Publicação ${rotulo}] [${pendente}] ERRO (tentativa ${f}/${MAX_FALHAS}): ${err.message}`)
        atualizarEstado(pendente, { erro: err.message })
        if (f >= MAX_FALHAS) {
          console.error(`[${hora()}] ⚠️  [3/3 Publicação ${rotulo}] [${pendente}] Pulando após ${f} falhas para não bloquear a fila.`)
        }
      } finally {
        emPublicacao.delete(pendente)
      }
      await delay(100)
    }
  }

  const workers = [
    ...Array.from({ length: concorrencia }, (_, i) => workerTTS(i + 1)),
    ...Array.from({ length: concorrencia }, (_, i) => workerMMS(i + 1)),
    ...Array.from({ length: concorrencia }, (_, i) => workerR2(i + 1)),
  ]

  await Promise.all(workers)

  if (tetoAtingido) {
    console.log('\n==================================================================')
    console.log(`🎉 EXECUÇÃO CONCLUÍDA COM TRAVA DE ORÇAMENTO!`)
    console.log(`   Total gasto nesta sessão: R$ ${custoAcumuladoSessaoBRL.toFixed(2)} (~US$ ${(custoAcumuladoSessaoBRL / 5.50).toFixed(2)})`)
    console.log(`   Perícopes narradas e publicadas nesta sessão: ${pericopeCountSessao}`)
    console.log(`   Todos os arquivos foram alinhados e salvos no Cloudflare R2 com segurança.`)
    console.log('==================================================================\n')
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

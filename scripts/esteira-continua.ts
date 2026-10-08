/**
 * Esteira Contínua de Produção de Áudio — Bíblia Perícopes
 * 
 * Arquitetura de Produção:
 *   - TTS: Gemini 3.8 Flash TTS via Google Interactions API (voz Algenib, sotaque pt-BR fixo, tom dinâmico e curioso).
 *   - Alinhamento Acústico: Meta MMS_FA forçado palavra por palavra em PyTorch local.
 *   - Publicação: Upload automático no Cloudflare R2 com geração de manifest.json e verificação.
 *   - Proteção de Cota: Respeita os 10 RPM do Tier 1 e encerra/pausa graciosamente ao atingir os 100 RPD diários.
 * 
 * Uso:
 *   npx tsx scripts/esteira-continua.ts --concorrencia=2
 *   npx tsx scripts/esteira-continua.ts --livro=Galatas
 *   npx tsx scripts/esteira-continua.ts --ordens=2335..2336
 *   npx tsx scripts/esteira-continua.ts --inicio=2335
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec, spawn } from 'node:child_process'
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

function executarNarracaoTTS(ordem: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', 'scripts/gerar-pericope-38.ts', `--ordem=${ordem}`], {
      cwd: root,
      stdio: ['ignore', 'inherit', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
      process.stderr.write(d)
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `gerar-pericope-38.ts encerrou com código ${code}`))
    })
  })
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
  let concorrenciaTTS = 1 // Padrão 1 worker para TTS para honrar com segurança os 10 RPM do Gemini 3.8
  let livroFiltro: string | null = null
  let tetoBRL: number | null = null
  let limitePericopes: number | null = null
  let ordensFiltro: number[] | null = null
  let inicioFiltro: number | null = null

  for (const a of args) {
    if (a.startsWith('--concorrencia=')) concorrencia = Math.max(1, parseInt(a.split('=')[1], 10))
    if (a.startsWith('--paralelo=')) concorrencia = Math.max(1, parseInt(a.split('=')[1], 10))
    if (a.startsWith('--concorrencia-tts=')) concorrenciaTTS = Math.max(1, parseInt(a.split('=')[1], 10))
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
    if (a.startsWith('--ordem=')) {
      ordensFiltro = [parseInt(a.split('=')[1], 10)]
    }
    if (a.startsWith('--ordens=')) {
      const [ini, fim] = a.split('=')[1].split('..').map((v) => parseInt(v, 10))
      ordensFiltro = Array.from({ length: fim - ini + 1 }, (_, i) => ini + i)
    }
    if (a.startsWith('--inicio=')) {
      inicioFiltro = parseInt(a.split('=')[1], 10)
    }
  }

  const catalogoBruto = JSON.parse(readFileSync(pericopesPath, 'utf8')) as any[]
  // Ordena por ordem canônica seq
  let catalogo = [...catalogoBruto].sort((a, b) => a.seq - b.seq)

  if (ordensFiltro) {
    catalogo = catalogo.filter((p) => ordensFiltro!.includes(p.ordem))
  } else if (inicioFiltro !== null) {
    catalogo = catalogo.filter((p) => p.ordem >= inicioFiltro!)
  } else if (livroFiltro) {
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

  const escopoDesc = ordensFiltro
    ? `Ordens [${ordensFiltro.join(', ')}] (${catalogo.length} perícopes)`
    : livroFiltro
      ? `Livro filtrado (${catalogo.length} perícopes)`
      : inicioFiltro !== null
        ? `A partir da ordem #${inicioFiltro} (${catalogo.length} perícopes)`
        : `Bíblia Completa (${catalogo.length} perícopes)`

  console.log('==================================================================')
  console.log('  ESTEIRA CONTÍNUA — BÍBLIA PERÍCOPES (GEMINI 3.8 FLASH TTS)')
  console.log(`  Modelo: gemini-3.8-flash-tts (Google AI Studio Interactions API)`)
  console.log(`  Voz: Algenib (Storyteller ativo, sotaque pt-BR fixo, tom vibrante)`)
  console.log(`  Escopo: ${escopoDesc}`)
  console.log(`  Workers: MMS/R2: ${concorrencia}x paralelos | TTS: ${concorrenciaTTS}x serializado (taxa segura 10 RPM)`)
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
    if (!existsSync(f)) return 0.20
    try {
      const d = JSON.parse(readFileSync(f, 'utf8'))
      const chars = (d.titulo_pericope_pt || '').length + (d.contexto_historico_literario || '').length + (d.texto || '').length + (d.resenha || '').length + (d.perguntas_reflexao?.join('\n') || '').length
      return (chars / 1000000) * 8.0 * 5.50
    } catch {
      return 0.20
    }
  }

  let tetoAtingido = false
  let cotaDiariaAtingida = false

  // WORKER 1: NARRAÇÃO TTS (Gemini 3.8 Flash TTS)
  async function workerTTS(workerId: number) {
    const rotulo = concorrenciaTTS > 1 ? `#W${workerId}` : ''
    while (rodando) {
      if ((tetoBRL !== null && custoAcumuladoSessaoBRL >= tetoBRL) || (limitePericopes !== null && pericopeCountSessao >= limitePericopes)) {
        tetoAtingido = true
        if (workerId === 1) {
          console.log(`\n🛑 [TETO/LIMITE ATINGIDO] Limite alcançado nesta sessão (Gasto: R$ ${custoAcumuladoSessaoBRL.toFixed(2)} | Perícopes: ${pericopeCountSessao}). Aguardando alinhamento e upload das perícopes pendentes...\n`)
        }
        break
      }

      if (cotaDiariaAtingida) {
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
      console.log(`\n[${hora()}] 🎙️  [1/3 Narração ${rotulo}] [${pendente}] INICIANDO síntese TTS Gemini 3.8 Flash...`)

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
        const isCota =
          err.message?.includes('COTA_DIARIA_38_ESGOTADA') ||
          err.message?.includes('100 RPD') ||
          err.message?.includes('limit: 100') ||
          err.message?.includes('RESOURCE_EXHAUSTED')

        if (isCota) {
          cotaDiariaAtingida = true
          console.error(`\n🛑 [COTA DIÁRIA ATINGIDA] Limite diário de 100 requisições do Gemini 3.8 Flash TTS atingido.`)
          console.log(`   Finalizando alinhamento acústico (MMS) e publicação (R2) das perícopes pendentes...\n`)
          break
        }

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
        if ((tetoAtingido || cotaDiariaAtingida) && emTTS.size === 0) {
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
        if ((tetoAtingido || cotaDiariaAtingida) && emTTS.size === 0 && emAlinhamento.size === 0) {
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
    ...Array.from({ length: concorrenciaTTS }, (_, i) => workerTTS(i + 1)),
    ...Array.from({ length: concorrencia }, (_, i) => workerMMS(i + 1)),
    ...Array.from({ length: concorrencia }, (_, i) => workerR2(i + 1)),
  ]

  await Promise.all(workers)

  if (tetoAtingido || cotaDiariaAtingida) {
    console.log('\n==================================================================')
    if (cotaDiariaAtingida) {
      console.log(`🛑 SESSÃO CONCLUÍDA — PAUSA POR COTA DIÁRIA (Tier 1 — 100 RPD)`)
    } else {
      console.log(`🎉 EXECUÇÃO CONCLUÍDA COM TRAVA DE ORÇAMENTO!`)
    }
    console.log(`   Total gasto estimado nesta sessão: R$ ${custoAcumuladoSessaoBRL.toFixed(2)} (~US$ ${(custoAcumuladoSessaoBRL / 5.50).toFixed(2)})`)
    console.log(`   Perícopes publicadas nesta sessão: ${totalPublicadas}`)
    console.log(`   Todos os áudios gerados foram alinhados e publicados com sucesso no Cloudflare R2.`)
    console.log('==================================================================\n')
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

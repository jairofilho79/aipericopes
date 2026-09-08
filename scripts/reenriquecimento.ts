/**
 * Fila em disco do reenriquecimento editorial (Sessão 3).
 *
 * **Por que uma fila em disco.** Quem invoca subagent é o Claude da sessão, não
 * um script. Então a orquestração *é* a sessão — e a sessão cai, é interrompida
 * e continua noutro dia. O que precisa sobreviver a isso mora aqui:
 *
 * - pendente  = tem `entrada/<ordem>.json` e não tem `saida/<ordem>.json`
 * - em curso  = existe o diretório `travas/<ordem>` (criado com mkdir, atômico)
 * - feito     = existe `saida/<ordem>.json` e ele passou no portão
 *
 * **A lição que veio do lote de TTS e vale aqui:** a trava por mkdir NÃO é
 * devolvida quando o processo é morto — só quando há exceção. Depois de
 * qualquer queda, rode `soltar-travas` antes de religar, senão a fila trava
 * inteira sem ninguém trabalhando.
 *
 * Usage:
 *   npx tsx scripts/reenriquecimento.ts preparar
 *   npx tsx scripts/reenriquecimento.ts status
 *   npx tsx scripts/reenriquecimento.ts claim --n=10 --lotes=8 [--amostra]
 *   npx tsx scripts/reenriquecimento.ts aplicar
 *   npx tsx scripts/reenriquecimento.ts soltar-travas
 */
import {
  mkdirSync,
  statSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  appendFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validarMaterial, type Material } from './validar-material.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export type Entrada = {
  ordem: number
  livro: string
  abbrev: string
  referencia: string
  titulo_provisorio: string
  texto: string
  sobrescrito?: string
}

export type Bruta = {
  ordem: number
  livro: string
  abbrev: string
  capitulo_inicio: number
  versiculo_inicio: number
  capitulo_fim: number
  versiculo_fim: number
  texto: string
  sobrescrito?: string
  titulo_en?: string
  titulo_provisorio?: string
}

export function referencia(r: Bruta): string {
  const mesmoCap = r.capitulo_inicio === r.capitulo_fim
  if (mesmoCap && r.versiculo_inicio === r.versiculo_fim) {
    return `${r.abbrev} ${r.capitulo_inicio}:${r.versiculo_inicio}`
  }
  if (mesmoCap) return `${r.abbrev} ${r.capitulo_inicio}:${r.versiculo_inicio}-${r.versiculo_fim}`
  return `${r.abbrev} ${r.capitulo_inicio}:${r.versiculo_inicio}—${r.capitulo_fim}:${r.versiculo_fim}`
}

/**
 * A entrada carrega APENAS a perícope: texto bíblico, sobrescrito e um título
 * provisório. Nenhum material antigo entra — nem o das 2.628 do gemini, nem o
 * das 195 novas, que era a última exceção e caiu por decisão do dono: material
 * escrito sobre outra tradução traz junto o contexto dela, e conhecimento
 * tácito herdado é o pior de todos, porque ninguém sabe de onde veio.
 *
 * O título é deliberadamente *provisório* — para as antigas, o título em inglês
 * do dataset KJV; para as novas, o rótulo de trabalho da tabela de cortes.
 * Nunca o título em português já escrito, que travaria a reescrita no que
 * existe hoje.
 */
export function montarEntrada(r: Bruta): Entrada {
  return {
    ordem: r.ordem,
    livro: r.livro,
    abbrev: r.abbrev,
    referencia: referencia(r),
    titulo_provisorio: r.titulo_provisorio ?? r.titulo_en ?? '',
    texto: r.texto,
    ...(r.sobrescrito ? { sobrescrito: r.sobrescrito } : {}),
  }
}

export type Dirs = {
  base: string
  entrada: string
  saida: string
  travas: string
  lotes: string
  rejeitados: string
}

export function dirs(base: string): Dirs {
  return {
    base,
    entrada: join(base, 'entrada'),
    saida: join(base, 'saida'),
    travas: join(base, 'travas'),
    lotes: join(base, 'lotes'),
    rejeitados: join(base, 'rejeitados.jsonl'),
  }
}

export function criarDirs(d: Dirs): void {
  for (const p of [d.base, d.entrada, d.saida, d.travas, d.lotes]) mkdirSync(p, { recursive: true })
}

function ordens(dir: string): number[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => Number(f.slice(0, -5)))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b)
}

function travadas(d: Dirs): Set<number> {
  if (!existsSync(d.travas)) return new Set()
  return new Set(readdirSync(d.travas).map(Number).filter(Number.isInteger))
}

/** Tem entrada, não tem saída e não está travada. */
export function pendentes(d: Dirs): number[] {
  const feitas = new Set(ordens(d.saida))
  const emCurso = travadas(d)
  return ordens(d.entrada).filter((o) => !feitas.has(o) && !emCurso.has(o))
}

/**
 * `mkdir` sem `recursive` é atômico: dois processos pedindo a mesma ordem, só
 * um recebe `true`. É esta propriedade que deixa a fila ser trabalhada em
 * paralelo sem coordenação.
 */
export function travar(d: Dirs, ordem: number): boolean {
  try {
    mkdirSync(join(d.travas, String(ordem)))
    return true
  } catch {
    return false
  }
}

export function destravar(d: Dirs, ordem: number): void {
  rmSync(join(d.travas, String(ordem)), { recursive: true, force: true })
}

/**
 * Idade mínima de uma trava para ela ser considerada órfã. Um lote leva ~10
 * min; 30 min é folga suficiente para o subagent mais lento.
 */
export const IDADE_TRAVA_ORFA_MS = 30 * 60 * 1000

/**
 * Trava sem saída é trava órfã: processo morto não devolve mkdir.
 *
 * **Mas trava recente não é órfã — é trabalho em curso.** Soltar a trava de um
 * subagent vivo faz a perícope ser reivindicada por outro, e os dois escrevem o
 * mesmo arquivo. Aconteceu uma vez: dei uma rodada por encerrada com 9 de 10
 * lotes reportados, soltei as travas, e a perícope 490 foi escrita duas vezes.
 * Por isso a idade da trava é a guarda, e não a minha contagem de lotes.
 */
export function soltarTravasOrfas(d: Dirs, idadeMinimaMs = IDADE_TRAVA_ORFA_MS): number[] {
  const feitas = new Set(ordens(d.saida))
  const agora = Date.now()
  const orfas = [...travadas(d)]
    .filter((o) => !feitas.has(o))
    .filter((o) => {
      // Idade zero significa "solte tudo", e é o que o teste usa. Comparar a
      // subtração com 0 não serve: o mtime do arquivo tem resolução mais fina
      // que `Date.now()`, então a diferença pode sair negativa por uma fração.
      if (idadeMinimaMs <= 0) return true
      try {
        return agora - statSync(join(d.travas, String(o))).mtimeMs >= idadeMinimaMs
      } catch {
        return false
      }
    })
    .sort((a, b) => a - b)
  for (const o of orfas) destravar(d, o)
  return orfas
}

/**
 * Escolhe `n` pendentes espalhadas pelos livros em vez das `n` primeiras. Serve
 * ao piloto: 10 perícopes de Gênesis não dizem nada sobre o Saltério nem sobre
 * uma epístola.
 */
export function espalharPorLivro(d: Dirs, candidatos: number[], n: number): number[] {
  const porLivro = new Map<string, number[]>()
  for (const o of candidatos) {
    const e = JSON.parse(readFileSync(join(d.entrada, `${o}.json`), 'utf8')) as Entrada
    const lista = porLivro.get(e.abbrev) ?? []
    lista.push(o)
    porLivro.set(e.abbrev, lista)
  }
  const filas = [...porLivro.values()]
  const escolhidas: number[] = []
  // Round-robin: um de cada livro por volta, até completar n ou esgotar tudo.
  for (let volta = 0; escolhidas.length < n; volta++) {
    let pegou = false
    for (const fila of filas) {
      if (volta >= fila.length) continue
      escolhidas.push(fila[volta])
      pegou = true
      if (escolhidas.length === n) return escolhidas
    }
    if (!pegou) break
  }
  return escolhidas
}

export type Lote = { id: string; ordens: number[]; arquivo: string }

/** Trava e grava `lotes/<id>.json` com as entradas inteiras — o subagent lê um arquivo só. */
export function montarLote(d: Dirs, candidatos: number[], id: string): Lote | null {
  const travadasAgora: number[] = []
  for (const o of candidatos) if (travar(d, o)) travadasAgora.push(o)
  if (!travadasAgora.length) return null
  const entradas = travadasAgora.map(
    (o) => JSON.parse(readFileSync(join(d.entrada, `${o}.json`), 'utf8')) as Entrada,
  )
  const arquivo = join(d.lotes, `${id}.json`)
  writeFileSync(arquivo, JSON.stringify({ id, entradas }, null, 2))
  return { id, ordens: travadasAgora, arquivo }
}

export type Veredito = { ordem: number; ok: boolean; problemas: string[]; avisos: string[] }

/**
 * Portão de qualidade. O que reprova volta para a fila — a saída é apagada e a
 * trava devolvida — e o motivo fica registrado em `rejeitados.jsonl`, para o
 * prompt ser corrigido em vez de o erro ser repetido.
 */
export function conferirSaidas(d: Dirs, alvos?: number[]): Veredito[] {
  const lista = alvos ?? ordens(d.saida)
  const vereditos: Veredito[] = []
  for (const ordem of lista) {
    const fSaida = join(d.saida, `${ordem}.json`)
    if (!existsSync(fSaida)) {
      vereditos.push({ ordem, ok: false, problemas: ['sem saída'], avisos: [] })
      continue
    }
    const entrada = JSON.parse(readFileSync(join(d.entrada, `${ordem}.json`), 'utf8')) as Entrada
    const bruto = readFileSync(fSaida, 'utf8')
    let material: Material
    try {
      material = JSON.parse(bruto) as Material
    } catch (e) {
      vereditos.push({ ordem, ok: false, problemas: [`JSON inválido: ${(e as Error).message}`], avisos: [] })
      continue
    }
    const r = validarMaterial(entrada, material, bruto)
    vereditos.push({ ordem, ok: r.problemas.length === 0, ...r })
  }
  return vereditos
}

/** Devolve à fila o que reprovou: apaga a saída, solta a trava, registra o motivo. */
export function devolverReprovadas(d: Dirs, vereditos: Veredito[]): number {
  let n = 0
  for (const v of vereditos) {
    if (v.ok) continue
    rmSync(join(d.saida, `${v.ordem}.json`), { force: true })
    destravar(d, v.ordem)
    appendFileSync(
      d.rejeitados,
      JSON.stringify({ ordem: v.ordem, quando: new Date().toISOString(), problemas: v.problemas }) + '\n',
    )
    n++
  }
  return n
}

// ————————————————————————————— CLI —————————————————————————————

function carregarBrutas(): Bruta[] {
  return readFileSync(join(root, 'data/raw-pericopes.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Bruta)
}

function preparar(d: Dirs): void {
  criarDirs(d)
  let n = 0
  for (const r of carregarBrutas()) {
    writeFileSync(join(d.entrada, `${r.ordem}.json`), JSON.stringify(montarEntrada(r), null, 2))
    n++
  }
  console.log(`${n} entradas em ${d.entrada}`)
}

function status(d: Dirs): void {
  const total = ordens(d.entrada).length
  const feitas = ordens(d.saida).length
  const emCurso = travadas(d).size
  const orfas = [...travadas(d)].filter((o) => !existsSync(join(d.saida, `${o}.json`))).length
  console.log(
    `entradas ${total} · prontas ${feitas} (${((100 * feitas) / Math.max(1, total)).toFixed(1)}%) · travadas ${emCurso} (órfãs ${orfas}) · pendentes ${pendentes(d).length}`,
  )
}

/**
 * Carimbo de segundo + sufixo aleatório. Só o segundo não basta: dois `claim`
 * disparados na mesma batida geravam o mesmo id, e o segundo lote sobrescrevia
 * o arquivo do primeiro — as travas ficavam de pé sem lote para trabalhá-las.
 */
function novoId(sufixo: string): string {
  const carimbo = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  return `${carimbo}-${Math.random().toString(36).slice(2, 6)}-${sufixo}`
}

function claim(d: Dirs, n: number, quantos: number, amostra: boolean, escolhidas?: number[]): void {
  if (escolhidas?.length) {
    const lote = montarLote(d, escolhidas, novoId('manual'))
    if (!lote) return console.log('nenhuma das ordens pedidas estava livre')
    return console.log(`${lote.arquivo}\t${lote.ordens.length} perícopes\t${lote.ordens.join(',')}`)
  }
  const disponiveis = pendentes(d)
  if (!disponiveis.length) {
    console.log('fila vazia')
    return
  }
  for (let i = 0; i < quantos; i++) {
    const restantes = pendentes(d)
    if (!restantes.length) break
    const candidatos = amostra ? espalharPorLivro(d, restantes, n) : restantes.slice(0, n)
    const lote = montarLote(d, candidatos, novoId(String(i + 1)))
    if (!lote) break
    console.log(`${lote.arquivo}\t${lote.ordens.length} perícopes\t${lote.ordens.join(',')}`)
  }
}

function aplicar(d: Dirs): void {
  const vereditos = conferirSaidas(d)
  const aprovadas = vereditos.filter((v) => v.ok)
  const reprovadas = vereditos.filter((v) => !v.ok)
  for (const v of aprovadas) {
    const material = JSON.parse(readFileSync(join(d.saida, `${v.ordem}.json`), 'utf8')) as Material
    const entrada = JSON.parse(readFileSync(join(d.entrada, `${v.ordem}.json`), 'utf8')) as Entrada
    // O cache do catálogo guarda material + estrutura; `texto` vem do raw na
    // montagem, mas gravar o texto sobre o qual isto foi escrito é o que deixa
    // `cacheDesatualizado` funcionar.
    writeFileSync(
      join(root, 'data/enriched', `${v.ordem}.json`),
      JSON.stringify(
        {
          ordem: v.ordem,
          livro: entrada.livro,
          abbrev: entrada.abbrev,
          texto: entrada.texto,
          ...(entrada.sobrescrito ? { sobrescrito: entrada.sobrescrito } : {}),
          titulo_pericope_pt: material.titulo_pericope_pt,
          contexto_historico_literario: material.contexto_historico_literario,
          resenha: material.resenha,
          perguntas_reflexao: material.perguntas_reflexao,
          topicos_pregar: material.topicos_pregar,
        },
        null,
        2,
      ),
    )
  }
  const devolvidas = devolverReprovadas(d, reprovadas)
  const avisos = vereditos.flatMap((v) => v.avisos.map((a) => `${v.ordem}: ${a}`))
  console.log(`aprovadas ${aprovadas.length} · reprovadas ${devolvidas} (voltaram para a fila)`)
  for (const r of reprovadas) console.log(`  ❌ ${r.ordem}: ${r.problemas.join(' | ')}`)
  if (avisos.length) {
    console.log(`\n⚠️  ${avisos.length} citação(ões) a conferir:`)
    for (const a of avisos.slice(0, 30)) console.log(`  ${a}`)
  }
}

function main() {
  const d = dirs(join(root, 'data/reenriquecimento'))
  const cmd = process.argv[2]
  const flag = (nome: string, padrao: number) => {
    const a = process.argv.find((x) => x.startsWith(`--${nome}=`))
    return a ? Number(a.split('=')[1]) : padrao
  }
  switch (cmd) {
    case 'preparar':
      return preparar(d)
    case 'status':
      return status(d)
    case 'claim': {
      const arg = process.argv.find((x) => x.startsWith('--ordens='))
      const escolhidas = arg ? arg.split('=')[1].split(',').map(Number) : undefined
      return claim(d, flag('n', 10), flag('lotes', 1), process.argv.includes('--amostra'), escolhidas)
    }
    case 'aplicar':
      return aplicar(d)
    case 'soltar-travas': {
      const soltas = soltarTravasOrfas(d)
      console.log(`${soltas.length} trava(s) órfã(s) devolvida(s)${soltas.length ? ': ' + soltas.join(',') : ''}`)
      return
    }
    default:
      console.error('comandos: preparar | status | claim | aplicar | soltar-travas')
      process.exit(2)
  }
}

if (process.argv[1]?.endsWith('reenriquecimento.ts')) main()

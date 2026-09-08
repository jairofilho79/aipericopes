/**
 * A sobra: versículo que está na perícope e que nenhum campo trata.
 *
 * O caça-invenção achou 25. Não é mentira — é silêncio. O material escolheu
 * uma tese boa e ela não alcançou o fim do trecho. Em Êx 3 a tese é a revelação
 * do nome na sarça, e o resumo salta de v.13-15 direto para v.21-22: o plano de
 * abordagem a Faraó e a previsão da resistência dele não aparecem em lugar
 * nenhum. Quem ouvir a narração inteira vai ler esses versículos sem ter
 * recebido uma palavra sobre eles.
 *
 * **Não há espaço, e isso governa tudo aqui.** As 25 já estão no teto: contexto
 * 2 parágrafos de 2, resenha 4 de 4. O que passa do teto é DESCARTADO pela
 * leitura (`paragraphize`) e some da tela, do áudio e do realce sem erro
 * nenhum. Então cobrir uma sobra é caber DENTRO dos parágrafos que já existem —
 * apertar o que está frouxo e abrir uma ou duas frases. Por isso o portão
 * exige que o número de parágrafos não mude, e recusa o campo que inche mais de
 * 25%: crescer muito é sinal de que a tese foi trocada, e não de que a sobra
 * foi coberta.
 *
 * **Este é o único lugar desta sessão onde se ACRESCENTA material**, e por isso
 * é o mais perigoso: acrescentar é onde a invenção nasce. Toda frase nova
 * declara a citação literal do texto em que se apoia, e o portão confere que
 * ela existe.
 *
 * Usage:
 *   npx tsx scripts/sobra-fila.ts preparar
 *   npx tsx scripts/sobra-fila.ts claim --tamanho=9
 *   npx tsx scripts/sobra-fila.ts aplicar
 *   npx tsx scripts/sobra-fila.ts status
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarDirs, dirs, montarLote } from './reenriquecimento.ts'
import { maiorTrechoRepetido, validarMaterial, type Material } from './validar-material.ts'
import { penduradaSemPagar, todasPenduradas } from './frase-pendurada.ts'
import type { Achado } from './invencao-fila.ts'

const root = join(import.meta.dirname, '..')
export const BASE = join(root, 'data/sobra')

export type VeredictoSobra = {
  ordem: number
  campo: 'contexto_historico_literario' | 'resenha'
  novo: string
  /** Citação literal do texto da perícope que sustenta o que foi acrescentado. */
  apoio: string
}

const paragrafos = (t: string) =>
  (t ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\s*\n+/)
    .map((x) => x.trim())
    .filter(Boolean).length

const chave = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function aplicarSobra(
  p: Record<string, unknown>,
  v: VeredictoSobra,
  entrada: { texto: string },
): void {
  const antes = String(p[v.campo] ?? '')
  const novo = v.novo?.trim()
  if (!novo) throw new Error(`${v.ordem}: veredito sem texto novo`)
  if (novo === antes) throw new Error(`${v.ordem}: o campo voltou igual`)
  if (!v.apoio?.trim())
    throw new Error(`${v.ordem}: sem apoio — acrescentar sem citar é onde a invenção nasce`)

  // O apoio TEM de citar, e a citação tem de estar no texto desta perícope.
  // Nas outras filas a citação é opcional porque lá se tira; aqui se põe.
  const citacoes = [...v.apoio.matchAll(/[“"]([^”"]{10,})[”"]/g)].map((m) => m[1])
  if (!citacoes.length)
    throw new Error(`${v.ordem}: o apoio não cita nada — ponha entre aspas o trecho do texto`)
  for (const c of citacoes)
    if (!chave(String(entrada.texto)).includes(chave(c)))
      throw new Error(`${v.ordem}: o apoio cita "${c.slice(0, 45)}…", que não está no texto desta perícope`)

  // O teto da leitura. Passar dele não dá erro: apaga o fim do campo da tela,
  // do áudio e do realce. Um parágrafo a mais aqui perderia MAIS do que a
  // sobra que ele veio cobrir.
  if (paragrafos(novo) !== paragrafos(antes))
    throw new Error(
      `${v.ordem}: o campo foi de ${paragrafos(antes)} para ${paragrafos(novo)} parágrafos — o teto da leitura descarta o excedente; caiba dentro dos que já existem`,
    )
  if (novo.length > antes.length * 1.25)
    throw new Error(
      `${v.ordem}: o campo cresceu ${Math.round((novo.length / antes.length - 1) * 100)}% — cobrir a sobra é apertar o frouxo, não escrever de novo`,
    )
  if (novo.length < antes.length * 0.9)
    throw new Error(`${v.ordem}: o campo encolheu; a sobra se cobre acrescentando, não cortando`)

  for (const f of todasPenduradas(novo))
    if (penduradaSemPagar(f)) throw new Error(`${v.ordem}: a nova frase anuncia e não paga — "${f}"`)

  const proposto = { ...p, [v.campo]: novo } as unknown as Material
  const rep = maiorTrechoRepetido(
    String(proposto.contexto_historico_literario),
    String(proposto.resenha),
  )
  if (rep > 8) throw new Error(`${v.ordem}: a resenha passou a repetir o contexto em ${rep} palavras`)
  const r = validarMaterial(entrada, proposto, JSON.stringify(proposto))
  if (r.problemas.length) throw new Error(`${v.ordem}: ${r.problemas.join('; ')}`)

  p[v.campo] = novo
}

function pendentesAqui(d: ReturnType<typeof dirs>): number[] {
  const feito = new Set([
    ...(existsSync(d.saida) ? readdirSync(d.saida) : []),
    ...(existsSync(join(d.base, 'aplicados')) ? readdirSync(join(d.base, 'aplicados')) : []),
  ])
  const travadas = new Set(existsSync(d.travas) ? readdirSync(d.travas) : [])
  return readdirSync(d.entrada)
    .filter((f) => f.endsWith('.json') && !feito.has(f) && !travadas.has(f.slice(0, -5)))
    .map((f) => Number(f.slice(0, -5)))
    .sort((a, b) => a - b)
}

function main() {
  const d = dirs(BASE)
  const cmd = process.argv[2]
  const arr = () =>
    JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Record<string, unknown>[]
  const dEntrada = dirs(join(root, 'data/reenriquecimento')).entrada

  if (cmd === 'preparar') {
    criarDirs(d)
    const lista = arr()
    const porOrdem = new Map(lista.map((p) => [p.ordem as number, p]))
    const dirInv = join(root, 'data/invencao/saida')
    const vistos = new Set<number>()
    let n = 0
    for (const f of readdirSync(dirInv).filter((x) => x.endsWith('.json'))) {
      const a = JSON.parse(readFileSync(join(dirInv, f), 'utf8')) as Achado
      for (const s of a.sobrou ?? []) {
        if (vistos.has(a.ordem)) continue
        const p = porOrdem.get(a.ordem)
        if (!p) continue
        vistos.add(a.ordem)
        writeFileSync(
          join(d.entrada, `${a.ordem}.json`),
          JSON.stringify(
            {
              ordem: a.ordem,
              ref: `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}-${p.capitulo_fim}:${p.versiculo_fim}`,
              sobra: s,
              contexto_historico_literario: p.contexto_historico_literario,
              resenha: p.resenha,
              texto: p.texto,
            },
            null,
            2,
          ),
        )
        n++
      }
    }
    console.log(`entrada: ${n} perícopes com versículo que nenhum campo trata`)
    return
  }

  if (cmd === 'claim') {
    criarDirs(d)
    const tamanho = Number(process.argv.find((a) => a.startsWith('--tamanho='))?.split('=')[1] ?? 9)
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const lote = montarLote(d, pendentesAqui(d).slice(0, tamanho), id)
    if (!lote) return console.log('nada pendente')
    console.log(lote.arquivo)
    console.log(`lote ${lote.id}: ${lote.ordens.length}`)
    return
  }

  if (cmd === 'aplicar') {
    const lista = arr()
    const porOrdem = new Map(lista.map((p) => [p.ordem as number, p]))
    const aplicados = join(d.base, 'aplicados')
    mkdirSync(aplicados, { recursive: true })
    const erros: string[] = []
    const feitos: string[] = []
    for (const f of readdirSync(d.saida).filter((x) => x.endsWith('.json'))) {
      const v = JSON.parse(readFileSync(join(d.saida, f), 'utf8')) as VeredictoSobra
      const p = porOrdem.get(v.ordem)
      if (!p) {
        erros.push(`${v.ordem}: não existe`)
        continue
      }
      try {
        aplicarSobra(p, v, JSON.parse(readFileSync(join(dEntrada, `${v.ordem}.json`), 'utf8')))
        feitos.push(f)
      } catch (e) {
        erros.push((e as Error).message)
      }
    }
    if (feitos.length)
      writeFileSync(join(root, 'data/pericopes.json'), `${JSON.stringify(lista, null, 2)}\n`)
    for (const f of feitos) renameSync(join(d.saida, f), join(aplicados, f))
    console.log(`aplicados ${feitos.length}`)
    if (erros.length) {
      console.log(`\nrecusados ${erros.length}:`)
      for (const e of erros) console.log(`  ${e}`)
    }
    return
  }

  criarDirs(d)
  const total = readdirSync(d.entrada).filter((f) => f.endsWith('.json')).length
  const aps = existsSync(join(d.base, 'aplicados')) ? readdirSync(join(d.base, 'aplicados')).length : 0
  console.log(
    `entrada ${total} · saída ${readdirSync(d.saida).length} · aplicados ${aps} · pendentes ${pendentesAqui(d).length}`,
  )
}

if (process.argv[1]?.endsWith('sobra-fila.ts')) main()

/**
 * Consertar o que a auditoria de invenção achou.
 *
 * O caça-invenção varreu as 2.823 e deixou ~98 acusações vivas em 86
 * perícopes: frases que o material afirma e a Escritura desmente. Elas não são
 * um tique — cada uma é um caso, e por isso não há varredura que as conserte.
 *
 * **A entrada é calculada, nunca copiada.** A acusação é reconferida contra
 * `data/pericopes.json` na hora de montar a fila: se a frase já não está lá, a
 * acusação morreu e não entra. Foi assim que 29 saíram sozinhas durante a
 * própria varredura.
 *
 * **Três vereditos, e o terceiro é o importante.** `troca` põe outra frase no
 * lugar; `corta` tira a frase (boa quando ela não fazia falta); `recusa` diz
 * que a acusação está errada. O `recusa` não é escape: ele grava o motivo e
 * chega para mim ler, porque a única coisa que o portão NÃO consegue conferir
 * é se a acusação procede. Recusa sem motivo é recusada.
 *
 * **O apoio.** Toda frase nova declara em que se apoia. Quando o apoio é uma
 * citação entre aspas, o portão confere que ela existe no texto da perícope —
 * é o único conserto barato contra o modo de falha mais caro daqui, que é
 * trocar uma invenção por outra.
 *
 * Usage:
 *   npx tsx scripts/conserto-invencao-fila.ts preparar
 *   npx tsx scripts/conserto-invencao-fila.ts claim --tamanho=12
 *   npx tsx scripts/conserto-invencao-fila.ts aplicar
 *   npx tsx scripts/conserto-invencao-fila.ts status
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarDirs, dirs, montarLote } from './reenriquecimento.ts'
import { maiorTrechoRepetido, validarMaterial, type Material } from './validar-material.ts'
import { penduradaSemPagar, todasPenduradas } from './frase-pendurada.ts'
import { textoDoCampo, type Dossie } from './leitura-fila.ts'
import { pendentes } from './invencoes-pendentes.ts'
import type { Achado } from './invencao-fila.ts'

const root = join(import.meta.dirname, '..')
export const BASE = join(root, 'data/conserto-invencao')

export type Conserto = {
  /** A frase acusada, byte a byte como está no material. */
  afirma: string
  veredito: 'troca' | 'corta' | 'recusa'
  novo?: string
  apoio?: string
  motivo?: string
}
export type VeredictoConserto = { ordem: number; consertos: Conserto[] }

const limpar = (t: string) =>
  t
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/** Normaliza só o que é ruído de digitação, para conferir citação contra o texto. */
const chave = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export function aplicarConsertos(
  p: Record<string, unknown>,
  v: VeredictoConserto,
  entrada: { texto: string },
): { trocadas: number; cortadas: number; recusadas: string[] } {
  const original = JSON.parse(JSON.stringify(p)) as Record<string, unknown>
  // As penduradas que JÁ estavam aqui antes do conserto. A campanha julgou 948
  // delas uma a uma e deixou 283 de pé porque a frase SEGUINTE paga o que elas
  // anunciam — e nenhuma régua enxerga isso. Reprovar a perícope inteira por
  // causa de uma dessas seguraria um conserto certo por um defeito que não é
  // defeito e que a acusação nem menciona. O portão cobra só o que o conserto
  // INTRODUZ.
  const jaHavia = new Set(
    [
      ...todasPenduradas(String(p.contexto_historico_literario ?? '')),
      ...todasPenduradas(String(p.resenha ?? '')),
    ].filter(penduradaSemPagar),
  )
  let trocadas = 0
  let cortadas = 0
  const recusadas: string[] = []

  for (const c of v.consertos ?? []) {
    if (c.veredito === 'recusa') {
      if (!c.motivo?.trim())
        throw new Error(`${v.ordem}: "recusa" sem motivo — a recusa é para eu ler, não para pular`)
      recusadas.push(`${v.ordem} · "${c.afirma.slice(0, 60)}…" → ${c.motivo}`)
      continue
    }
    // `topicos_pregar` entra na busca porque a acusação cai lá também: em
    // 2Sm 4 a mesma invenção estava na resenha E no tópico, e sem este campo o
    // conserto entrava pela metade — a frase errada seguia sendo narrada na
    // seção seguinte. `perguntas_reflexao` é array e fica de fora de propósito:
    // substituir dentro de lista pede outro desenho, e nenhuma acusação viva
    // aponta para lá.
    const campo = [
      'titulo_pericope_pt',
      'contexto_historico_literario',
      'resenha',
      'topicos_pregar',
    ].find((k) => String(p[k] ?? '').includes(c.afirma))
    if (!campo)
      // Pode ser paráfrase, ou a frase já ter mudado por outro conserto do mesmo
      // lote. Nos dois casos aplicar às cegas erra o alvo.
      throw new Error(`${v.ordem}: a frase acusada não está em campo nenhum — "${c.afirma.slice(0, 55)}…"`)

    if (c.veredito === 'corta') {
      p[campo] = limpar(String(p[campo]).replace(c.afirma, ''))
      cortadas++
      continue
    }
    const novo = c.novo?.trim()
    if (!novo) throw new Error(`${v.ordem}: "troca" sem frase nova`)
    if (!c.apoio?.trim()) throw new Error(`${v.ordem}: "troca" sem apoio — diga em que a frase nova se apoia`)
    // Quando o apoio cita, a citação tem de existir no texto da perícope. É a
    // única conferência automática possível contra trocar uma invenção por
    // outra, e ela pega justamente a forma mais comum: o número e o nome.
    for (const m of c.apoio.matchAll(/[“"]([^”"]{12,})[”"]/g)) {
      if (!chave(String(entrada.texto)).includes(chave(m[1])))
        throw new Error(
          `${v.ordem}: o apoio cita "${m[1].slice(0, 45)}…", que não está no texto desta perícope`,
        )
    }
    if (penduradaSemPagar(novo))
      throw new Error(`${v.ordem}: a frase nova anuncia e não paga — "${novo.slice(0, 50)}…"`)
    p[campo] = String(p[campo]).replace(c.afirma, novo)
    trocadas++
  }

  if (trocadas + cortadas === 0) return { trocadas, cortadas, recusadas }

  for (const f of todasPenduradas(String(p.contexto_historico_literario)).concat(
    todasPenduradas(String(p.resenha)),
  ))
    if (penduradaSemPagar(f) && !jaHavia.has(f)) {
      Object.assign(p, original)
      throw new Error(`${v.ordem}: o conserto deixou uma frase que anuncia e não paga — "${f}"`)
    }
  const rep = maiorTrechoRepetido(String(p.contexto_historico_literario), String(p.resenha))
  if (rep > 8) {
    Object.assign(p, original)
    throw new Error(`${v.ordem}: depois do conserto a resenha repete o contexto em ${rep} palavras`)
  }
  const r = validarMaterial(entrada, p as unknown as Material, JSON.stringify(p))
  if (r.problemas.length) {
    Object.assign(p, original)
    throw new Error(`${v.ordem}: ${r.problemas.join('; ')}`)
  }
  return { trocadas, cortadas, recusadas }
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
    const dirInv = join(root, 'data/invencao/saida')
    const achados = readdirSync(dirInv)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(dirInv, f), 'utf8')) as Achado)
    const { vivas } = pendentes(lista, achados)
    const porOrdem = new Map(lista.map((p) => [p.ordem as number, p]))
    const agrupadas = new Map<number, typeof vivas>()
    for (const v of vivas) agrupadas.set(v.ordem, [...(agrupadas.get(v.ordem) ?? []), v])
    let n = 0
    for (const [ordem, acusacoes] of agrupadas) {
      const p = porOrdem.get(ordem)
      if (!p) continue
      writeFileSync(
        join(d.entrada, `${ordem}.json`),
        JSON.stringify(
          {
            ordem,
            ref: `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}-${p.capitulo_fim}:${p.versiculo_fim}`,
            acusacoes: acusacoes.map((a) => ({
              campo: a.campo,
              forma: a.forma,
              afirma: a.afirma,
              desmentido_por: a.desmentido_por,
              porque: a.porque,
              campo_inteiro: textoDoCampo(p as unknown as Dossie, a.campo),
            })),
            titulo_pericope_pt: p.titulo_pericope_pt,
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
    console.log(`entrada: ${n} perícopes · ${vivas.length} acusações`)
    return
  }

  if (cmd === 'claim') {
    criarDirs(d)
    const tamanho = Number(process.argv.find((a) => a.startsWith('--tamanho='))?.split('=')[1] ?? 12)
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
    const recusas: string[] = []
    let trocadas = 0
    let cortadas = 0
    for (const f of readdirSync(d.saida).filter((x) => x.endsWith('.json'))) {
      const v = JSON.parse(readFileSync(join(d.saida, f), 'utf8')) as VeredictoConserto
      const p = porOrdem.get(v.ordem)
      if (!p) {
        erros.push(`${v.ordem}: não existe`)
        continue
      }
      try {
        const entrada = JSON.parse(readFileSync(join(dEntrada, `${v.ordem}.json`), 'utf8'))
        const r = aplicarConsertos(p, v, entrada)
        trocadas += r.trocadas
        cortadas += r.cortadas
        recusas.push(...r.recusadas)
        feitos.push(f)
      } catch (e) {
        erros.push((e as Error).message)
      }
    }
    if (feitos.length)
      writeFileSync(join(root, 'data/pericopes.json'), `${JSON.stringify(lista, null, 2)}\n`)
    for (const f of feitos) renameSync(join(d.saida, f), join(aplicados, f))
    console.log(`perícopes ${feitos.length} · trocadas ${trocadas} · cortadas ${cortadas}`)
    if (recusas.length) {
      console.log(`\nRECUSAS — para eu ler, uma a uma (${recusas.length}):`)
      for (const r of recusas) console.log(`  ${r}`)
    }
    if (erros.length) {
      console.log(`\nrecusados pelo portão ${erros.length}:`)
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

if (process.argv[1]?.endsWith('conserto-invencao-fila.ts')) main()

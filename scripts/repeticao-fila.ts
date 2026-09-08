/**
 * A resenha que repete o contexto — 75 perícopes, e o defeito é meu.
 *
 * A campanha da frase pendurada trocou 516 ponteiros do `contexto` por uma
 * resposta. Em 75 delas a resposta que eu escrevi era o fato que a `resenha`
 * JÁ entregava, às vezes palavra por palavra:
 *
 *   contexto: "…e vira comida farta e roupa de boa qualidade para os que
 *              servem diante dele"
 *   resenha:  "…e vira comida farta e roupa de boa qualidade para os que
 *              servem diante dele"
 *
 * Ou seja: consertei um desrespeito com o leitor pondo outro no lugar. Ele
 * ouve a mesma informação duas vezes seguidas, e paga narração pelas duas.
 *
 * **O portão do material já media isto** (`validar-material.ts`, MAX_REPETICAO
 * = 8) e vinha reprovando em silêncio, porque o congelamento lia a fotografia
 * velha da fila em vez de `data/pericopes.json`. Consertada a fonte, os 75
 * apareceram de uma vez.
 *
 * **Qual campo cede.** Não há regra fixa, e é por isso que isto é julgamento e
 * não `sed`. O `contexto` é o que se precisa saber ANTES de ler; a `resenha` é
 * o que se vê lendo. O trecho repetido pertence a um dos dois, e o agente diz
 * a qual — mas quase sempre é o contexto que cede, porque a informação que ele
 * antecipou é justamente a que a resenha existe para entregar.
 *
 * Usage:
 *   npx tsx scripts/repeticao-fila.ts preparar
 *   npx tsx scripts/repeticao-fila.ts claim --tamanho=15
 *   npx tsx scripts/repeticao-fila.ts aplicar
 *   npx tsx scripts/repeticao-fila.ts status
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { criarDirs, dirs, montarLote } from './reenriquecimento.ts'
import { maiorTrechoRepetido, validarMaterial, type Material } from './validar-material.ts'
import { penduradaSemPagar, todasPenduradas } from './frase-pendurada.ts'

const root = join(import.meta.dirname, '..')
export const BASE = join(root, 'data/repeticao')

export type Veredito = {
  ordem: number
  /** Qual dos dois campos cede o trecho repetido. */
  campo: 'contexto_historico_literario' | 'resenha'
  /** O campo INTEIRO reescrito, e não só a frase: o corte costuma pedir que a
   *  vizinha mude de ligação, e mandar só a frase escondia isso do portão. */
  novo: string
}

/** O trecho literal que os dois campos compartilham, para o dossiê do agente. */
export function trechoRepetido(a: string, b: string): string {
  const semAspas = (t: string) => (t ?? '').replace(/[“”"][^“”"]*[“”"]/g, ' ')
  const chave = (w: string) =>
    w
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '')
  const pa = semAspas(a).split(/\s+/).filter(Boolean)
  const pb = semAspas(b).split(/\s+/).filter(Boolean)
  let melhor = ''
  let n = 0
  for (let i = 0; i < pa.length; i++) {
    for (let j = 0; j < pb.length; j++) {
      let k = 0
      while (i + k < pa.length && j + k < pb.length && chave(pa[i + k]) === chave(pb[j + k])) k++
      if (k > n) {
        n = k
        melhor = pa.slice(i, i + k).join(' ')
      }
    }
  }
  return melhor
}

/**
 * O portão. Recusa mais do que a repetição porque o conserto tem três jeitos
 * conhecidos de sair pior do que entrou, e os três já aconteceram nas campanhas
 * anteriores desta sessão.
 */
export function aplicarVeredito(p: Record<string, unknown>, v: Veredito, entrada: { texto: string }): void {
  const outro = v.campo === 'resenha' ? 'contexto_historico_literario' : 'resenha'
  const antes = String(p[v.campo] ?? '')
  const novo = v.novo?.trim()
  if (!novo) throw new Error(`${v.ordem}: veredito sem texto novo`)
  if (novo === antes) throw new Error(`${v.ordem}: o campo voltou igual`)

  // 1. Esvaziar o campo faz a repetição sumir e é a saída preguiçosa. O
  //    conserto tira UMA informação duplicada, não metade da explicação.
  if (novo.length < antes.length * 0.6)
    throw new Error(
      `${v.ordem}: o campo encolheu de ${antes.length} para ${novo.length} caracteres — tire a duplicata, não a explicação`,
    )

  // 2. A repetição tem de ter ido embora de fato, medida pela mesma régua do
  //    portão do material e contra o campo vizinho de VERDADE.
  const ctx = v.campo === 'resenha' ? String(p.contexto_historico_literario) : novo
  const res = v.campo === 'resenha' ? novo : String(p.resenha)
  const sobrou = maiorTrechoRepetido(ctx, res)
  if (sobrou > 8)
    throw new Error(
      `${v.ordem}: ainda repete ${sobrou} palavras — "${trechoRepetido(ctx, res).slice(0, 60)}…"`,
    )

  // 3. O tique que a campanha anterior tirou não pode voltar pela janela: uma
  //    frase que manda reparar em algo e não diz no quê é o mesmo desrespeito
  //    com outra roupa.
  //
  //    Mas só o que este conserto INTRODUZ. A campanha julgou 948 destas uma a
  //    uma e deixou 283 de pé porque a frase SEGUINTE paga o que elas anunciam,
  //    e nenhuma régua enxerga isso. Cobrar as antigas aqui reprovava um
  //    conserto certo por um defeito que não é defeito — foi o que segurou
  //    "Não pule." em Jz 21 e "Duas informações ajudam a acompanhar." em 1Cr 11.
  const jaHavia = new Set(todasPenduradas(antes).filter(penduradaSemPagar))
  for (const f of todasPenduradas(novo))
    if (penduradaSemPagar(f) && !jaHavia.has(f))
      throw new Error(`${v.ordem}: a nova frase anuncia e não paga — "${f}"`)

  const proposto = { ...p, [v.campo]: novo } as unknown as Material
  const r = validarMaterial(entrada, proposto, JSON.stringify(proposto))
  if (r.problemas.length) throw new Error(`${v.ordem}: ${r.problemas.join('; ')}`)
  if (String(proposto[outro as keyof Material]) !== String(p[outro]))
    throw new Error(`${v.ordem}: o outro campo mudou, e só um deve mudar`)

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
    let n = 0
    for (const p of arr()) {
      const fe = join(dEntrada, `${p.ordem}.json`)
      if (!existsSync(fe)) continue
      const entrada = JSON.parse(readFileSync(fe, 'utf8')) as { texto: string }
      const r = validarMaterial(entrada, p as unknown as Material, JSON.stringify(p))
      const rep = r.problemas.find((x) => x.includes('repete o contexto'))
      if (!rep) continue
      writeFileSync(
        join(d.entrada, `${p.ordem}.json`),
        JSON.stringify(
          {
            ordem: p.ordem,
            ref: `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}-${p.capitulo_fim}:${p.versiculo_fim}`,
            problema: rep,
            repetido: trechoRepetido(
              String(p.contexto_historico_literario),
              String(p.resenha),
            ),
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
    console.log(`entrada: ${n} perícopes em que a resenha repete o contexto`)
    return
  }

  if (cmd === 'claim') {
    criarDirs(d)
    const tamanho = Number(process.argv.find((a) => a.startsWith('--tamanho='))?.split('=')[1] ?? 15)
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
    let contexto = 0
    let resenha = 0
    for (const f of readdirSync(d.saida).filter((x) => x.endsWith('.json'))) {
      const v = JSON.parse(readFileSync(join(d.saida, f), 'utf8')) as Veredito
      const p = porOrdem.get(v.ordem)
      if (!p) {
        erros.push(`${v.ordem}: não existe`)
        continue
      }
      try {
        const entrada = JSON.parse(readFileSync(join(dEntrada, `${v.ordem}.json`), 'utf8'))
        aplicarVeredito(p, v, entrada)
        if (v.campo === 'resenha') resenha++
        else contexto++
        feitos.push(f)
      } catch (e) {
        erros.push((e as Error).message)
      }
    }
    if (feitos.length)
      writeFileSync(join(root, 'data/pericopes.json'), `${JSON.stringify(lista, null, 2)}\n`)
    // Consumir a saída: sem isto o `aplicar` seguinte rejulga o que já entrou e
    // relata como erro o próprio sucesso da rodada anterior.
    for (const f of feitos) renameSync(join(d.saida, f), join(aplicados, f))
    console.log(`aplicados ${feitos.length}  (contexto ${contexto} · resenha ${resenha})`)
    if (erros.length) {
      console.log(`\nrecusados ${erros.length}:`)
      for (const e of erros) console.log(`  ${e}`)
    }
    return
  }

  criarDirs(d)
  const total = readdirSync(d.entrada).filter((f) => f.endsWith('.json')).length
  const aplicados = existsSync(join(d.base, 'aplicados'))
    ? readdirSync(join(d.base, 'aplicados')).length
    : 0
  console.log(
    `entrada ${total} · saída ${readdirSync(d.saida).length} · aplicados ${aplicados} · pendentes ${pendentesAqui(d).length}`,
  )
}

if (process.argv[1]?.endsWith('repeticao-fila.ts')) main()

/**
 * A frase-molde no fim do `contexto_historico_literario`.
 *
 * O dono leu o material e disse: *"Se algo que era para explicar, não explica
 * nada, isso está errado demais. Ou tira, ou de fato faz uma explicação."*
 * 642 contextos (23% do acervo) fecham com uma frase que manda o leitor reparar
 * em algo — e a maioria nunca diz no quê. Isso é um tique do gerador, não um
 * defeito perícope a perícope, e por isso se acha por regex em vez de leitura:
 * achar custa zero, e o gasto fica todo no julgamento.
 *
 * **O regex acha o candidato, e não decide.** A mesma forma serve para a frase
 * que ENTREGA — "Guarde isso ao ler: o pai tem só mais um filho daquela mulher,
 * e esse ainda é criança" carrega o fato e não se corta. A diferença entre as
 * duas é a única coisa que o julgamento precisa resolver.
 *
 * Usage:
 *   npx tsx scripts/frase-pendurada.ts preparar
 *   npx tsx scripts/frase-pendurada.ts claim --tamanho=40
 *   npx tsx scripts/frase-pendurada.ts aplicar
 *   npx tsx scripts/frase-pendurada.ts status
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { criarDirs, dirs, montarLote } from './reenriquecimento.ts'
// A mesma medida que o portão do material usa para reprovar resenha que
// repete o contexto. Escrevê-la de novo aqui foi o que me fez perder o bug:
// eu chamei a função sem notar que ela morava noutro módulo, e a versão que
// eu teria escrito não ignora citação entre aspas — Escritura repetida é
// legítima, e reprová-la seria inventar defeito.
import { maiorTrechoRepetido } from './validar-material.ts'

const root = join(import.meta.dirname, '..')
export const BASE = join(root, 'data/pendurada')
export const BASE_RESENHA = join(root, 'data/pendurada-resenha')

/**
 * `\s+` e não `\s`: a quebra de parágrafo é DOIS `\n`, e com um só a frase que
 * abre parágrafo próprio escapava — que é justamente a forma mais comum do tique.
 *
 * Só casa no FIM do campo: a mesma palavra no meio de um parágrafo costuma
 * estar amarrada ao que vem depois, e cortá-la perderia ligação. Foi o que os
 * leitores recusaram cortar em Dt 1, 2Sm 1 e 1Sm 1.
 */
const IMPERATIVO =
  '(?:Ao ler,?\\s|Enquanto l[êe],?\\s)?(?:Repare|Note|Observe|Acompanhe|Preste aten|Fique de olho|Leia reparando|Leia prestando|Guarde|Vale olhar|N[ãa]o pule)'
/**
 * O anúncio impessoal — "Duas coisas ajudam aqui", "Uma informação muda o
 * tamanho do que vem". Não manda reparar em nada, e por isso escapou da
 * primeira versão; promete e às vezes não paga. São 23, e várias PAGAM
 * ("Uma informação ajuda a entender por que isso era urgente: naquele mundo, a
 * família do morto tinha o dever de cobrar a morte"), então entram como
 * candidatas e quem separa é o julgamento, como no resto.
 */
const ANUNCIO =
  '(?:Duas|Tr[êe]s|Uma|Dois)\\s+(?:coisas?|informa[çc][õo]es?|informa[çc][ãa]o|detalhes?|dados?)'
export const MOLDE = new RegExp(`(?:^|[.!?]\\s+)((?:${IMPERATIVO}|${ANUNCIO})[^.!?]*[.!?])\\s*$`, 'i')

/**
 * No `contexto` o tique mora no fim do campo; na `resenha` ele aparece no meio
 * do parágrafo, e por isso precisa de uma versão sem âncora. São 281
 * ocorrências em 276 perícopes, e o primeiro regex nem olhava para o campo.
 */
export const MOLDE_QUALQUER = new RegExp(
  `(?:^|[.!?]\\s+)((?:${IMPERATIVO}|${ANUNCIO})[^.!?]*[.!?])`,
  'gi',
)

export function todasPenduradas(texto: string): string[] {
  return [...texto.matchAll(MOLDE_QUALQUER)].map((m) => m[1])
}

/**
 * Começos que se apoiam na frase anterior. Cortar o antecedente deixa o texto
 * gramatical e sem sentido — e ninguém relê para descobrir.
 */
export const ANAFORA =
  /^(?:Ela|Ele|Elas|Eles|Essa|Esse|Essas|Esses|Esta|Este|Isso|Isto|Ambos|Ambas|Nela|Nele|Dela|Dele|A primeira|O primeiro|A segunda|O segundo|As duas|Os dois)\b/

/**
 * A marca de que a frase PAGA o que anuncia: dois-pontos ou travessão seguidos
 * de conteúdo. "Guarde isso ao ler: o pai tem só mais um filho daquela mulher"
 * tem a forma do tique e entrega o fato — é o caso que a campanha inteira
 * existe para preservar.
 */
const ENTREGA = /[:—–-]\s+\S+(?:\s+\S+){2,}/

/**
 * Começos que DESDOBRAM o que a frase anterior anunciou. Quando o texto
 * seguinte enumera, a frase de cima não é ponteiro pendurado: é cabeçalho de
 * lista, e a enumeração é o pagamento dela. Aqui só cabe `entrega` — cortar
 * deixa a lista sem abertura, e responder faz o texto dizer duas vezes:
 *
 *   nova:     "Duas informações são plantadas aqui: que Mardoqueu está sentado
 *              à porta do rei, e que as virgens se ajuntaram outra vez."
 *   seguinte: "A primeira é que Mardoqueu está sentado à porta do rei."
 */
export const ENUMERACAO =
  /^(?:A primeira|O primeiro|A segunda|O segundo|Uma delas|Um deles|Uma é|A outra é|Primeiro,|Segundo,)\b/

/** Tem a forma do tique E não paga. É isto que não pode entrar como frase nova. */
export function penduradaSemPagar(frase: string): boolean {
  return Boolean(pendurada(frase)) && !ENTREGA.test(frase)
}

/**
 * `pendentes` de `reenriquecimento.ts` não conhece `aplicados/`, que só existe
 * nesta fila — sem isto, perícope já aplicada volta a contar como pendente e a
 * conta mente para sempre.
 */
function pendentesAqui(d: { entrada: string; saida: string; travas: string; base: string }) {
  const feitas = new Set(
    [
      ...readdirSync(d.saida),
      ...(existsSync(join(d.base, 'aplicados')) ? readdirSync(join(d.base, 'aplicados')) : []),
    ]
      .filter((f) => f.endsWith('.json'))
      .map((f) => Number(f.slice(0, -5))),
  )
  const travadas = new Set(readdirSync(d.travas).map(Number))
  return readdirSync(d.entrada)
    .filter((f) => f.endsWith('.json'))
    .map((f) => Number(f.slice(0, -5)))
    .filter((o) => !feitas.has(o) && !travadas.has(o))
    .sort((a, b) => a - b)
}

export function pendurada(contexto: string): string | null {
  return contexto.trim().match(MOLDE)?.[1] ?? null
}

export type Veredito = {
  ordem: number
  /**
   * `entrega` mantém; `corta` remove a frase; `responde` troca por `novo`;
   * `corta_e_nomeia` remove a frase E troca o pronome que abre a frase seguinte
   * pelo `sujeito`, resolvendo a órfã sem inventar uma frase de rubrica.
   */
  veredito: 'entrega' | 'corta' | 'responde' | 'corta_e_nomeia'
  novo?: string
  sujeito?: string
}

/** Devolve o contexto novo, ou lança se a frase não estiver mais lá. */
/**
 * A limpeza importa porque na resenha o corte é no MEIO do parágrafo: tirar a
 * frase deixa dois espaços entre as vizinhas, e um parágrafo que era só ela
 * deixa três quebras de linha. Nenhum dos dois quebra o sentido, mas os dois
 * vão para a tela e para o áudio.
 */
const limpar = (t: string) =>
  t
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export function aplicarVeredito(contexto: string, frase: string, v: Veredito): string {
  if (v.veredito === 'entrega') return contexto
  if (!contexto.includes(frase))
    throw new Error(`${v.ordem}: a frase não está mais no contexto — "${frase.slice(0, 50)}…"`)
  const seguinte = contexto.slice(contexto.indexOf(frase) + frase.length).trimStart()
  if (ENUMERACAO.test(seguinte))
    throw new Error(
      `${v.ordem}: é cabeçalho de lista, não frase pendurada — o texto enumera logo abaixo ("${seguinte.slice(0, 45)}…"); marque entrega`,
    )
  if (v.veredito === 'corta_e_nomeia') {
    // O caminho certo quando a frase seguinte JÁ paga o que o ponteiro
    // prometia. Responder ali só cabia inventando uma rubrica — "O foco volta
    // para Jó." —, que é o mesmo defeito com outra roupa. Tirar o ponteiro e
    // nomear o sujeito deixa o texto menor, mais claro e sem nada acrescentado.
    if (!v.sujeito?.trim()) throw new Error(`${v.ordem}: "corta_e_nomeia" sem sujeito`)
    const m = seguinte.match(/^(Ela|Ele|Elas|Eles)\b/)
    if (!m)
      throw new Error(
        `${v.ordem}: a frase seguinte não começa por pronome — "${seguinte.slice(0, 45)}…"`,
      )
    const trocada = seguinte.replace(m[1], v.sujeito.trim())
    return limpar(contexto.slice(0, contexto.indexOf(frase)) + trocada)
  }
  if (v.veredito === 'responde') {
    if (!v.novo?.trim()) throw new Error(`${v.ordem}: veredito "responde" sem frase nova`)
    // A frase nova pode repetir a vizinha, e aí o texto diz a mesma coisa duas
    // vezes seguidas — pior que o ponteiro que estava lá. Aconteceu em Êx 17,
    // onde o nome do altar passou a aparecer três vezes em três frases, e em
    // Ef 5, onde a enumeração seguinte repetia os itens sem dizer "a primeira".
    // Seis palavras seguidas é o limiar: quatro ainda é vocabulário comum, e
    // citação bíblica idêntica é legítima e curta.
    const i = contexto.indexOf(frase)
    const vizinhas =
      contexto.slice(Math.max(0, i - 260), i) + ' ' + contexto.slice(i + frase.length, i + frase.length + 260)
    const repetido = maiorTrechoRepetido(v.novo, vizinhas)
    if (repetido >= 6)
      throw new Error(
        `${v.ordem}: a frase nova repete ${repetido} palavras de uma vizinha — "${v.novo.slice(0, 45)}…"`,
      )
    if (penduradaSemPagar(v.novo.trim()))
      // Trocar uma frase pendurada por outra é o modo de falha mais fácil aqui.
      // Mas a checagem tem de ser sobre PAGAR, e não sobre a forma: a primeira
      // versão recusou "Guarde o nome de Nabote: é na propriedade dele que…",
      // que entrega. Usar o detector de forma para julgar conteúdo foi o mesmo
      // erro que a campanha inteira existe para não cometer.
      throw new Error(`${v.ordem}: a frase nova anuncia e não paga — "${v.novo.slice(0, 50)}…"`)
    return contexto.replace(frase, v.novo)
  }
  if (v.veredito === 'corta' && ANAFORA.test(seguinte))
    // Achado num lote da resenha: cortar "Guarde essa palavra, tremendo." deixa
    // a frase seguinte — "Ela explica o que Saul vai fazer" — sem antecedente.
    // O texto continua gramatical e fica sem sentido, que é o pior dos dois.
    throw new Error(
      `${v.ordem}: a frase seguinte se apoia nesta — "${seguinte.slice(0, 55)}…"; responda em vez de cortar`,
    )
  // A limpeza importa porque na resenha o corte é no MEIO do parágrafo: tirar a
  // frase deixa dois espaços entre as vizinhas, e um parágrafo que era só ela
  // deixa três quebras de linha. Nenhum dos dois quebra o sentido, mas os dois
  // vão para a tela e para o áudio.
  return limpar(contexto.replace(frase, ''))
}

function main() {
  // Duas filas, e não uma com um campo a mais: 672 contextos já estavam em voo
  // quando a resenha apareceu, e mudar a forma da entrada no meio quebraria o
  // que os agentes estão gravando agora.
  const naResenha = process.argv.includes('--campo=resenha')
  const campo = naResenha ? 'resenha' : 'contexto_historico_literario'
  const d = dirs(naResenha ? BASE_RESENHA : BASE)
  const cmd = process.argv[2]

  if (cmd === 'preparar') {
    criarDirs(d)
    const arr = JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Record<
      string,
      unknown
    >[]
    let n = 0
    let reabertas = 0
    for (const p of arr) {
      const contexto = String(p[campo] ?? '')
      // Na resenha pode haver mais de uma; o agente julga a lista inteira, e a
      // reabertura por mudança de frase cuida do resto na passada seguinte.
      const achadas = naResenha ? todasPenduradas(contexto) : [pendurada(contexto)].filter(Boolean)
      const frase = achadas[0] as string | undefined
      if (!frase) continue
      const alvo = join(d.entrada, `${p.ordem}.json`)
      // Um parágrafo pode ter DUAS penduradas seguidas, e o regex só vê a
      // última — consertada ela, a de trás vira a nova última. Por isso
      // `preparar` reabre a perícope quando a frase mudou, em vez de pular:
      // a campanha roda até o ponto fixo, e não até a primeira passada.
      if (existsSync(alvo)) {
        const antes = JSON.parse(readFileSync(alvo, 'utf8')) as { frase: string }
        if (antes.frase === frase) continue
        rmSync(join(d.saida, `${p.ordem}.json`), { force: true })
        rmSync(join(d.base, 'aplicados', `${p.ordem}.json`), { force: true })
        rmSync(join(d.travas, String(p.ordem)), { force: true, recursive: true })
        reabertas++
      }
      writeFileSync(
        alvo,
        JSON.stringify(
          {
            ordem: p.ordem,
            abbrev: p.abbrev,
            ref: `${p.livro} ${p.capitulo_inicio}:${p.versiculo_inicio}`,
            campo,
            frase,
            outras: achadas.slice(1),
            contexto,
            resenha: p.resenha,
            texto: p.texto,
          },
          null,
          2,
        ),
      )
      n++
    }
    console.log(`entrada: ${n} candidatas${reabertas ? ` · ${reabertas} reabertas (a frase mudou)` : ''}`)
    return
  }

  if (cmd === 'claim') {
    criarDirs(d)
    const tamanho = Number(
      process.argv.find((a) => a.startsWith('--tamanho='))?.split('=')[1] ?? 40,
    )
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const lote = montarLote(d, pendentesAqui(d).slice(0, tamanho), id)
    if (!lote) return console.log('nada pendente')
    console.log(lote.arquivo)
    console.log(`lote ${lote.id}: ${lote.ordens.length}`)
    return
  }

  if (cmd === 'aplicar') {
    const arr = JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Record<
      string,
      unknown
    >[]
    const porOrdem = new Map(arr.map((p) => [p.ordem as number, p]))
    const conta: Record<string, number> = { entrega: 0, corta: 0, responde: 0, corta_e_nomeia: 0 }
    const erros: string[] = []
    const feitos: string[] = []
    for (const f of readdirSync(d.saida).filter((x) => x.endsWith('.json'))) {
      const v = JSON.parse(readFileSync(join(d.saida, f), 'utf8')) as Veredito
      const entrada = JSON.parse(readFileSync(join(d.entrada, `${v.ordem}.json`), 'utf8'))
      const p = porOrdem.get(v.ordem)
      if (!p) {
        erros.push(`${v.ordem}: não existe`)
        continue
      }
      try {
        p[entrada.campo ?? campo] = aplicarVeredito(
          String(p[entrada.campo ?? campo]),
          entrada.frase,
          v,
        )
        conta[v.veredito]++
        feitos.push(f)
      } catch (e) {
        erros.push((e as Error).message)
      }
    }
    if (erros.length) {
      console.log(`RECUSADAS ${erros.length} — nada foi gravado`)
      for (const e of erros.slice(0, 15)) console.log(`  ✗ ${e}`)
      process.exit(1)
    }
    writeFileSync(join(root, 'data/pericopes.json'), JSON.stringify(arr, null, 2))
    // A saída é CONSUMIDA depois de aplicada: sem isso, a rodada seguinte tenta
    // aplicar de novo e é recusada porque a frase já saiu do campo — 323 de uma
    // vez, na primeira vez que rodei duas ondas. Movida em vez de apagada
    // porque é o registro do que mudou e por quê.
    const aplicados = join(d.base, 'aplicados')
    mkdirSync(aplicados, { recursive: true })
    for (const f of feitos) renameSync(join(d.saida, f), join(aplicados, f))
    console.log(
      `entrega ${conta.entrega} · responde ${conta.responde} · corta ${conta.corta} · corta_e_nomeia ${conta.corta_e_nomeia}`,
    )
    return
  }

  if (cmd === 'normalizar') {
    // Os agentes reencontram os mesmos dois casos em todo lote, e eu estava
    // consertando à mão a cada chegada. Um é DETERMINÍSTICO — cabeçalho de
    // lista só pode ser `entrega` — e vira código. O outro precisa de
    // julgamento (que fato entra na frase nova?), então volta para a fila em
    // vez de ser adivinhado aqui.
    let viraramEntrega = 0
    const paraRefazer: number[] = []
    for (const f of readdirSync(d.saida).filter((x) => x.endsWith('.json'))) {
      const v = JSON.parse(readFileSync(join(d.saida, f), 'utf8')) as Veredito
      if (v.veredito === 'entrega') continue
      const e = JSON.parse(readFileSync(join(d.entrada, `${v.ordem}.json`), 'utf8'))
      const seguinte = String(e.contexto)
        .slice(String(e.contexto).indexOf(e.frase) + e.frase.length)
        .trimStart()
      if (ENUMERACAO.test(seguinte)) {
        writeFileSync(join(d.saida, f), JSON.stringify({ ordem: v.ordem, veredito: 'entrega' }, null, 2))
        viraramEntrega++
      } else if (v.veredito === 'corta' && ANAFORA.test(seguinte)) {
        rmSync(join(d.saida, f), { force: true })
        rmSync(join(d.travas, String(v.ordem)), { force: true, recursive: true })
        paraRefazer.push(v.ordem)
      }
    }
    console.log(`cabeçalho de lista → entrega: ${viraramEntrega}`)
    console.log(
      `cortes que deixariam órfã, devolvidos à fila: ${paraRefazer.length}${paraRefazer.length ? ` · ${paraRefazer.sort((a, b) => a - b).join(', ')}` : ''}`,
    )
    return
  }

  if (cmd === 'status') {
    criarDirs(d)
    console.log(
      `entrada ${readdirSync(d.entrada).length} · saída ${readdirSync(d.saida).length} · aplicados ${existsSync(join(d.base, 'aplicados')) ? readdirSync(join(d.base, 'aplicados')).length : 0} · pendentes ${pendentesAqui(d).length}`,
    )
    return
  }
  console.error('uso: frase-pendurada.ts preparar|claim|normalizar|aplicar|status')
  process.exit(1)
}

if (process.argv[1]?.endsWith('frase-pendurada.ts')) main()

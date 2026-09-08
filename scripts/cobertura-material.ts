/**
 * O material cobre a perícope inteira, ou só um pedaço dela?
 *
 * A regra é do dono, e ele a formulou assim (2026-09-05):
 *
 * > "Se explica X e não combina com a perícope inteira, então está errado.
 * > Teria que refazer para abranger tudo, não só um pedaço. Se não, não
 * > existiria o versículo, certo?"
 *
 * O caso que a revelou foi Lv 18. O material lê o capítulo como proteção da
 * casa — "mãe, irmã, nora, tia, a mulher do irmão" — e é uma leitura boa e
 * verdadeira. Só que os versículos 22 e 23 não são sobre parentesco, e ficam
 * dentro da lista sem que ninguém diga que existem. O áudio lê o versículo e o
 * material passa por ele em silêncio.
 *
 * **O que este script mede não é passeio versículo a versículo.** O briefing
 * proíbe isso de propósito. O que ele acusa é o versículo que traz assunto
 * PRÓPRIO — palavra que não se repete no resto da perícope — e sobre o qual o
 * material inteiro não diz uma palavra.
 *
 * Rode: `npx tsx scripts/cobertura-material.ts [--lista] [--ordem=N]`
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PALAVRA = /\p{L}{3,}/gu
export const RADICAL = 5

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const radical = (w: string) => semAcento(w).slice(0, RADICAL)

/**
 * Palavras que ligam a frase ou aparecem em toda a Bíblia: nenhuma delas
 * distingue um versículo de outro.
 */
export const VAZIAS = new Set(
  ('para com sem que quem qual mas ainda mais menos muito pouco todo toda todos todas ' +
    'quando onde como porque entre ate depois antes sobre sob apos ser estar ter haver ' +
    'seu sua seus suas ele ela eles elas isto isso aquilo este esta esse essa aquele aquela ' +
    'nao nem dos das nos nas pelo pela pelos pelas ao aos senhor deus disse dizer diz ' +
    'israel filho filhos homem homens povo terra vos vosso vossa vossos vossas eis assim ' +
    'porem entao capitulo')
    .split(' ')
    .map(radical),
)

const conteudo = (s: string) =>
  [...s.matchAll(PALAVRA)].map((m) => radical(m[0])).filter((w) => !VAZIAS.has(w))

export type Verso = { capitulo: number; numero: number; texto: string }

/** `25:8` — a referência dentro da perícope, com o capítulo na frente. */
export const ref = (v: { capitulo: number; numero: number }) => `${v.capitulo}:${v.numero}`

/**
 * `Capítulo 1\n1 No princípio…\n2 E a terra…` → versículos, COM o capítulo.
 *
 * O capítulo não é enfeite. A unidade do material é a PERÍCOPE, e 63 delas
 * atravessam capítulo — nessas os números de versículo reiniciam. Enquanto esta
 * função devolvia só o número, o relatório de Pv 22:17-24:22 saía com os
 * números andando para trás ("20-21 · 2-4"), e dois versículos de capítulos
 * diferentes com o mesmo número eram tratados como o mesmo.
 */
export function versos(texto: string): Verso[] {
  const out: Verso[] = []
  let capitulo = 0
  for (const linha of texto.split('\n')) {
    const cap = /^Cap[íi]tulo\s+(\d+)/.exec(linha.trim())
    if (cap) {
      capitulo = Number(cap[1])
      continue
    }
    const m = /^(\d+)\s+(.+)$/.exec(linha.trim())
    if (m) out.push({ capitulo, numero: Number(m[1]), texto: m[2] })
  }
  return out
}

/**
 * Palavras comuns demais no corpus para distinguir versículo nenhum.
 *
 * A primeira versão acusava "E falou o SENHOR a Moisés, dizendo" como assunto
 * próprio, porque `Moisés` e `dizendo` de fato não se repetiam DENTRO daquela
 * perícope. Fora dela repetem-se às centenas. O corte é por frequência no
 * corpus inteiro, calculado uma vez.
 */
export const COMUM_DEMAIS = 150

export function vocabularioComum(pericopes: { texto: string }[], corte = COMUM_DEMAIS) {
  const n = new Map<string, number>()
  for (const p of pericopes) {
    for (const v of versos(p.texto)) {
      for (const w of new Set(conteudo(v.texto))) n.set(w, (n.get(w) ?? 0) + 1)
    }
  }
  return new Set([...n].filter(([, c]) => c >= corte).map(([w]) => w))
}

export type Bloco = { de: string; ate: string; versiculos: string[] }

/**
 * Versículo TOCADO: o material fala de alguma palavra que só ele traz.
 *
 * Versículo sem palavra própria nenhuma conta como tocado — ele é formulaico
 * ("E falou o SENHOR a Moisés, dizendo") e não ter menção não é lacuna.
 */
function tocado(
  proprias: string[],
  noMaterial: Set<string>,
): boolean {
  if (!proprias.length) return true
  return proprias.some((w) => noMaterial.has(w))
}

/**
 * Blocos de versículos seguidos sobre os quais o material não diz nada.
 *
 * Por que BLOCO e não versículo solto: o sinal lexical de um versículo é fraco
 * demais. "Não te deitarás com homem como com mulher" é feito de palavras
 * comuns — o sentido está na combinação, e nenhuma medida de vocabulário o
 * alcança sozinha. O que o defeito produz de visível é outra coisa: um TRECHO
 * seguido do texto sobre o qual ninguém falou. Em Lv 18 são dois — os
 * versículos 19-20 e 22-23 — e o material atravessa os dois sem parar.
 *
 * É triagem, não veredito: quem decide se o bloco devia ter sido tratado é
 * quem lê.
 */
export function blocosMudos(
  texto: string,
  material: string,
  comum: Set<string> = new Set(),
  minimoBloco = 2,
): Bloco[] {
  const vs = versos(texto)
  const frequencia = new Map<string, number>()
  for (const v of vs) {
    for (const w of new Set(conteudo(v.texto))) frequencia.set(w, (frequencia.get(w) ?? 0) + 1)
  }
  const noMaterial = new Set(conteudo(material))
  const mudos: Verso[] = []
  for (const v of vs) {
    const proprias = [...new Set(conteudo(v.texto))].filter(
      (w) => frequencia.get(w) === 1 && !comum.has(w),
    )
    if (!tocado(proprias, noMaterial)) mudos.push(v)
  }

  // Seguido = mesmo capítulo E número em sequência. Sem o capítulo, o último
  // versículo de um e o primeiro do seguinte pareciam vizinhos ou distantes ao
  // acaso, conforme os números tivessem calhado de encaixar.
  const blocos: Bloco[] = []
  let corrente: Verso[] = []
  const fecha = () => {
    if (corrente.length >= minimoBloco) {
      blocos.push({
        de: ref(corrente[0]),
        ate: ref(corrente.at(-1)!),
        versiculos: corrente.map(ref),
      })
    }
  }
  for (const v of mudos) {
    const anterior = corrente.at(-1)
    if (anterior && v.capitulo === anterior.capitulo && v.numero === anterior.numero + 1) {
      corrente.push(v)
    } else {
      fecha()
      corrente = [v]
    }
  }
  fecha()
  return blocos
}

/**
 * Densidade de nome próprio: separa a lista do discurso.
 *
 * Genealogia, censo e tabela de nações dão 0,45 a 1,00; Lv 18 dá 0,10 e os
 * salmos, 0,00. É a régua que impede a triagem de acusar Neemias 7 e Esdras 2,
 * onde a substância É a lista e resumi-la não deixa nada de fora.
 */
export function densidadeDeNomes(texto: string): number {
  const vs = versos(texto)
  if (!vs.length) return 0
  const conta = (t: string) =>
    [...t.matchAll(/(?<![.!?:;]\s)(?<!^)\b\p{Lu}\p{Ll}{2,}/gu)].length
  return vs.filter((v) => conta(v.texto) >= 2).length / vs.length
}

export function materialDe(p: Record<string, unknown>): string {
  const perguntas = (p.perguntas_reflexao as string[] | undefined)?.join(' ') ?? ''
  return [
    p.titulo_pericope_pt,
    p.contexto_historico_literario,
    p.resenha,
    perguntas,
    p.topicos_pregar,
  ].join(' ')
}

if (process.argv[1]?.endsWith('cobertura-material.ts')) {
  type P = Record<string, unknown> & {
    ordem: number
    abbrev: string
    capitulo_inicio: number
    versiculo_inicio: number
    texto: string
  }
  const root = join(import.meta.dirname, '..')
  const d = JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as P[]
  const so = process.argv.find((a) => a.startsWith('--ordem='))?.split('=')[1]
  const comum = vocabularioComum(d)
  // As duas réguas que a triagem precisou depois de rodar no acervo: sem elas,
  // o topo da lista era genealogia e coleção de provérbios — onde resumir é o
  // certo. `--tudo` mostra a lista crua, sem elas.
  const cru = process.argv.includes('--tudo')
  const achados = d
    .filter((p) => !so || String(p.ordem) === so)
    .map((p) => {
      const mudos = blocosMudos(p.texto, materialDe(p), comum)
      const total = versos(p.texto).length
      const emBloco = mudos.reduce((n, b) => n + b.versiculos.length, 0)
      return { p, mudos, total, fracao: total ? emBloco / total : 0, nomes: densidadeDeNomes(p.texto) }
    })
    .filter((x) => x.mudos.length > 0)
    .filter((x) => cru || so || (x.total <= 40 && x.nomes < 0.3 && x.fracao >= 0.33))
    .sort((a, b) => b.fracao - a.fracao)

  const versosMudos = achados.reduce((n, x) => n + x.mudos.reduce((m, b) => m + b.versiculos.length, 0), 0)
  console.log(
    `perícopes com bloco mudo: ${achados.length} de ${d.length} · versículos dentro dos blocos: ${versosMudos} de ${d.reduce((n, p) => n + versos(p.texto).length, 0)}`,
  )
  if (process.argv.includes('--lista') || so) {
    for (const { p, mudos, fracao } of achados) {
      console.log(
        `${p.ordem}\t${p.abbrev} ${p.capitulo_inicio}:${p.versiculo_inicio}\t${(100 * fracao).toFixed(0)}% mudo\t${mudos.map((b) => `${b.de}-${b.ate}`).join(' · ')}`,
      )
    }
  }
}

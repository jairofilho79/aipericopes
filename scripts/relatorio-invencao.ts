/**
 * Escreve o relatório da varredura a partir dos arquivos, não da memória.
 *
 * A razão de existir: os números que eu contei durante a noite passaram por
 * dedupe, por reauditoria e por consertos meus no meio do caminho. Um relatório
 * escrito de cabeça herdaria todos esses erros de contagem. Este lê `saida/`,
 * reconfere cada acusação contra `data/pericopes.json` como ele está AGORA, e
 * só conta o que ainda vale.
 *
 * Usage: npx tsx scripts/relatorio-invencao.ts > docs/auditoria-invencao.md
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ABSOLVIDAS, pendentes, type Pendente } from './invencoes-pendentes.ts'
import type { Achado } from './invencao-fila.ts'

const root = join(import.meta.dirname, '..')

/**
 * Acusações que eu conferi contra o texto e recusei. Elas ficam AQUI, com o
 * motivo, em vez de sumirem: um relatório que some com o que foi descartado
 * convida a próxima pessoa a redescobrir o mesmo falso positivo.
 *
 * A família campeã é a do holocausto. "Sem sobrar parte para quem ofereceu" e
 * "sem sobrar parte para comer" estão CERTAS — a carne queima inteira e ninguém
 * come. Só erra quem nega o SACERDOTE, porque Lv 7:8 lhe dá o couro, e essas
 * duas (Lv 1 e Nm 28) já foram consertadas. Quatro auditores diferentes
 * acusaram a forma correta.
 */
/** Testamento e seção, para agrupar o relatório do jeito que o leitor pensa. */
const SECAO: [RegExp, string][] = [
  [/^(Gn|Êx|Lv|Nm|Dt)$/, 'Lei'],
  [/^(Js|Jz|Rt|1Sm|2Sm|1Rs|2Rs|1Cr|2Cr|Ed|Ne|Et)$/, 'Históricos'],
  [/^(Jó|Sl|Pv|Ec|Ct)$/, 'Poéticos'],
  [/^(Is|Jr|Lm|Ez|Dn|Os|Jl|Am|Ob|Jn|Mq|Na|Hc|Sf|Ag|Zc|Ml)$/, 'Profetas'],
  [/^(Mt|Mc|Lc|Jo|At)$/, 'Evangelhos e Atos'],
]
const secao = (abbrev: string) =>
  SECAO.find(([re]) => re.test(abbrev))?.[1] ?? 'Epístolas e Apocalipse'

function main() {
  const arr = JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Record<
    string,
    unknown
  >[]
  const dir = join(root, 'data/invencao/saida')
  const arquivos = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []
  const achados = arquivos.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Achado)
  const { vivas, absolvidas, jaConsertadas } = pendentes(arr, achados)

  const porOrdem = new Map(arr.map((p) => [p.ordem as number, p]))
  // A sobra sai da lista quando foi coberta, e "coberta" se lê do disco: cada
  // arquivo em `data/sobra/aplicados/` é um conserto que passou pelo portão.
  // Sem isto o relatório continuaria cobrando 26 sobras já fechadas — a mesma
  // doença da lista de absolvidas que morava aqui dentro.
  const cobertas = new Set(
    (existsSync(join(root, 'data/sobra/aplicados'))
      ? readdirSync(join(root, 'data/sobra/aplicados'))
      : []
    )
      .filter((f) => f.endsWith('.json'))
      .map((f) => Number(f.slice(0, -5))),
  )
  const sobras = achados
    .flatMap((a) => (a.sobrou ?? []).map((s) => ({ ...s, ordem: a.ordem, p: porOrdem.get(a.ordem) })))
    .filter((s) => !cobertas.has(s.ordem))

  const contar = <T>(xs: T[], chave: (x: T) => string) => {
    const m: Record<string, number> = {}
    for (const x of xs) m[chave(x)] = (m[chave(x)] ?? 0) + 1
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }

  const comAchado = new Set(vivas.map((v) => v.ordem))
  console.log(`# Auditoria de invenção — ${new Date().toISOString().slice(0, 10)}\n`)
  console.log(
    `**${arquivos.length} perícopes auditadas** de ${arr.length}. ` +
      `${arquivos.length - comAchado.size} sem nenhuma afirmação que a Escritura desminta ` +
      `(${Math.round((100 * (arquivos.length - comAchado.size)) / arquivos.length)}%).\n`,
  )
  console.log(
    `Restam **${vivas.length} acusações vivas** em ${comAchado.size} perícopes, e ` +
      `**${sobras.length} sobras** (versículo que nenhum campo trata). ` +
      `Outras ${jaConsertadas} já foram consertadas durante a varredura.\n`,
  )

  // Quando não sobra nada, as tabelas vazias e os títulos sem lista abaixo
  // dizem menos que uma frase. O relatório fechado precisa contar o que FOI
  // achado, senão ele apaga a própria auditoria ao ter sucesso.
  if (!vivas.length && !sobras.length) {
    console.log('## Fechada\n')
    console.log(
      `Todas as acusações desta varredura foram tratadas: ${jaConsertadas} consertadas, ` +
        `${absolvidas.length} absolvidas por leitura, ${cobertas.size} sobras cobertas.\n`,
    )
    console.log(
      'O erro dominante não era alucinação: era **generalização** — o material pegava um ' +
        'caso e o transformava em regra. O conserto, quase sempre, foi tirar a régua e ' +
        'deixar o caso.\n',
    )
    console.log(
      'As formas de invenção que a varredura procurava, e o histórico completo das ' +
        'acusações com a frase citada e o versículo que a derrubava, estão nas versões ' +
        'anteriores deste arquivo no git, e a skill que as define em ' +
        '`.claude/skills/caca-invencao/`.\n',
    )
    if (absolvidas.length) {
      console.log('## Absolvidas — acusações que eu li e rejeitei\n')
      for (const v of absolvidas.sort((a, b) => a.ordem - b.ordem)) {
        const razao = ABSOLVIDAS.find((x) => x.ordem === v.ordem)?.porque
        console.log(`- **${v.ref}** — "${v.afirma.slice(0, 80)}…" · ${razao}`)
      }
      console.log()
    }
    return
  }

  console.log('## Por forma\n')
  console.log('| forma | quantas |\n|---|---|')
  for (const [k, n] of contar(vivas, (v) => v.forma ?? '?')) console.log(`| ${k} | ${n} |`)

  console.log('\n## Por seção\n')
  console.log('| seção | invenções | sobras |\n|---|---|---|')
  const secoes = new Set([
    ...vivas.map((v) => secao(v.ref.split(' ')[0])),
    ...sobras.map((s) => secao(String((s.p as Record<string, unknown>)?.abbrev ?? ''))),
  ])
  for (const s of secoes) {
    const i = vivas.filter((v) => secao(v.ref.split(' ')[0])).filter((v) => secao(v.ref.split(' ')[0]) === s).length
    const o = sobras.filter((x) => secao(String((x.p as Record<string, unknown>)?.abbrev ?? '')) === s).length
    console.log(`| ${s} | ${i} | ${o} |`)
  }

  console.log('\n## As acusações, uma a uma\n')
  const porSecao = new Map<string, Pendente[]>()
  for (const v of vivas) {
    const s = secao(v.ref.split(' ')[0])
    porSecao.set(s, [...(porSecao.get(s) ?? []), v])
  }
  for (const [s, lista] of porSecao) {
    console.log(`### ${s}\n`)
    for (const v of lista.sort((a, b) => a.ordem - b.ordem)) {
      console.log(`**${v.ref}** · \`${v.forma}\` · campo \`${v.campo}\``)
      console.log(`> ${v.afirma}\n`)
      console.log(`Desmentido por: ${v.desmentido_por}`)
      if (v.porque) console.log(`\n${v.porque}`)
      console.log()
    }
  }

  if (absolvidas.length) {
    console.log('## Acusações que eu recusei\n')
    console.log('Conferi contra o texto e não são invenção. Ficam registradas para ninguém as redescobrir.\n')
    for (const v of absolvidas) {
      const razao = ABSOLVIDAS.find((x) => x.ordem === v.ordem)?.porque
      console.log(`- **${v.ref}** — "${v.afirma.slice(0, 80)}…" · ${razao}`)
    }
    console.log()
  }

  if (sobras.length) {
    console.log('## Sobras — versículos que nenhum campo trata\n')
    for (const s of sobras.sort((a, b) => a.ordem - b.ordem)) {
      const p = s.p as Record<string, unknown> | undefined
      console.log(`**${p?.abbrev} ${p?.capitulo_inicio}** · versículos ${s.versiculos}`)
      console.log(`> ${s.assunto}`)
      if (s.porque) console.log(`\n${s.porque}`)
      console.log()
    }
  }
}

if (process.argv[1]?.endsWith('relatorio-invencao.ts')) main()

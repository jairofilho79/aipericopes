/**
 * Junta as acusações da varredura e diz quais ainda valem.
 *
 * Três coisas separam a lista bruta da lista acionável, e cada uma já mordeu:
 *
 * 1. **A entrada é uma fotografia.** `invencao-fila.ts preparar` copiou o
 *    material como ele estava; quando eu conserto algo no meio da varredura, os
 *    auditores seguintes ainda auditam a versão velha. Então a frase acusada
 *    tem de ser reconferida contra `data/pericopes.json` AGORA, não contra a
 *    entrada.
 * 2. **A mesma perícope pode ter sido auditada duas vezes** — lotes se
 *    sobrepuseram quando um agente se dividiu em forks. Acusação repetida conta
 *    uma vez.
 * 3. **Uma glosa errada costuma estar em várias perícopes.** Agrupar por frase
 *    quase idêntica mostra a família, e foi assim que "ungir em público"
 *    apareceu em sete lugares em vez de nos três que os auditores viram.
 *
 * Usage: npx tsx scripts/invencoes-pendentes.ts [--familia]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { textoDoCampo, type Dossie } from './leitura-fila.ts'
import type { Achado, Invencao } from './invencao-fila.ts'

const root = join(import.meta.dirname, '..')

export type Pendente = Invencao & { ordem: number; ref: string }

/** Radical de comparação: minúsculas, sem acento, só as palavras de conteúdo. */
export function assinatura(frase: string): string {
  return frase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[a-z]{4,}/g)
    ?.slice(0, 12)
    .join(' ') ?? frase.toLowerCase()
}

/**
 * As acusações que EU li e rejeitei. Elas moravam no gerador do relatório, e
 * por isso o congelamento e o `pronto-para-narrar` continuavam contando as
 * quatro do holocausto como pendência: cada consumidor tinha a sua ideia do
 * que ainda valia. Aqui é o único lugar que responde "esta acusação procede".
 *
 * A absolvição é sempre por LEITURA, e o motivo fica escrito. Quatro auditores
 * independentes acusaram a glosa do holocausto na forma CORRETA dela — a que
 * nega o OFERTANTE — e um `sed` teria estragado 48 ocorrências boas.
 */
export const ABSOLVIDAS: { ordem: number; trecho: string; porque: string }[] = [
  { ordem: 3014, trecho: 'sem sobrar parte alguma para quem ofereceu', porque: 'nega o ofertante, não o sacerdote — está certo' },
  { ordem: 3036, trecho: 'sem sobrar parte nenhuma para quem ofereceu', porque: 'nega o ofertante, não o sacerdote — está certo' },
  { ordem: 3043, trecho: 'sem sobrar parte alguma para quem oferece', porque: 'nega o ofertante, não o sacerdote — está certo' },
  { ordem: 2463, trecho: 'sem que sobrasse parte alguma para quem oferecia', porque: 'nega o ofertante, não o sacerdote — está certo' },
  // A família do éfode: consertei as que DEFINIAM ("era a veste do sacerdote").
  // Estas duas descrevem o uso — "a peça que o sacerdote vestia para consultar"
  // — que é verdade e não reivindica exclusividade. É a mesma forma que dei às
  // consertadas; refazê-las seria mexer no que já está certo.
  { ordem: 481, trecho: 'que o sacerdote de Israel vestia para consultar', porque: 'descreve o uso, não reivindica exclusividade' },
  { ordem: 483, trecho: 'que o sacerdote de Israel vestia para consultar', porque: 'descreve o uso, não reivindica exclusividade' },
  // As duas de 06/09, achadas pelos agentes do conserto e conferidas por mim.
  // As duas caem na mesma regra: a perícope é a unidade, e o auditor foi buscar
  // a resposta noutro trecho.
  {
    ordem: 1239,
    trecho: 'O texto não explica quem fez aquilo nem por quê',
    porque: 'é verdade dentro dos três versículos desta perícope; o auditor buscou a resposta em Is 53, que é outro trecho',
  },
  {
    ordem: 714,
    trecho: 'Este trecho é difícil de aceitar, e a Bíblia não o explica.',
    porque: 'Lv 26:22 é maldição de pacto para desobediência prolongada da nação, não explicação deste episódio',
  },
]

export const absolvida = (v: { ordem: number; afirma: string }) =>
  ABSOLVIDAS.some((x) => x.ordem === v.ordem && v.afirma.includes(x.trecho))

export function pendentes(
  arr: Record<string, unknown>[],
  achados: Achado[],
): { vivas: Pendente[]; absolvidas: Pendente[]; jaConsertadas: number; repetidas: number } {
  const porOrdem = new Map(arr.map((p) => [p.ordem as number, p]))
  const vistas = new Set<string>()
  const vivas: Pendente[] = []
  const absolvidas: Pendente[] = []
  let jaConsertadas = 0
  let repetidas = 0
  for (const a of achados) {
    const p = porOrdem.get(a.ordem)
    if (!p) continue
    for (const i of a.invencoes ?? []) {
      const chave = `${a.ordem}|${assinatura(i.afirma)}`
      if (vistas.has(chave)) {
        repetidas++
        continue
      }
      vistas.add(chave)
      const campo = textoDoCampo(p as unknown as Dossie, i.campo)
      // A frase sumiu do material: ou eu já consertei, ou o campo mudou.
      if (campo === null || !campo.includes(i.afirma)) {
        jaConsertadas++
        continue
      }
      const viva = {
        ...i,
        ordem: a.ordem,
        ref: `${p.abbrev} ${p.capitulo_inicio}:${p.versiculo_inicio}`,
      }
      // Absolvida é acusação lida e rejeitada: ela não é pendência de ninguém,
      // mas continua sendo parte do que a varredura achou — some da conta de
      // pendências, não da história.
      if (absolvida(viva)) {
        absolvidas.push(viva)
        continue
      }
      vivas.push(viva)
    }
  }
  return { vivas, absolvidas, jaConsertadas, repetidas }
}

function main() {
  const arr = JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as Record<
    string,
    unknown
  >[]
  const dir = join(root, 'data/invencao/saida')
  const achados = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Achado)
    : []
  const { vivas, jaConsertadas, repetidas } = pendentes(arr, achados)
  console.log(
    `acusações vivas ${vivas.length} · já consertadas ${jaConsertadas} · repetidas ${repetidas}`,
  )
  const porForma: Record<string, number> = {}
  for (const v of vivas) porForma[v.forma ?? '?'] = (porForma[v.forma ?? '?'] ?? 0) + 1
  for (const [k, n] of Object.entries(porForma).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k}: ${n}`)

  if (process.argv.includes('--familia')) {
    const fam = new Map<string, Pendente[]>()
    for (const v of vivas) {
      const k = assinatura(v.afirma).split(' ').slice(0, 5).join(' ')
      fam.set(k, [...(fam.get(k) ?? []), v])
    }
    const repetidasFam = [...fam.values()].filter((g) => g.length > 1)
    console.log(`\nfamílias com mais de uma perícope: ${repetidasFam.length}`)
    for (const g of repetidasFam)
      console.log(`  ${g.length}× ${g.map((x) => x.ref).join(', ')} — "${g[0].afirma.slice(0, 70)}…"`)
  }
}

if (process.argv[1]?.endsWith('invencoes-pendentes.ts')) main()

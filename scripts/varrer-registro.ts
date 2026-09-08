/**
 * Procura queda de registro no material editorial — gíria, apelido, ironia,
 * familiaridade com o sagrado.
 *
 * **Por que isto é relatório e não portão.** A regra do dono é "simplicidade
 * não é coloquialismo", e coloquialismo não cabe numa lista fechada: um
 * subagent pegou sozinho "bicho do mato", "não maquia o custo", "chutar um
 * culpado" e "descontou a mão" — quatro construções que nenhuma lista de
 * palavras teria previsto. Então isto NÃO reprova nada; junta suspeitas para
 * um humano olhar, e a lista cresce com o que a produção for revelando.
 *
 * As entradas vêm de casos reais, não de imaginação: "somos bicho, e somos
 * mais que bicho" (Gn 1), "põe a mão na cabeça do bicho" para o animal do
 * sacrifício (Lv 1), "não se meter em encrenca, quando calar a boca" (Pv 1),
 * "chegava com cara de evidência" (Sl 3).
 *
 * Usage: npx tsx scripts/varrer-registro.ts [--dir=data/enriched]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Cada padrão vem com o motivo, porque suspeita sem motivo ninguém julga. */
export const PADROES: { re: RegExp; motivo: string; negavel?: boolean }[] = [
  { re: /\bbicho\b/gi, motivo: 'animal do texto reduzido a "bicho"' },
  { re: /\b(fulano|beltrano|ciclano|sicrano)\b/gi, motivo: 'nome próprio substituído por apelido genérico' },
  { re: /\b(galera|treta|rolê|zoeira|na moral|tipo assim|sacou)\b/gi, motivo: 'gíria' },
  // `zoar` sai da lista acima e ganha regra própria SEM o `i`: com ele, a
  // cidade de **Zoar** — para onde Ló foge em Gn 19 — casava com a gíria.
  // Achado por um subagente do conserto de registro.
  { re: /\bzoar\b/g, motivo: 'gíria' },
  // "de boa" só é gíria quando fecha a oração. Sem isto, ele casava dentro de
  // "três medidas de boa farinha" (citação de Gn 18) e de "boa velhice" —
  // duas expressões do próprio texto bíblico.
  { re: /(?<!\bcham\w{0,6}\s)\bde boa(?=\s*[,.;:!?]|\s*$)/gi, motivo: 'gíria' },
  { re: /\b(encrenca|bagunça|confusão armada|barraco)\b/gi, motivo: 'informalidade' },
  { re: /\bcalar a boca\b/gi, motivo: 'expressão grosseira' },
  { re: /\bcara de\b/gi, motivo: '"cara de" — construção coloquial' },
  { re: /\b(maquia|maquiar|maquiando)\b/gi, motivo: 'metáfora de marketing' },
  { re: /\bchutar\b/gi, motivo: '"chutar" no sentido de arriscar/descartar' },
  { re: /\bdescont(ou|ar|ava) a mão\b/gi, motivo: 'expressão de briga de rua' },
  { re: /\bse safou\b/gi, motivo: 'informalidade sobre pessoa do texto' },
  { re: /\b(dar|deu|deram|dando|dá) um jeito\b/gi, motivo: 'informalidade' },
  // Marcar "não é piada" é marcar o material por dizer exatamente a coisa
  // certa. A guarda olha a oração anterior, não a frase inteira.
  { re: /\bpiada\b/gi, motivo: 'tom de humor onde não cabe', negavel: true },
  { re: /\b(enjoad[oa]|de saco cheio|puto|irritadinho)\b/gi, motivo: 'familiaridade com Deus ou com o texto' },
  { re: /\bDeus (surta|pira|perde a cabeça|se estressa)\b/gi, motivo: 'familiaridade com Deus' },
  { re: /\b(maluc\w+|doid\w+|louquinho)\b/gi, motivo: 'informalidade' },
  { re: /\bpapo (furado|reto)\b/gi, motivo: 'gíria' },
  { re: /\bpuxar o tapete\b/gi, motivo: 'expressão coloquial' },
  // Rodada 3: um subagent trocou estas quatro sozinho, depois do portão.
  // A lista cresce com o que a produção revela — é o desenho, não remendo.
  { re: /\bpass(ar|ou|a) batido\b/gi, motivo: 'expressão coloquial' },
  { re: /\bfala do bolso\b/gi, motivo: 'metáfora coloquial' },
  { re: /\bsem graça\b/gi, motivo: '"sem graça" — informalidade' },
  { re: /\bfalh(ado|ou) feio\b/gi, motivo: 'informalidade' },
  // Rodada 4: mais duas, também trocadas por um subagent depois do portão.
  // "a gente de lá", "chega a gente que…" — aí gente é substantivo e a frase
  // está correta. O coloquialismo é o "a gente" que faz as vezes de "nós",
  // e esse vem colado num verbo.
  // A fronteira é `(?<!\p{L})` e não `\b`, e a diferença é um falso-positivo
  // real: o `\b` do JavaScript é ASCII, então "alcanç**a gente** e animais"
  // casava, porque o `ç` conta como fronteira de palavra. Achado por um
  // subagente do conserto de registro, em 1Sm 15.
  { re: /(?<!\p{L})a gente(?!\p{L})(?!\s+(?:que|de|do|da|dos|das|com|sem|em|no|na|comum|bo[ma]s?|simples|humilde|pobre|ric[ao])(?!\p{L}))/giu, motivo: '"a gente" no lugar de "nós"' },
  { re: /\btem (essa|aquela) cara\b/gi, motivo: 'construção coloquial' },
]

export type Suspeita = { ordem: number; campo: string; trecho: string; motivo: string }

/**
 * Dentro de aspas é Escritura, e Escritura não tem registro a corrigir.
 *
 * Esta guarda existe porque a varredura já marcou o texto bíblico três vezes:
 * "de boa vontade" (Mc 12:37), "três medidas de boa farinha" (Gn 18) e
 * "Estás doido" (Ec 2:2). Consertar caso a caso não escala — o que escala é a
 * citação inteira ficar fora do alcance da lista.
 */
export function dentroDeAspas(texto: string, i: number): boolean {
  const antes = texto.slice(0, i)
  if (antes.lastIndexOf('\u201c') > antes.lastIndexOf('\u201d')) return true
  return ((antes.match(/"/g) ?? []).length % 2) === 1
}

/** "não é piada", "sem piada": o material está negando o registro, não o usando. */
export function negadoAntes(texto: string, i: number): boolean {
  return /\b(n\u00e3o|nem|sem)\b[^.!?;]{0,40}$/i.test(texto.slice(Math.max(0, i - 60), i))
}

const CAMPOS = [
  'titulo_pericope_pt',
  'contexto_historico_literario',
  'resenha',
  'topicos_pregar',
] as const

/**
 * Campos já lidos por um revisor e absolvidos: a marca é falso-positivo.
 *
 * Quatro causas, todas confirmadas caso a caso: `cara` no sentido de dispendiosa
 * ("uma cor cara de conseguir", "a tropa mais cara"); `gente` como substantivo
 * ("é a gente daquele pátio", "a gente nova odiava Deus"); e `piada` usada para
 * DESCREVER o deboche de alguém do texto — os genros de Ló, os meninos de
 * Betel —, que é dizer a coisa certa; e a guarda de negação que não alcança a
 * frase inteira ("chamar a aflição de boa", Sl 119:71).
 *
 * A absolvição é do par perícope+campo, e vale enquanto o campo não for
 * reescrito: se ele mudar, a varredura volta a olhá-lo do zero. Sem esta lista
 * as dezoito voltariam à conta a cada rodada e ninguém saberia se eram trabalho
 * pendente ou trabalho já julgado.
 */
export const ABSOLVIDAS = new Set<string>([
  '21:topicos_pregar',
  '270:resenha',
  '280:topicos_pregar',
  '319:topicos_pregar',
  '442:contexto_historico_literario',
  '529:resenha',
  '580:topicos_pregar',
  '714:resenha',
  '714:topicos_pregar',
  '922:resenha',
  '1659:topicos_pregar',
  '1739:topicos_pregar',
  '1740:resenha',
  '1880:topicos_pregar',
  '1991:perguntas_reflexao',
  '1991:resenha',
  '1994:topicos_pregar',
  '2004:topicos_pregar',
  '2347:resenha',
  '2524:resenha',
  '2524:topicos_pregar',
  '2544:resenha',
  '3006:resenha',
  '3006:topicos_pregar',
  '3046:resenha',
  '3163:topicos_pregar',
])

export function varrer(material: Record<string, unknown>): Suspeita[] {
  const ordem = Number(material.ordem)
  const achadas: Suspeita[] = []
  const alvos: [string, string][] = [
    ...CAMPOS.map((c) => [c, String(material[c] ?? '')] as [string, string]),
    ['perguntas_reflexao', (material.perguntas_reflexao as string[] | undefined)?.join(' ') ?? ''],
  ]
  for (const [campo, texto] of alvos) {
    if (ABSOLVIDAS.has(`${ordem}:${campo}`)) continue
    for (const { re, motivo, negavel } of PADROES) {
      for (const m of texto.matchAll(new RegExp(re.source, re.flags))) {
        const i = m.index ?? 0
        if (dentroDeAspas(texto, i)) continue
        if (negavel && negadoAntes(texto, i)) continue
        achadas.push({
          ordem,
          campo,
          motivo,
          trecho: texto.slice(Math.max(0, i - 45), i + m[0].length + 45).replace(/\s+/g, ' '),
        })
      }
    }
  }
  return achadas
}

function main() {
  const dir =
    process.argv.find((a) => a.startsWith('--dir='))?.split('=')[1] ?? 'data/enriched'
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.json'))
  const todas = arquivos.flatMap((f) => varrer(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
  console.log(`${arquivos.length} perícopes · ${todas.length} suspeita(s) de registro`)
  for (const s of todas.sort((a, b) => a.ordem - b.ordem)) {
    console.log(`  ${s.ordem} [${s.campo}] ${s.motivo}`)
    console.log(`     …${s.trecho}…`)
  }
  if (!todas.length) console.log('nenhuma — mas a lista é incompleta por natureza; leia por amostragem')
}

if (process.argv[1]?.endsWith('varrer-registro.ts')) main()

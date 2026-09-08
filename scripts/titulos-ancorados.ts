/**
 * O título identifica a perícope, ou só a comenta?
 *
 * O dono leu os 2.823 títulos e disse que estavam "misteriosos demais" — "a
 * Bíblia tem mistérios sim, mas Deus nunca os faz de propósito". A medida
 * confirmou: 16% dos títulos não têm UMA palavra do próprio texto, e a
 * varredura de colisões acha 15 títulos idênticos e 794 pares parecidos. As
 * duas coisas são o mesmo defeito: um título que nomeia um ACHADO em vez de um
 * TRECHO serve para vários trechos, e por isso colide.
 *
 * A regra que este script mede é a **âncora**: o título carrega pelo menos uma
 * coisa que está no texto e que se pode apontar com o dedo — um nome próprio,
 * ou duas palavras de conteúdo que a perícope usa. A leitura fica; ela passa a
 * montar EM CIMA da âncora, não no lugar dela.
 *
 * Não é para secar o título. "Jesus aparece aos discípulos" identifica e não
 * diz nada; "Portas trancadas, e Jesus no meio" faz as duas coisas.
 *
 * Rode: `npx tsx scripts/titulos-ancorados.ts [--lista]`
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PALAVRA = /[\p{L}']{2,}/gu

/** Palavras que ligam a frase e não ancoram nada. */
export const VAZIAS = new Set(
  ('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem ' +
    'que quem qual e ou mas se ao aos as as pelo pela pelos pelas seu sua seus suas ' +
    'ele ela eles elas isto isso aquilo este esta esse essa aquele aquela nao nem ja ' +
    'ainda mais menos muito pouco todo toda todos todas quando onde como porque entre ' +
    'ate depois antes sobre sob apos ser estar ter haver')
    .split(' '),
)

export const semAcento = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function conteudo(s: string): string[] {
  return [...s.matchAll(PALAVRA)]
    .map((m) => semAcento(m[0]))
    .filter((w) => w.length >= 2 && !VAZIAS.has(w))
}

/**
 * Nomes próprios do texto: maiúscula que NÃO abre frase nem vem logo depois do
 * número do versículo. `Deus`, `Senhor` e afins ficam de fora porque aparecem em
 * quase toda perícope e por isso não distinguem nenhuma.
 */
export const ONIPRESENTES = new Set(
  ['deus', 'senhor', 'jesus', 'cristo', 'espirito', 'israel', 'pai', 'filho', 'capitulo'],
)

export function nomesProprios(texto: string): Set<string> {
  const out = new Set<string>()
  for (const m of texto.matchAll(/(?<![.!?:;\n]\s)(?<!\d\s)\b(\p{Lu}\p{Ll}{2,})/gu)) {
    const w = semAcento(m[1])
    if (!ONIPRESENTES.has(w)) out.add(w)
  }
  return out
}

/**
 * Radical de comparação: os cinco primeiros caracteres.
 *
 * Sem isto, `abstenções` no título não casa com `abstenham` no texto e um
 * título bom é reprovado — foi o que aconteceu no primeiro teste, com
 * "Tiago propõe quatro abstenções aos gentios" em At 15:19. Cinco é curto o
 * bastante para pegar flexão e derivação, e longo o bastante para não juntar
 * palavras diferentes.
 */
export const RADICAL = 5
const radical = (w: string) => w.slice(0, RADICAL)

export type Veredito = {
  titulo: string
  /** Nomes próprios do texto que o título usa. */
  nomes: string[]
  /** Palavras de conteúdo do texto que o título usa. */
  ecos: number
  ancorado: boolean
}

/** Ancorado = um nome próprio do texto, ou duas palavras de conteúdo dele. */
export function ancorar(titulo: string, texto: string): Veredito {
  const doTexto = new Set(conteudo(texto).map(radical))
  const nomes = new Set([...nomesProprios(texto)].map(radical))
  const palavras = conteudo(titulo)
  const usados = palavras.filter((w) => nomes.has(radical(w)))
  const ecos = new Set(palavras.filter((w) => doTexto.has(radical(w))).map(radical)).size
  return { titulo, nomes: usados, ecos, ancorado: usados.length > 0 || ecos >= 2 }
}

/**
 * O título é uma LISTA de materiais?
 *
 * Ancorar puxa para o concreto, e nos trechos descritivos — tabernáculo,
 * ofertas, censos — isso vira inventário: "A mesa de acácia, com pratos,
 * colheres e tigelas". A âncora está lá, mas o título não diz nada.
 *
 * A marca é uma série de três ou mais itens SEM nada depois dela. Quando há um
 * dois-pontos com oração do outro lado, a série é premissa e não é inventário —
 * "Mirra, canela e cássia: o azeite da santa unção" está certo.
 */
/**
 * Segmento que COMEÇA por numeral por extenso, para juntar "vinte e oito" e
 * "quatrocentos e trinta anos da promessa" num item só. A primeira versão exigia
 * que o segmento inteiro fosse o numeral, e por isso só funcionava quando a
 * segunda metade era curta — apontado por um agente em Gl 3:15-25.
 */
const NUMERAL =
  /^(um|uma|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|mil|milhares)(?!\p{L})/iu

const FUNCIONAL = /(?<!\p{L})(de|do|da|dos|das|que|em|no|na|nos|nas|para|com|onde|sobre|ao|aos)(?!\p{L})/iu

export function inventario(titulo: string): boolean {
  if (titulo.split(':')[1]?.trim()) return false
  // Guarda o separador: só se junta numeral ligado por " e ", nunca por vírgula.
  // "quatrocentos e trinta anos" é UM número; "mil, cem, cinquenta e dez" é uma
  // lista de quatro, e a diferença entre as duas está na vírgula.
  const pedacos = titulo.split(/(,| e )/).filter((x) => x.trim())
  const itens: string[] = []
  let ligadoPorE = false
  for (const pedaco of pedacos) {
    if (pedaco === ',' || pedaco.trim() === ',') { ligadoPorE = false; continue }
    if (/^\s+e\s+$/.test(pedaco)) { ligadoPorE = true; continue }
    const item = pedaco.trim()
    const anterior = itens.at(-1)
    if (ligadoPorE && anterior && NUMERAL.test(anterior) && NUMERAL.test(item)) {
      itens[itens.length - 1] = `${anterior} e ${item}`
    } else {
      itens.push(item)
    }
    ligadoPorE = false
  }
  if (itens.length > 1 && FUNCIONAL.test(itens.at(-1)!)) return false
  return itens.length >= 3
}

if (process.argv[1]?.endsWith('titulos-ancorados.ts')) {
  type P = {
    abbrev: string
    capitulo_inicio: number
    versiculo_inicio: number
    titulo_pericope_pt: string
    texto: string
  }
  const root = join(import.meta.dirname, '..')
  const pericopes = JSON.parse(readFileSync(join(root, 'data/pericopes.json'), 'utf8')) as P[]
  const soltos: P[] = []
  for (const p of pericopes) {
    if (!ancorar(p.titulo_pericope_pt, p.texto).ancorado) soltos.push(p)
  }
  const pct = (100 * soltos.length) / pericopes.length
  const listas = pericopes.filter((p) => inventario(p.titulo_pericope_pt))
  console.log(`títulos: ${pericopes.length} · sem âncora: ${soltos.length} (${pct.toFixed(0)}%)`)
  console.log(`  virando lista de materiais: ${listas.length}`)
  if (process.argv.includes('--inventario')) {
    for (const p of listas) {
      console.log(`${p.abbrev} ${p.capitulo_inicio}:${p.versiculo_inicio}\t${p.titulo_pericope_pt}`)
    }
  }
  if (process.argv.includes('--lista')) {
    for (const p of soltos) {
      console.log(`${p.abbrev} ${p.capitulo_inicio}:${p.versiculo_inicio}\t${p.titulo_pericope_pt}`)
    }
  }
}

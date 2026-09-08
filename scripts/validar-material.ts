/**
 * Confere o material editorial produzido para as perícopes novas, antes de
 * qualquer merge no cache ou geração de áudio.
 *
 * Checa forma (campos, contagem de bullets, JSON limpo) e algumas armadilhas
 * de conteúdo que já apareceram na prática: título repetindo o provisório sem
 * pensar, resenha que virou lista de versículos, e material que não menciona
 * nada do próprio trecho.
 *
 * Usage: npx tsx scripts/validar-material.ts <dir-entrada> <dir-saida>
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_PARAGRAFOS, blocosDaResenha } from '../src/lib/paragraphize.ts'

const CAMPOS = [
  'ordem',
  'titulo_pericope_pt',
  'contexto_historico_literario',
  'resenha',
  'perguntas_reflexao',
  'topicos_pregar',
] as const

export type Material = {
  ordem: number
  titulo_pericope_pt: string
  contexto_historico_literario: string
  resenha: string
  perguntas_reflexao: string[]
  topicos_pregar: string
}

function bullets(topicos: string, secao: 'raciocinio' | 'mensagens'): number {
  const [antes, depois] = topicos.split('Mensagens a levar')
  const alvo = secao === 'raciocinio' ? antes : (depois ?? '')
  return alvo.split('\n').filter((l) => l.trimStart().startsWith('- ')).length
}

/**
 * Frases entre aspas que o material apresenta como sendo do texto.
 * Aspas curvas e retas; ignora trechos curtos (termo técnico, palavra hebraica)
 * e os que trazem marca de elisão, que são citação parcial legítima.
 */
function citacoes(texto: string): string[] {
  // Dividir em pares, não casar com regex: um trecho citado curto demais faria
  // o regex falhar ali, avançar, e tratar a aspa de FECHAMENTO como abertura —
  // passando a comparar o texto ENTRE citações. Dividindo, os índices ímpares
  // são sempre o que está dentro das aspas, independente do tamanho.
  const partes = texto.replace(/[“”]/g, '"').split('"')
  const dentro = partes.filter((_, i) => i % 2 === 1)
  return dentro
    .map((c) => c.trim())
    .filter((c) => c.split(/\s+/).length >= 4)
    .filter((c) => c.length <= 200)
    // Elisão e reticências marcam citação parcial legítima.
    .filter((c) => !c.includes('…') && !c.includes('...'))
}

/**
 * Maior sequência de palavras que dois campos repartem, ignorando o que está
 * entre aspas — Escritura citada nos dois lugares é repetição de direito, e é o
 * caso comum: o contexto abre com o versículo e a resenha volta a ele.
 *
 * Serve à regra da cadeia: a resenha é escrita COM o contexto na mão, então
 * repetir uma frase dele é sinal de que os campos foram escritos em paralelo,
 * cada um do zero, e o leitor vai ler a mesma informação duas vezes.
 */
export function maiorTrechoRepetido(a: string, b: string): number {
  const semAspas = (t: string) => (t ?? '').replace(/[“”"][^“”"]*[“”"]/g, ' ')
  const palavras = (t: string) => normalizar(semAspas(t)).split(' ').filter(Boolean)
  const pa = palavras(a)
  const pb = palavras(b)
  if (!pa.length || !pb.length) return 0
  // Programação dinâmica clássica de subsequência contígua comum, em palavras.
  let anterior = new Array<number>(pb.length + 1).fill(0)
  let melhor = 0
  for (let i = 1; i <= pa.length; i++) {
    const atual = new Array<number>(pb.length + 1).fill(0)
    for (let j = 1; j <= pb.length; j++) {
      if (pa[i - 1] === pb[j - 1]) {
        atual[j] = anterior[j - 1] + 1
        if (atual[j] > melhor) melhor = atual[j]
      }
    }
    anterior = atual
  }
  return melhor
}

/** Acima disto não é vocabulário em comum, é a mesma frase escrita duas vezes. */
const MAX_REPETICAO = 8

/**
 * Referência escrita na convenção bibliográfica — "2 Reis 14", "8:15",
 * "Jeroboão II".
 *
 * São defeito por DOIS motivos, e o primeiro basta sozinho: escrever assim é
 * **conhecimento tácito**. O leitor deste app abriu a Bíblia pela segunda vez e
 * pode não saber ler citação bíblica; "o segundo livro dos Reis" diz a mesma
 * coisa sem exigir a convenção.
 *
 * O segundo motivo é o áudio, e é o que tornou isto visível: a voz lê "2 Reis"
 * como *dois Reis* e "8:15" como hora. Não dá para consertar só na fala, porque
 * o alinhamento do realce exige igualdade de token entre a tela e o que se ouve
 * (`mesmoToken` em `src/lib/alinhar-narracao.ts` tolera só caixa e colchete) —
 * normalizar de um lado só apagaria o realce da seção inteira, em silêncio.
 */
const LIVROS_NUMERADOS =
  'Samuel|Reis|Crônicas|Coríntios|Tessalonicenses|Timóteo|Pedro|João|Macabeus'
const CONVENCOES: { re: RegExp; que: string }[] = [
  { re: new RegExp(`\\b[123]\\s+(?:${LIVROS_NUMERADOS})\\b`, 'g'), que: 'livro citado por número' },
  { re: /\b\d{1,3}:\d{1,3}\b/g, que: 'capítulo:versículo' },
  { re: /\b\p{Lu}\p{Ll}+\s+(I{1,3}|IV|VI{0,3}|IX|XI{0,3})\b/gu, que: 'algarismo romano' },
]

/**
 * Apontar para a FORMA da letra na tela. O leitor de ouvido não vê caixa alta,
 * e o narrador não tem como dizê-la — a frase simplesmente não significa nada
 * no áudio, e o mesmo campo serve aos dois. A saída nunca é apagar a distinção:
 * é dizer o que ela SIGNIFICA. "SENHOR em maiúsculas marca o nome próprio"
 * virou "SENHOR, aqui, não é o título de quem manda: é o nome próprio".
 *
 * O regex é estreito de propósito. Uma varredura larga por "colchetes",
 * "parênteses" ou "na página" devolveu 63 achados e 55 eram legítimos: os
 * colchetes de Êx 26 são ganchos de metal que prendem cortina, e o aparte
 * entre parênteses do narrador em Mc 7 é conteúdo, não tipografia. Pegar só a
 * forma da letra dá zero falso positivo no acervo.
 *
 * `na tela` entra por outro motivo: como metáfora de cinema ela é boa, mas
 * este app TEM uma tela e o leitor está olhando para ela.
 *
 * `travessão` entrou depois, achado por leitura em Pv 2 ("o texto marca três
 * saídas com um travessão"). O resto da pontuação NÃO entrou, e de propósito:
 * a varredura por "ponto final", "dois pontos", "entre aspas" e "ponto de
 * interrogação" devolveu 16 achados e os 16 eram legítimos — "o que parece
 * ponto final pode ser só o fim de uma página" é metáfora, "dois pontos na
 * margem daquele mar" são dois lugares, e "entre aspas" em português falado
 * quer dizer o-chamado. Só entra no portão o que não tem uso legítimo.
 */
const TIPOGRAFIA =
  /\b(?:letras? (?:mai[úu]sculas?|min[úu]sculas?)|em (?:mai[úu]sculas|min[úu]sculas)|com letra (?:grande|pequena|mai[úu]scula|min[úu]scula)|(?:mai[úu]scula|min[úu]scula)s? (?:na|no) (?:texto|p[áa]gina|tela)|na tela|travess[ãa]o|h[íi]fen)\b/gi

/** Normaliza para comparar citação com o texto bíblico sem tropeçar em pontuação. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palavras de conteúdo do texto bíblico, para ver se o material fala DELE. */
function palavrasDoTexto(texto: string): Set<string> {
  return new Set(
    texto
      .toLowerCase()
      .replace(/^capítulo \d+$/gm, '')
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5),
  )
}

/**
 * O portão de qualidade, numa função só, para o CLI e a fila do
 * reenriquecimento (`scripts/reenriquecimento.ts`) julgarem pelo mesmo critério.
 *
 * `problemas` reprova; `avisos` só chama atenção — citar outro livro da Bíblia
 * é legítimo e comum, e transformar isso em erro reprovaria material bom.
 */
export function validarMaterial(
  entrada: { texto: string; sobrescrito?: string; titulo_provisorio?: string; livro?: string },
  m: Material,
  bruto: string,
): { problemas: string[]; avisos: string[] } {
  const p: string[] = []
  const avisos: string[] = []

  for (const c of CAMPOS) if (!(c in m)) p.push(`falta ${c}`)
  if (!Array.isArray(m.perguntas_reflexao) || m.perguntas_reflexao.length !== 2) {
    p.push(`perguntas = ${m.perguntas_reflexao?.length}`)
  }
  if (/```/.test(bruto)) p.push('cerca de código no JSON')

  const t = m.topicos_pregar ?? ''
  if (!t.includes('Linha de raciocínio') || !t.includes('Mensagens a levar')) {
    p.push('tópicos sem as duas seções')
  } else {
    const lr = bullets(t, 'raciocinio')
    const mg = bullets(t, 'mensagens')
    if (lr < 5 || lr > 7) p.push(`linha de raciocínio = ${lr} bullets`)
    if (mg < 4 || mg > 6) p.push(`mensagens = ${mg} bullets`)
    if (!t.includes('**')) p.push('tópicos sem negrito')
  }

  // Resenha que virou passeio versículo a versículo é o modo de falha do prompt.
  const refs = (m.resenha ?? '').match(/\bv\.?\s?\d+|\bversículo \d+/gi)?.length ?? 0
  if (refs >= 5) p.push(`resenha cita ${refs} versículos — virou tour`)

  // O material tem de falar DESTE trecho: pelo menos algumas palavras de
  // conteúdo em comum com o texto bíblico.
  const doTexto = palavrasDoTexto(`${entrada.texto} ${entrada.sobrescrito ?? ''}`)
  const doMaterial = palavrasDoTexto(`${m.contexto_historico_literario} ${m.resenha}`)
  const comuns = [...doMaterial].filter((w) => doTexto.has(w)).length
  // Limiar PROPORCIONAL. Cinco palavras em comum é uma barra razoável para uma
  // perícope de mil caracteres, e é impossível para uma de um versículo: o
  // texto de 1Sm 25:1 tem oito palavras de conteúdo no total, e o de Ec 1:1
  // tem quatro. Com o limiar fixo, 196 perícopes curtas eram reprovadas por
  // serem curtas, e uma delas jamais poderia passar.
  const minimoComuns = Math.min(5, Math.max(1, Math.ceil(doTexto.size * 0.25)))
  if (comuns < minimoComuns) {
    p.push(`só ${comuns} palavras em comum com o texto (mínimo ${minimoComuns}) — material genérico?`)
  }

  // Citação que o material apresenta como do texto tem de estar NO texto.
  // Uma citação derivada — conjugação trocada, palavra a mais — é Escritura
  // inventada, e é a falha mais grave possível aqui.
  // O sobrescrito do salmo é texto bíblico — ele só não está DENTRO de `texto`
  // porque a leitura o exibe como epígrafe. Citá-lo é legítimo.
  const alvo = normalizar(`${entrada.texto} ${entrada.sobrescrito ?? ''}`)
  const suspeitas = [
    ...citacoes(m.contexto_historico_literario ?? ''),
    ...citacoes(m.resenha ?? ''),
    ...citacoes(m.topicos_pregar ?? ''),
  ].filter((c) => !alvo.includes(normalizar(c)))
  for (const c of suspeitas) avisos.push(`citação fora do texto — "${c.slice(0, 60)}"`)

  // A leitura descarta o que passa do teto — e some da tela, do áudio e do
  // realce sem erro nenhum. Material escrito no vazio é reprovado aqui, não
  // descoberto meses depois por um leitor que sentiu falta do fim da resenha.
  const paragrafos = (t: string) =>
    (t ?? '')
      .replace(/\r\n/g, '\n')
      .trim()
      .split(/\n\s*\n+/)
      .map((x) => x.trim())
      .filter(Boolean).length
  const nCtx = paragrafos(m.contexto_historico_literario)
  const nRes = paragrafos(m.resenha)
  if (nCtx > MAX_PARAGRAFOS.contexto) p.push(`contexto com ${nCtx} parágrafos (a leitura mostra ${MAX_PARAGRAFOS.contexto})`)
  if (nRes > MAX_PARAGRAFOS.resenha) p.push(`resenha com ${nRes} parágrafos (a leitura mostra ${MAX_PARAGRAFOS.resenha})`)

  // Convenção bibliográfica: conhecimento tácito na tela, e número lido errado
  // na voz. A forma por extenso serve aos dois.
  for (const campo of ['contexto_historico_literario', 'resenha'] as const) {
    const v = m[campo] ?? ''
    for (const { re, que } of CONVENCOES) {
      for (const achado of v.match(new RegExp(re.source, re.flags)) ?? []) {
        p.push(`${campo}: ${que} — "${achado}"; escreva por extenso`)
      }
    }
    for (const achado of v.match(TIPOGRAFIA) ?? [])
      p.push(`${campo}: aponta para a forma da letra — "${achado}"; diga o que a distinção significa`)
  }
  // `topicos_pregar` também é narrado, e a mesma frase já apareceu lá (2Rs 3).
  for (const achado of (m.topicos_pregar ?? '').match(TIPOGRAFIA) ?? [])
    p.push(`topicos_pregar: aponta para a forma da letra — "${achado}"; diga o que a distinção significa`)

  // A cadeia: a resenha é escrita com o contexto na frente, então repetir uma
  // frase dele significa que os dois foram escritos do zero, em paralelo — e o
  // leitor lê a mesma informação duas vezes seguidas.
  const repetido = maiorTrechoRepetido(m.contexto_historico_literario, m.resenha)
  if (repetido > MAX_REPETICAO) {
    p.push(`resenha repete o contexto em ${repetido} palavras seguidas`)
  }

  // A resenha fecha com a lista de palavras do trecho, em tópicos — prosa
  // emendada por ponto-e-vírgula é difícil de ler, e foi o que o dono pediu
  // para mudar. Cada item é uma FRASE inteira, não um verbete: é o mesmo texto
  // que a narração lê em voz alta, e "Abismo: massa de água" soa como
  // dicionário.
  const palavras = blocosDaResenha(m.resenha ?? '').filter((b) => b.tipo === 'palavra')
  if (!palavras.length) {
    p.push('resenha não fecha com a lista de palavras do trecho')
  } else {
    if (palavras.length < 2 || palavras.length > 4) {
      p.push(`lista de palavras com ${palavras.length} ${palavras.length === 1 ? 'item' : 'itens'} (2 a 4)`)
    }
    const truncos = palavras.filter((b) => !/[.!?]$/.test(b.texto.trim()))
    if (truncos.length) {
      p.push(`${truncos.length} item(ns) da lista não termina em frase: "${truncos[0].texto.slice(0, 45)}"`)
    }
  }

  for (const campo of ['contexto_historico_literario', 'resenha'] as const) {
    const v = m[campo] ?? ''
    if (v.length < 200) p.push(`${campo} curto demais (${v.length})`)
    if (v.length > 3000) p.push(`${campo} longo demais (${v.length})`)
  }
  if (!m.titulo_pericope_pt?.trim()) p.push('sem título')

  return { problemas: p, avisos }
}

function main() {
  const [dirEntrada, dirSaida] = process.argv.slice(2)
  if (!dirEntrada || !dirSaida) {
    console.error('uso: validar-material.ts <dir-entrada> <dir-saida>')
    process.exit(2)
  }

  const esperados = readdirSync(dirEntrada)
    .filter((f) => f.endsWith('.json'))
    .map((f) => Number(f.replace('.json', '')))
    .sort((a, b) => a - b)

  const problemas: string[] = []
  const avisos: string[] = []
  let ok = 0
  let faltando = 0

  for (const ordem of esperados) {
    const f = join(dirSaida, `${ordem}.json`)
    if (!existsSync(f)) {
      faltando++
      continue
    }
    const bruto = readFileSync(f, 'utf8')
    let m: Material
    try {
      m = JSON.parse(bruto) as Material
    } catch (e) {
      problemas.push(`${ordem}: JSON inválido (${(e as Error).message})`)
      continue
    }
    const entrada = JSON.parse(readFileSync(join(dirEntrada, `${ordem}.json`), 'utf8')) as {
      texto: string
      titulo_provisorio: string
      livro: string
    }
    const r = validarMaterial(entrada, m, bruto)
    if (m.ordem !== ordem) r.problemas.unshift(`ordem ${m.ordem} != ${ordem}`)
    for (const a of r.avisos) avisos.push(`${ordem}: ${a}`)
    if (r.problemas.length) problemas.push(`${ordem} (${entrada.livro}): ${r.problemas.join(' | ')}`)
    else ok++
  }

  console.log(
    `esperadas ${esperados.length} · válidas ${ok} · com problema ${problemas.length} · ausentes ${faltando}`,
  )
  if (avisos.length) {
    console.log(`\n⚠️  ${avisos.length} citação(ões) a conferir (pode ser citação de outro livro):`)
    for (const a of avisos.slice(0, 40)) console.log(`  ${a}`)
    if (avisos.length > 40) console.log(`  … e mais ${avisos.length - 40}`)
  }
  if (problemas.length) {
    console.log('\n❌ problemas:')
    for (const x of problemas) console.log(`  ${x}`)
    process.exitCode = 1
  } else if (faltando === 0) {
    console.log('✅ todas válidas')
  }
}

// Guardado: o módulo também é importado pela fila do reenriquecimento.
if (process.argv[1]?.endsWith('validar-material.ts')) main()

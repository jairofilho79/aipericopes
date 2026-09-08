import { loadIndex, refLabel } from './content'
import { livroSlug } from './livro-slug'
import { carregarTexto } from './shards'

/** Abaixo disso a busca varre o corpus inteiro à toa. */
export const MIN_CHARS = 3

/** Teto de resultados: além disso a lista deixa de ser navegável. */
export const LIMITE_RESULTADOS = 50

export type FulltextHit = {
  ordem: number
  titulo: string
  refLabel: string
  /** "capitulo:versiculo" — o mesmo id do TextoBlock, pronto para `?v=`. */
  verseId: string
  snippet: string
}

export type LinhaIndexada = {
  /** Linha crua (aparada), do jeito que o leitor lê. */
  texto: string
  /** Versículo a que a linha pertence; null só em cabeçalho de capítulo. */
  verseId: string | null
  /** Offset da linha dentro do texto normalizado da perícope. */
  inicio: number
}

/**
 * NFD + remoção de diacríticos + minúsculas. Para o texto da NAA (acentos
 * pré-compostos) o comprimento é preservado caractere a caractere, que é o que
 * permite mapear um offset do normalizado de volta ao cru. Onde isso pudesse
 * falhar (texto já decomposto), `marcarTrecho` desiste da marcação em vez de
 * cortar no lugar errado.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/**
 * Quebra o `texto` em linhas indexadas, com as mesmas regras do
 * `parseTexto`: "Capítulo N" reinicia o capítulo corrente e não é versículo;
 * "N texto" abre um versículo; qualquer outra linha continua o versículo
 * anterior.
 */
export function indexarLinhas(raw: string): LinhaIndexada[] {
  const out: LinhaIndexada[] = []
  let chapter = 0
  let inicio = 0

  for (const line of raw.split('\n')) {
    const texto = line.trim()
    const ch = /^Capítulo\s+(\d+)\s*$/i.exec(texto)
    if (ch) {
      chapter = Number(ch[1])
      out.push({ texto, verseId: null, inicio })
    } else {
      const v = /^(\d+)\s+(.+)$/.exec(texto)
      const verseId = v
        ? chapter
          ? `${chapter}:${Number(v[1])}`
          : `0:${Number(v[1])}`
        : (out[out.length - 1]?.verseId ?? null)
      out.push({ texto, verseId, inicio })
    }
    // +1 do '\n' que rejunta as linhas normalizadas.
    inicio += normalize(texto).length + 1
  }

  return out
}

/** Índice da linha que contém o offset, ou -1. */
export function linhaIndexAtOffset(linhas: LinhaIndexada[], offset: number): number {
  if (offset < 0) return -1
  let achado = -1
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].inicio > offset) break
    achado = i
  }
  return achado
}

/** Versículo do offset; num cabeçalho de capítulo, o primeiro versículo depois. */
export function verseIdAtOffset(linhas: LinhaIndexada[], offset: number): string | null {
  const i = linhaIndexAtOffset(linhas, offset)
  if (i < 0) return null
  for (let k = i; k < linhas.length; k++) {
    if (linhas[k].verseId) return linhas[k].verseId
  }
  return null
}

/** ~`tamanho` caracteres em volta da ocorrência, cortando em espaço e com `…`. */
export function snippetAt(texto: string, pos: number, len: number, tamanho = 90): string {
  const p = Math.max(0, Math.min(pos, texto.length))
  const sobra = Math.max(0, tamanho - len)
  let ini = Math.max(0, p - Math.floor(sobra / 2))
  let fim = Math.min(texto.length, ini + Math.max(tamanho, len))

  if (ini > 0) {
    const esp = texto.indexOf(' ', ini)
    if (esp !== -1 && esp < p) ini = esp + 1
  }
  if (fim < texto.length) {
    const esp = texto.lastIndexOf(' ', fim)
    if (esp !== -1 && esp > p + len) fim = esp
  }

  const corpo = texto.slice(ini, fim).trim()
  return `${ini > 0 ? '…' : ''}${corpo}${fim < texto.length ? '…' : ''}`
}

/**
 * Parte o snippet em antes/marcado/depois para o render pintar o meio com
 * `<mark>`. A comparação é normalizada — acha com e sem acento — e só vale se o
 * normalizado tiver o mesmo comprimento do cru; senão devolve tudo em `antes`.
 */
export function marcarTrecho(
  snippet: string,
  q: string,
): { antes: string; marcado: string; depois: string } {
  const semMarca = { antes: snippet, marcado: '', depois: '' }
  const alvo = normalize(snippet)
  if (alvo.length !== snippet.length) return semMarca
  const agulha = normalize(q.trim())
  if (!agulha) return semMarca
  const i = alvo.indexOf(agulha)
  if (i < 0) return semMarca
  return {
    antes: snippet.slice(0, i),
    marcado: snippet.slice(i, i + agulha.length),
    depois: snippet.slice(i + agulha.length),
  }
}

type Entrada = {
  ordem: number
  titulo: string
  ref: string
  textoNorm: string
  linhas: LinhaIndexada[]
}

let indice: Entrada[] | null = null
let construindo: Promise<Entrada[]> | null = null

/** Já dá para buscar sem esperar a construção do índice? */
export function indexPronto(): boolean {
  return indice !== null
}

let progresso = { feitos: 0, total: 0 }

/** Quantos livros de texto já entraram no índice — alimenta o "Preparando busca…". */
export function progressoDoIndice(): { feitos: number; total: number } {
  return progresso
}

/**
 * Índice preguiçoso em cache de módulo: uma segunda cópia normalizada dos 2647
 * `texto` (~13 MiB de heap extra, aceito de propósito). Construído na
 * primeira busca, nunca no carregamento da leitura, e uma vez só — chamadas
 * concorrentes compartilham a mesma promessa.
 */
async function buildIndex(): Promise<Entrada[]> {
  if (indice) return indice
  if (construindo) return construindo
  construindo = (async () => {
    const meta = await loadIndex()
    const slugs = [...new Set(meta.map((p) => livroSlug(p.livro)))]
    progresso = { feitos: 0, total: slugs.length }
    const textos = new Map<number, string>()
    // Um livro por vez: a busca é a única coisa que o usuário está esperando
    // aqui, mas 66 requisições paralelas afogariam uma conexão móvel.
    for (const slug of slugs) {
      for (const [ordem, t] of await carregarTexto(slug)) textos.set(ordem, t.texto)
      progresso = { feitos: progresso.feitos + 1, total: slugs.length }
    }
    const out = meta.flatMap((p) => {
      const texto = textos.get(p.ordem)
      if (texto === undefined) return []
      const linhas = indexarLinhas(texto)
      return [
        {
          ordem: p.ordem,
          titulo: p.titulo_pericope_pt,
          ref: refLabel(p),
          textoNorm: linhas.map((l) => normalize(l.texto)).join('\n'),
          linhas,
        },
      ]
    })
    indice = out
    construindo = null
    return out
  })().catch((err: unknown) => {
    // Falha transitória (offline, rede instável — isto é um PWA) não pode
    // desabilitar a busca pela sessão inteira: limpa o "em construção" para
    // a próxima chamada tentar de novo, em vez de reservar a rejeição.
    construindo = null
    throw err
  })
  return construindo
}

/**
 * Primeira ocorrência por perícope, com o versículo resolvido pelo offset.
 * Roda síncrona no main thread: 2647 `indexOf` num corpus já normalizado é
 * rápido o bastante para o debounce de 300 ms da UI absorver.
 */
/**
 * Corta a página de resultados e diz se ficou coisa de fora.
 *
 * Espera uma busca feita com `limite + 1`: é a única forma de separar "achou
 * exatamente o limite" de "achou o limite e tem mais". Sem isso, uma busca com
 * 50 resultados cravados se anunciava como "(primeiros)" — dizendo ao leitor
 * que faltava resultado quando não faltava.
 */
export function fatiarResultado<T>(
  achados: T[],
  limite = LIMITE_RESULTADOS,
): { hits: T[]; truncado: boolean } {
  return { hits: achados.slice(0, limite), truncado: achados.length > limite }
}

export async function searchTexto(
  q: string,
  limit = LIMITE_RESULTADOS,
  aceitar?: (ordem: number) => boolean,
): Promise<FulltextHit[]> {
  const agulha = normalize(q.trim())
  if (agulha.length < MIN_CHARS) return []
  const idx = await buildIndex()

  const hits: FulltextHit[] = []
  for (const e of idx) {
    if (hits.length >= limit) break
    // Antes do indexOf de propósito: o teto precisa contar os ACEITOS. Cortar
    // depois daria "51 achados → 3 não lidos" e esconderia o que passou do teto.
    if (aceitar && !aceitar(e.ordem)) continue
    const pos = e.textoNorm.indexOf(agulha)
    if (pos < 0) continue
    const i = linhaIndexAtOffset(e.linhas, pos)
    if (i < 0) continue
    const linha = e.linhas[i]
    hits.push({
      ordem: e.ordem,
      titulo: e.titulo,
      refLabel: e.ref,
      verseId: verseIdAtOffset(e.linhas, pos) ?? '',
      snippet: snippetAt(linha.texto, pos - linha.inicio, agulha.length),
    })
  }
  return hits
}

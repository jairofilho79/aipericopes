import {
  BIBLE_BOOKS,
  filterBooks,
  maxChapter,
  maxVerse,
  normalizarNome,
  type BibleBook,
} from './bible-books'
import { MIN_CHARS } from './fulltext'

export type RefParseada = { livro: BibleBook; cap: number; ver: number | null }

export type Consulta = {
  /** A consulta aparada, do jeito que foi digitada. */
  termo: string
  /** Preenchida só quando há token de livro + número DENTRO da faixa do livro. */
  ref: RefParseada | null
  /** Token de livro + número fora da faixa: a seção explica em vez de sumir calada. */
  refForaDeFaixa: (RefParseada & { motivo: string }) | null
  /** Livros cujo nome ou abbrev casa com o termo. */
  livros: BibleBook[]
  buscarNoTexto: boolean
}

/**
 * "1 co 13" → "1co 13". O espaço depois do numeral ordinal não conta: é assim
 * que as pessoas digitam, e aplicar a mesma regra ao alias ("1 Samuel" →
 * "1samuel") mantém os dois lados simétricos.
 */
function juntarOrdinal(s: string): string {
  return s.replace(/^(\d)\s+/, '$1')
}

/** Prefixo só casa se terminar em fim de string ou em caractere não-letra —
 *  sem isso "jo" casaria dentro de "josue". */
function casaPrefixo(alvo: string, prefixo: string): boolean {
  if (!prefixo || !alvo.startsWith(prefixo)) return false
  const seguinte = alvo[prefixo.length]
  return seguinte === undefined || !/\p{L}/u.test(seguinte)
}

/**
 * Classifica a consulta SEM escolher um modo: o resultado é aditivo, e uma
 * mesma consulta pode ter referência, livros e ainda buscar no texto.
 *
 * Adivinhar o modo seria errado por medição: 46 dos 66 nomes de livro também
 * são palavras do texto bíblico (Josué=232, João=155) e o abbrev "Os" tem
 * 15.321 ocorrências do artigo. Já "token de livro + dígito" aparece 1 vez em
 * 4,1 MB — por isso só o dígito autoriza tratar como referência.
 */
export function parseConsulta(entrada: string): Consulta {
  // NFC antes de tudo: "jó" pode chegar decomposto ("o" + U+0301), e uma
  // marca combinante não é \p{L} — a fronteira de casaPrefixo a leria como
  // fim de palavra e o abbrev "jo" (João) casaria uma entrada que era Jó.
  const termo = entrada.normalize('NFC').trim()
  if (!termo) {
    return { termo, ref: null, refForaDeFaixa: null, livros: [], buscarNoTexto: false }
  }

  const semRef: Consulta = {
    termo,
    ref: null,
    refForaDeFaixa: null,
    livros: filterBooks(termo),
    buscarNoTexto: termo.length >= MIN_CHARS,
  }

  // Dois alvos: o casamento de NOME ignora acento, o de ABBREV não. É o que
  // separa "jo" (João) de "jó" (Jó) — a única colisão entre os 132 aliases.
  const semAcento = juntarOrdinal(normalizarNome(termo))
  const comAcento = juntarOrdinal(termo.toLowerCase())

  let melhor: { livro: BibleBook; comprimento: number; tentativa: number } | null = null
  for (const livro of BIBLE_BOOKS) {
    const tentativas: readonly (readonly [string, string])[] = [
      [semAcento, juntarOrdinal(normalizarNome(livro.name))],
      [comAcento, juntarOrdinal(livro.abbrev.toLowerCase())],
    ]
    for (let i = 0; i < tentativas.length; i++) {
      const [alvo, alias] = tentativas[i]
      if (!casaPrefixo(alvo, alias)) continue
      const melhorQue =
        !melhor ||
        alias.length > melhor.comprimento ||
        // Empate real: "jo 3" casa Jó pelo NOME e João pelo ABBREV, ambos com 2
        // caracteres. Sem esta desempate a ordem canônica devolveria Jó, e "Jo"
        // é a abreviação padrão de João na NAA.
        (alias.length === melhor.comprimento && i > melhor.tentativa)
      if (melhorQue) melhor = { livro, comprimento: alias.length, tentativa: i }
    }
  }
  if (!melhor) return semRef

  // `semAcento` e `comAcento` têm o mesmo comprimento para texto pré-composto
  // (é o caso da NAA). Se algum dia não tiverem, o corte falha o regex abaixo e
  // a consulta degrada para texto livre — nunca para uma referência errada.
  const resto = semAcento.slice(melhor.comprimento).trim()
  const m = /^(\d+)(?:[:.,](\d+))?$/.exec(resto)
  if (!m) return semRef

  const livro = melhor.livro
  const cap = Number(m[1])
  const ver = m[2] === undefined ? null : Number(m[2])
  const base: RefParseada = { livro, cap, ver }
  const comLivro = { ...semRef, livros: [livro], buscarNoTexto: false }

  if (cap < 1 || cap > maxChapter(livro)) {
    return {
      ...comLivro,
      refForaDeFaixa: { ...base, motivo: `${livro.name} tem ${maxChapter(livro)} capítulos.` },
    }
  }
  const verMax = maxVerse(livro, cap)
  if (ver !== null && (ver < 1 || ver > verMax)) {
    return {
      ...comLivro,
      refForaDeFaixa: { ...base, motivo: `${livro.name} ${cap} tem ${verMax} versículos.` },
    }
  }
  return { ...comLivro, ref: base }
}

/** Abreviações PT comuns — evita cortar em `ex. Algo`. */
const ABBREV_END =
  /(?:^|[\s(])(?:ex|p\.?\s?ex|etc|cf|dr|dra|sr|sra|prof|a\.C|d\.C|n|v|vs|vv|cap)\.$/i

/**
 * Teto de parágrafos por seção em prosa, e a ÚNICA fonte dele.
 *
 * `paragraphize` descarta o que passa do teto — em silêncio. A tela e os alvos
 * de alinhamento da narração saem do mesmo array, então um parágrafo a mais no
 * material não é "um pouco cortado": ele não é exibido, não é narrado e não é
 * realçado, sem erro em lugar nenhum. Por isso o número mora aqui e é lido
 * tanto pela leitura (`src/pages/Leitura.tsx`) quanto pelo portão do material
 * (`scripts/validar-material.ts`), que reprova quem escreveria no vazio.
 *
 * A resenha aceita 4 porque o último parágrafo dela é reservado às palavras do
 * trecho que o leitor não conhece — e esse parágrafo é narrado junto, que é
 * justamente onde ele vale mais: quem ouve não tem como consultar nada.
 */
export const MAX_PARAGRAFOS = { contexto: 2, resenha: 4 } as const

/**
 * Quebra texto longo em parágrafos legíveis.
 * Prefer `\n\n` existentes; senão agrupa ~N frases por parágrafo.
 */
export function paragraphize(
  text: string,
  { sentencesPerPara = 2, maxParas = 3 }: { sentencesPerPara?: number; maxParas?: number } = {},
): string[] {
  const trimmed = text.replace(/\r\n/g, '\n').trim()
  if (!trimmed) return []

  if (/\n\s*\n/.test(trimmed)) {
    return trimmed
      .split(/\n\s*\n+/)
      // Colapsa só espaço HORIZONTAL: a quebra de linha simples dentro de um
      // parágrafo é significativa — é ela que separa os itens da lista de
      // palavras no fim da resenha. Colapsá-la junto virava tudo uma frase só.
      .map((p) =>
        p
          .replace(/[^\S\n]+/g, ' ')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .join('\n'),
      )
      .filter(Boolean)
      .slice(0, maxParas)
  }

  const sentences = splitSentences(trimmed)
  if (sentences.length <= sentencesPerPara) return [trimmed]

  const paras: string[] = []
  for (let i = 0; i < sentences.length && paras.length < maxParas; i += sentencesPerPara) {
    const last = paras.length === maxParas - 1
    const chunk = last ? sentences.slice(i) : sentences.slice(i, i + sentencesPerPara)
    paras.push(chunk.join(' '))
    if (last) break
  }
  return paras
}

function splitSentences(text: string): string[] {
  const out: string[] = []
  let start = 0
  // Só corta se a próxima frase começa com maiúscula (ou fim do texto).
  const re = /[.!?…]["»”']?(?=\s+[A-ZÀ-ÚÁÉÍÓÚÂÊÔÃÕÇ"“«]|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length
    const piece = text.slice(start, end).trim()
    if (!piece) continue
    if (/\d\.$/.test(piece) && end < text.length) continue
    if (ABBREV_END.test(piece) && end < text.length) continue
    out.push(piece)
    start = end
    while (start < text.length && /\s/.test(text[start]!)) start++
  }
  const tail = text.slice(start).trim()
  if (tail) out.push(tail)
  return out.length ? out : [text]
}

export type BlocoResenha = {
  /** `palavra` é um item da lista de palavras do trecho; `prosa` é o resto. */
  tipo: 'prosa' | 'palavra'
  /**
   * O texto como ele é LIDO — em voz alta e na tela. O marcador de lista já
   * saiu daqui, porque este mesmo texto é o alvo de alinhamento da narração:
   * um traço sobrando viraria "hífen" na voz e quebraria o realce.
   */
  texto: string
}

const ITEM_DE_LISTA = /^[-–—•]\s+/

/**
 * A resenha, pronta para renderizar e para narrar.
 *
 * O último parágrafo é reservado às palavras do trecho, e o dono pediu que
 * viessem em tópicos: emendadas por ponto-e-vírgula elas ficavam difíceis de
 * ler. Só o último parágrafo é aberto — um travessão no meio da prosa é
 * pontuação, não item de lista.
 */
export function blocosDaResenha(resenha: string): BlocoResenha[] {
  const paras = paragraphize(resenha, { maxParas: MAX_PARAGRAFOS.resenha })
  if (!paras.length) return []

  const ultimo = paras[paras.length - 1]
  const linhas = ultimo.split('\n')
  const ehLista = linhas.length > 0 && linhas.every((l) => ITEM_DE_LISTA.test(l))
  if (!ehLista) return paras.map((texto) => ({ tipo: 'prosa' as const, texto }))

  return [
    ...paras.slice(0, -1).map((texto) => ({ tipo: 'prosa' as const, texto })),
    ...linhas.map((l) => ({ tipo: 'palavra' as const, texto: l.replace(ITEM_DE_LISTA, '') })),
  ]
}

export type AlvoResenha = { id: string; texto: string }

/**
 * A resenha repartida nos dois alvos de alinhamento que ela alimenta: a prosa,
 * que é a seção `resenha` do manifesto, e as palavras do trecho, que são a
 * seção `palavras`.
 *
 * Os índices são independentes de propósito — a primeira palavra é `palavra-0`
 * mesmo vindo depois de três parágrafos de prosa —, porque cada seção do
 * manifesto casa as suas unidades com os seus alvos NA ORDEM, começando do
 * zero. Ver `alinhar` em `alinhar-narracao.ts`.
 */
export function alvosDaResenha(resenha: string): {
  prosa: AlvoResenha[]
  palavras: AlvoResenha[]
} {
  const blocos = blocosDaResenha(resenha)
  const prosa = blocos.filter((b) => b.tipo === 'prosa')
  const palavras = blocos.filter((b) => b.tipo === 'palavra')
  return {
    prosa: prosa.map((b, i) => ({ id: `resenha-${i}`, texto: b.texto })),
    palavras: palavras.map((b, i) => ({ id: `palavra-${i}`, texto: b.texto })),
  }
}

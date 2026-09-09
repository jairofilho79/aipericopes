/**
 * Ponte entre o ditado e `parseConsulta`. O que chega de `DitarBotao` já
 * passou por `pontuarFrase` (`pontuar-ditado.ts`), que fecha toda frase com
 * ponto; e o reconhecedor pt-BR entrega o número do versículo como outra
 * palavra ("três quinze") ou por extenso ("vinte e três"). Nenhuma das três
 * formas casa `/^(\d+)(?:[:.,](\d+))?$/` (`consulta.ts:98`): a consulta
 * degradaria em silêncio para busca de texto e a seção Referência nunca
 * abriria.
 *
 * A normalização mora aqui, do lado de quem consome o ditado, e não no
 * parser: `consulta.ts` é compartilhado com o campo digitado, onde nada
 * disso acontece.
 */

/** Sem acento e em minúscula: o reconhecedor varia ("três"/"tres"). */
function chave(palavra: string): string {
  return palavra
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/**
 * Números por extenso que cabem numa referência. Para de crescer em "cento"
 * porque o maior número da Bíblia é 176 (Salmo 119) — nessa faixa a soma
 * simples basta, não há "duzentos" a multiplicar.
 */
const NUMEROS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
}

/** Palavras que a pessoa dita e a referência não precisa. */
const RUIDO = new Set(['capitulo', 'capitulos', 'versiculo', 'versiculos', 'verso', 'versos'])

/**
 * Uma frase ditada → o que o campo de referência deve conter.
 *
 * - `"Gênesis 3:15."` → `"Gênesis 3:15"` (pontuação de fecho)
 * - `"Gênesis 3 15"` → `"Gênesis 3:15"` (dois números seguidos)
 * - `"Gênesis três quinze"` → `"Gênesis 3:15"` (numeral por extenso)
 * - `"Salmo vinte e três"` → `"Salmo 23"` (o "e" soma; sem ele, são dois
 *   números — é o que separa "vinte e três" de "três quinze")
 *
 * Texto que não é referência atravessa quase intacto ("amor de Deus." →
 * "amor de Deus"), porque o campo é o mesmo da busca livre.
 */
export function normalizarDitadoRef(frase: string): string {
  const saida: string[] = []
  let numero: number | null = null
  let somando = false

  function fechar() {
    if (numero !== null) saida.push(String(numero))
    if (somando) saida.push('e')
    numero = null
    somando = false
  }

  const semFecho = frase.normalize('NFC').trim().replace(/[.,;:!?…]+$/u, '')
  for (const token of semFecho.split(/\s+/).filter(Boolean)) {
    const k = chave(token)
    const n = NUMEROS[k]
    if (n !== undefined) {
      if (numero === null) numero = n
      else if (somando) {
        numero += n
        somando = false
      } else {
        fechar()
        numero = n
      }
      continue
    }
    // "e" só é soma entre dois números ("vinte e três"); solto, é palavra.
    if (k === 'e' && numero !== null && !somando) {
      somando = true
      continue
    }
    fechar()
    if (!RUIDO.has(k)) saida.push(token)
  }
  fechar()

  return saida.join(' ').replace(/(\d+)\s+(\d+)/g, '$1:$2')
}

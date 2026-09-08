/**
 * Pontuação heurística do ditado nativo. A Web Speech API em pt-BR entrega as
 * palavras cruas: sem ponto, sem maiúscula, e com os tropeços de quem ouve
 * sem contexto ("cê" por "se"). Cada resultado final do reconhecedor fecha
 * numa pausa da fala, então tratamos cada um como uma frase. É o mínimo que
 * dá para fazer sem modelo de linguagem — vírgulas e correções que dependem
 * do sentido ficam para a revisão por IA (revisar-ditado.ts), que roda por
 * cima disto quando há sessão e rede.
 */

// `\b` do JS é ASCII e quebra em "é", "ção" etc.: a fronteira de palavra aqui
// é "não-letra antes (ou início) e não-letra depois", com classes Unicode.
function palavraInteira(termo: string): RegExp {
  const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{M}])${escapado}(?![\\p{L}\\p{M}])`, 'giu')
}

/**
 * Erros recorrentes do reconhecedor em pt-BR → o que a pessoa disse. Palavra
 * inteira, sem distinguir caixa; a maiúscula inicial do original sobrevive.
 * Cresça com parcimônia: cada entrada é uma aposta de que a forma errada
 * quase nunca é a pretendida numa anotação de estudo bíblico.
 */
const CORRECOES: Record<string, string> = {
  cê: 'se',
}

/** Nomes que o reconhecedor devolve em minúscula. Palavra (ou par) inteira. */
const NOMES: Record<string, string> = {
  deus: 'Deus',
  jesus: 'Jesus',
  cristo: 'Cristo',
  senhor: 'Senhor',
  'espírito santo': 'Espírito Santo',
  bíblia: 'Bíblia',
}

const REGRAS: Array<[RegExp, string]> = [
  ...Object.entries(CORRECOES).map(([de, para]): [RegExp, string] => [palavraInteira(de), para]),
  ...Object.entries(NOMES).map(([de, para]): [RegExp, string] => [palavraInteira(de), para]),
]

function comInicialDe(modelo: string, palavra: string): string {
  const inicial = modelo[0] ?? ''
  return inicial !== inicial.toLowerCase() ? palavra[0].toUpperCase() + palavra.slice(1) : palavra
}

// Começos que só fazem sentido como pergunta. Heurística mínima e deliberada:
// a entonação não chega até aqui, e errar um "?" é pior que deixar o ponto.
const PERGUNTA = /^(será que|por que)(?![\p{L}\p{M}])/iu

/**
 * Uma frase ditada → a mesma frase com maiúscula inicial, nomes e correções
 * aplicados e pontuação de fecho. Vazio devolve vazio.
 */
export function pontuarFrase(texto: string): string {
  let frase = texto.trim().replace(/\s+/g, ' ')
  if (!frase) return ''
  for (const [re, para] of REGRAS) {
    frase = frase.replace(re, (todo: string, antes: string) =>
      antes + comInicialDe(todo.slice(antes.length), para),
    )
  }
  frase = frase[0].toUpperCase() + frase.slice(1)
  if (!/[.!?…]$/u.test(frase)) frase += PERGUNTA.test(frase) ? '?' : '.'
  return frase
}

/**
 * Ajustes de faixa por diferença de versificação entre o dataset KJV de
 * perícopes e a tradução que preenche o texto.
 *
 * **Com a Bíblia Livre, a tabela está vazia — e isso é o resultado, não um
 * esquecimento.** A BLIVRE segue a versificação da KJV nos 31.102 versículos:
 * a auditoria de cobertura fecha sem um único ajuste. A máquina fica de pé
 * porque a tabela é o lugar certo para a próxima divergência, se a fonte trocar.
 *
 * Para o histórico: a NAA exigia CINCO ajustes, e nenhum sobreviveu à troca.
 * Ficam escritos aqui porque cada um foi uma decisão editorial, e saber por que
 * morreram vale mais do que um commit que ninguém relê.
 *
 * - **544 — 1Sm 20:43.** A NAA numerava em separado a despedida ("Davi se
 *   levantou e foi embora"), que a KJV mantém dentro de 20:42. A BLIVRE fecha
 *   o capítulo em 42, como a KJV. Nada de texto se perde: a frase está no 42.
 * - **707 — 1Rs 22:54.** Mesmo caso: o veredito sobre Acazias ("serviu a Baal
 *   e o adorou") é 22:53 na BLIVRE, e o texto está lá inteiro.
 * - **2542 — 3Jo 1:15.** Mesmo caso: "A paz esteja com você" fecha o 1:14.
 * - **2316 — 2Co 13:14.** Era o caso inverso: a perícope declarava terminar
 *   num versículo que a NAA não tinha, e o fim precisava encolher. A BLIVRE
 *   tem o 13:14 ("A graça do Senhor Jesus Cristo… seja com todos vós"), então
 *   a faixa declarada pelo dataset vale como está.
 * - **2613 — Ap 12:18.** Era o único discutível: mover o início da perícope da
 *   besta para que "o dragão se pôs em pé sobre a areia do mar" abrisse a cena
 *   em vez de fechar a anterior. Na BLIVRE o versículo nem existe — o capítulo
 *   12 termina em 17 — e a frase está dentro do 13:1, que já é o primeiro
 *   versículo da perícope: "E eu fiquei parado sobre a areia do mar. E vi subir
 *   do mar uma besta…". A decisão continua valendo; ela só não precisa mais de
 *   ajuste para acontecer.
 */

import type { ParsedRef } from './book-map.ts'

export type Ajuste = {
  /** Índice da linha no dataset bruto (= `ordem` da perícope). */
  ordem: number
  /** Livro em inglês, conferido antes de aplicar — guard contra o dataset mudar. */
  livroEn: string
  /** Novo início, quando o ajuste move a abertura. */
  inicio?: { capitulo: number; versiculo: number }
  /** Novo fim, quando o ajuste estende ou encolhe o fecho. */
  fim?: { capitulo: number; versiculo: number }
  motivo: string
}

export const AJUSTES: Ajuste[] = []

/**
 * Aplica o ajuste da `ordem`, se houver. Devolve os limites inalterados quando
 * não há ajuste, e lança quando o livro não bate — sinal de que o dataset
 * mudou de ordem e a tabela precisa ser revista, nunca ignorada em silêncio.
 *
 * `tabela` existe para o teste exercitar a máquina enquanto `AJUSTES` está
 * vazia; a produção sempre usa o padrão.
 */
export function ajustarVersificacao(
  ordem: number,
  start: ParsedRef,
  end: ParsedRef,
  tabela: Ajuste[] = AJUSTES,
): { start: ParsedRef; end: ParsedRef; ajustado: boolean } {
  const a = tabela.find((x) => x.ordem === ordem)
  if (!a) return { start, end, ajustado: false }
  if (start.livroEn !== a.livroEn) {
    throw new Error(
      `ajuste de versificação da ordem ${ordem} espera ${a.livroEn}, mas o dataset traz ${start.livroEn}`,
    )
  }
  return {
    start: a.inicio ? { ...start, ...a.inicio } : start,
    end: a.fim ? { ...end, ...a.fim } : end,
    ajustado: true,
  }
}

// Limites do protocolo de sync compartilhados pelo cliente.
//
// IMPORTANTE: worker/sync-logic.ts mantém uma cópia própria destes valores
// (MAX_ITENS / MAX_TEXTO) porque o código do Worker não pode importar de src/
// (tsconfig e bundle separados). Ao mudar um valor aqui, mude lá também.

/** Máximo de itens por lista (progresso/anotacoes/destaques) em um único POST /api/sync. */
export const MAX_ITENS_POR_LOTE = 500

/** Máximo de caracteres do texto de uma anotação; o servidor rejeita acima disso. */
export const MAX_TEXTO = 20_000

/**
 * Máximo de caracteres do nome de uma jornada; o servidor rejeita acima disso.
 *
 * Teto próprio, bem abaixo de MAX_TEXTO: nome de jornada não é corpo de
 * anotação. Mora aqui, e não em jornadas.ts, porque user-db.ts precisa dele e
 * jornadas.ts passou a importar de conclusao.ts, que importa de user-db.ts —
 * declarar a constante lá fecharia um ciclo de import com uma `const` no meio.
 */
export const LIMITE_NOME = 120

/**
 * Máximo de conclusões guardadas por perícope. Da 51ª releitura em diante a
 * mais antiga cai — mantém a linha limitada e o corpo do push previsível.
 * worker/sync-logic.ts tem a cópia deste valor (ver o aviso no topo do arquivo).
 */
export const MAX_HISTORICO = 50

/**
 * Aviso de "o sync trouxe novidade", para as telas abertas se atualizarem sem
 * esperar uma navegação.
 *
 * O alvo é um EventTarget próprio do módulo, não a `window`: funciona igual nos
 * testes (que rodam em ambiente node, sem DOM), não ocupa um nome no espaço
 * global e deixa claro que só quem importa daqui participa.
 *
 * Quem dispara é o pull do sync, e só quando ele mudou dados de verdade —
 * quem decide isso é a contagem devolvida pelos applyRemote* (user-db.ts).
 */
const alvo = new EventTarget()

const SYNC_EVENT = 'pericopes-sync'

/** Avisa as telas inscritas. Chamado pelo pull; ninguém mais precisa chamar. */
export function notificarSync(): void {
  alvo.dispatchEvent(new Event(SYNC_EVENT))
}

/** Inscreve `fn` e devolve a função que desinscreve. */
export function onSync(fn: () => void): () => void {
  alvo.addEventListener(SYNC_EVENT, fn)
  return () => alvo.removeEventListener(SYNC_EVENT, fn)
}

/**
 * Revisão do ditado por IA: o trecho que acabou de ser ditado (já com a
 * pontuação heurística de pontuar-ditado.ts) vai ao Worker, que pede a um
 * modelo de texto para pontuar, capitalizar e corrigir erros óbvios de
 * reconhecimento sem reescrever. É um extra por cima do texto que já está no
 * textarea: qualquer falha (sem sessão, cota, rede, modelo) devolve null e a
 * pessoa fica com o que tem, sem aviso.
 */

// Cópia deliberada de MAX_CARACTERES em worker/revisar-ditado.ts: o app não
// pode importar de worker/ (tsconfig/bundle separados). Mantenha os dois iguais.
export const MAX_CARACTERES_REVISAO = 6000

/** Quanto esperar pelo modelo antes de desistir — a pessoa está olhando o botão. */
const TIMEOUT_MS = 10_000

function sinalDeTimeout(ms: number): AbortSignal | undefined {
  const AS = (globalThis as { AbortSignal?: { timeout?: (ms: number) => AbortSignal } }).AbortSignal
  return typeof AS?.timeout === 'function' ? AS.timeout(ms) : undefined
}

/** Texto revisado (trimado), ou null quando não há revisão a aplicar. */
export async function revisarDitado(texto: string): Promise<string | null> {
  const limpo = texto.trim()
  if (!limpo || limpo.length > MAX_CARACTERES_REVISAO) return null
  let res: Response
  try {
    res = await fetch('/api/revisar-ditado', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texto: limpo }),
      credentials: 'include',
      signal: sinalDeTimeout(TIMEOUT_MS),
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  const corpo = (await res.json().catch(() => null)) as { texto?: unknown } | null
  const revisado = typeof corpo?.texto === 'string' ? corpo.texto.trim() : ''
  return revisado || null
}

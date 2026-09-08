export const CONTEXTO_KEY = 'pericopes-contexto-aberto'

/**
 * Contexto é leitura de primeira classe: o padrão é ABERTO, e só quem colapsou
 * de propósito ('0') recebe a seção fechada. Qualquer outro valor — storage
 * vazio, lixo de versão antiga — vale como aberto.
 */
export function getContextoAberto(): boolean {
  try {
    return localStorage.getItem(CONTEXTO_KEY) !== '0'
  } catch {
    return true
  }
}

/** Escolha global (não por perícope): colapsa uma vez, vale para todas. */
export function setContextoAberto(aberto: boolean): void {
  try {
    localStorage.setItem(CONTEXTO_KEY, aberto ? '1' : '0')
  } catch {
    // storage cheio/indisponível nunca quebra a leitura
  }
}

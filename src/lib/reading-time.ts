/**
 * Palavras por minuto de leitura devocional. Mais lento que a leitura de tela
 * comum (~240 wpm) de propósito: texto bíblico se lê com pausa, e um número
 * otimista demais frustra mais do que ajuda.
 */
export const WPM = 180

/**
 * Contagem simples por espaços em branco. Os marcadores "Capítulo N" e os
 * números de versículo entram na conta — são poucos e o arredondamento come a
 * diferença.
 */
export function contarPalavras(texto: string): number {
  return texto.split(/\s+/).filter(Boolean).length
}

/** Minutos inteiros, nunca menos de 1: "~0 min" não diz nada a ninguém. */
export function readingMinutes(texto: string): number {
  return Math.max(1, Math.round(contarPalavras(texto) / WPM))
}

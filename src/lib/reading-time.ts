/**
 * Palavras por minuto de leitura devocional para um leitor casual.
 * Mais lento que a leitura de tela comum (~240 wpm) de propósito:
 * texto bíblico e devocional se lê com pausa e reflexão, e um número
 * otimista demais frustra mais do que ajuda.
 */
export const WPM = 180

export type ConteudoPericope = {
  texto: string
  sobrescrito?: string
  contexto_historico_literario?: string
  resenha?: string
  perguntas_reflexao?: string[]
  titulo_pericope_pt?: string
}

/**
 * Agrupa todo o conteúdo textual que compõe a experiência de leitura de uma perícope:
 * título, contexto histórico, epígrafe/sobrescrito, texto bíblico, resenha e reflexão.
 */
export function extrairTextoPericope(p: ConteudoPericope): string {
  const partes: string[] = []
  if (p.titulo_pericope_pt) partes.push(p.titulo_pericope_pt)
  if (p.contexto_historico_literario) partes.push(p.contexto_historico_literario)
  if (p.sobrescrito) partes.push(p.sobrescrito)
  if (p.texto) partes.push(p.texto)
  if (p.resenha) partes.push(p.resenha)
  if (Array.isArray(p.perguntas_reflexao) && p.perguntas_reflexao.length > 0) {
    partes.push(p.perguntas_reflexao.join(' '))
  }
  return partes.join(' ')
}

/**
 * Contagem simples por espaços em branco. Os marcadores "Capítulo N" e os
 * números de versículo entram na conta — são poucos e o arredondamento come a
 * diferença.
 */
export function contarPalavras(texto: string): number {
  return texto.split(/\s+/).filter(Boolean).length
}

/**
 * Minutos inteiros para leitor casual, nunca menos de 1: "~0 min" não diz nada a ninguém.
 * Aceita uma string simples ou um objeto de perícope completo.
 */
export function readingMinutes(entrada: string | ConteudoPericope, wpm: number = WPM): number {
  const texto = typeof entrada === 'string' ? entrada : extrairTextoPericope(entrada)
  return Math.max(1, Math.round(contarPalavras(texto) / wpm))
}

/**
 * Formata duração em texto legível para o usuário:
 * minutos abaixo de 1 hora ("~5 min"), horas arredondadas dali para cima ("~2 h").
 */
export function formatarDuracao(minutos: number): string {
  if (minutos <= 0) return '~0 min'
  return minutos < 60 ? `~${minutos} min` : `~${Math.round(minutos / 60)} h`
}

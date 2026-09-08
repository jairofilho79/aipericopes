import { describe, expect, it } from 'vitest'
import { contarPalavras, readingMinutes, WPM } from './reading-time'

/** Texto sintético com exatamente `n` palavras. */
function palavras(n: number): string {
  return Array.from({ length: n }, (_, i) => `p${i}`).join(' ')
}

describe('contarPalavras', () => {
  it('conta palavras separadas por espaço, tabulação e quebra de linha', () => {
    expect(contarPalavras('Capítulo 1\n1 No princípio\tDeus')).toBe(6)
  })

  it('espaços repetidos e bordas não viram palavras', () => {
    expect(contarPalavras('  Deus   criou  ')).toBe(2)
  })

  it('texto vazio ou só espaços conta zero', () => {
    expect(contarPalavras('')).toBe(0)
    expect(contarPalavras('   \n  ')).toBe(0)
  })
})

describe('readingMinutes', () => {
  it('texto vazio ainda vale 1 minuto', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('   ')).toBe(1)
  })

  it('180 palavras dão 1 minuto e 360 dão 2', () => {
    expect(readingMinutes(palavras(WPM))).toBe(1)
    expect(readingMinutes(palavras(WPM * 2))).toBe(2)
  })

  it('arredonda para o minuto mais próximo', () => {
    expect(readingMinutes(palavras(270))).toBe(2)
    expect(readingMinutes(palavras(260))).toBe(1)
  })

  it('texto curto nunca desce de 1 minuto', () => {
    expect(readingMinutes('No princípio, Deus criou os céus e a terra.')).toBe(1)
  })
})

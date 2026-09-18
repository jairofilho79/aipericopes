import { describe, expect, it } from 'vitest'
import { contarPalavras, formatarDuracao, readingMinutes, WPM } from './reading-time'

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

  it('calcula tempo considerando todas as seções de uma perícope', () => {
    const peri = {
      titulo_pericope_pt: 'A criação',
      contexto_historico_literario: palavras(90),
      texto: palavras(180),
      resenha: palavras(90),
      perguntas_reflexao: [palavras(45), palavras(45)],
    }
    // 2 + 90 + 180 + 90 + 90 = 452 palavras -> ~3 minutos a 180 wpm
    expect(readingMinutes(peri)).toBe(3)
  })
})

describe('formatarDuracao', () => {
  it('formata minutos abaixo de uma hora', () => {
    expect(formatarDuracao(0)).toBe('~0 min')
    expect(formatarDuracao(5)).toBe('~5 min')
    expect(formatarDuracao(59)).toBe('~59 min')
  })

  it('formata horas a partir de 60 minutos', () => {
    expect(formatarDuracao(60)).toBe('~1 h')
    expect(formatarDuracao(90)).toBe('~2 h')
    expect(formatarDuracao(120)).toBe('~2 h')
  })
})


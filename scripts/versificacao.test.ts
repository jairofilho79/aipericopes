import { describe, it, expect } from 'vitest'
import { ajustarVersificacao, AJUSTES, type Ajuste } from './versificacao.ts'

const ref = (livroEn: string, capitulo: number, versiculo: number) => ({
  livroEn,
  capitulo,
  versiculo,
})

describe('AJUSTES', () => {
  it('está vazia: a Bíblia Livre segue a versificação da KJV nos 31.102 versículos', () => {
    expect(AJUSTES).toEqual([])
  })
})

describe('ajustarVersificacao', () => {
  it('devolve os limites intactos quando não há ajuste para a ordem', () => {
    const s = ref('Genesis', 1, 1)
    const e = ref('Genesis', 2, 3)
    expect(ajustarVersificacao(0, s, e)).toEqual({ start: s, end: e, ajustado: false })
  })

  it('sem tabela, nenhuma ordem é ajustada', () => {
    expect(ajustarVersificacao(544, ref('1 Samuel', 20, 30), ref('1 Samuel', 20, 42)).ajustado).toBe(
      false,
    )
  })
})

describe('ajustarVersificacao — a máquina continua funcionando se a fonte trocar', () => {
  const tabela: Ajuste[] = [
    { ordem: 7, livroEn: 'Genesis', fim: { capitulo: 2, versiculo: 4 }, motivo: 'fixture' },
    { ordem: 8, livroEn: 'Exodus', inicio: { capitulo: 1, versiculo: 2 }, motivo: 'fixture' },
  ]

  it('estende o fim', () => {
    const r = ajustarVersificacao(7, ref('Genesis', 1, 1), ref('Genesis', 2, 3), tabela)
    expect(r.ajustado).toBe(true)
    expect(r.end).toEqual({ livroEn: 'Genesis', capitulo: 2, versiculo: 4 })
    expect(r.start).toEqual(ref('Genesis', 1, 1))
  })

  it('move o início sem tocar no fim', () => {
    const r = ajustarVersificacao(8, ref('Exodus', 1, 3), ref('Exodus', 1, 9), tabela)
    expect(r.start).toEqual({ livroEn: 'Exodus', capitulo: 1, versiculo: 2 })
    expect(r.end).toEqual(ref('Exodus', 1, 9))
  })

  it('lança quando o livro não bate — o dataset mudou de ordem', () => {
    expect(() => ajustarVersificacao(7, ref('Judges', 1, 1), ref('Judges', 2, 3), tabela)).toThrow(
      /espera Genesis/,
    )
  })
})

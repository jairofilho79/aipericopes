import { describe, expect, it } from 'vitest'
import { chamadasPorPalavra, palavraAnterior, pontosDeChamada } from './chamadas-texto'

const TEXTO = 'No princípio criou Deus'

describe('pontosDeChamada', () => {
  it('cola a letra no fim da palavra anterior, antes do espaço', () => {
    const [ponto] = pontosDeChamada(TEXTO, [{ letra: 'a', posicao: 1 }])
    expect(TEXTO.slice(0, ponto.offset)).toBe('No')
  })

  it('posição 0 vai para o começo e a posição final para o fim', () => {
    expect(pontosDeChamada(TEXTO, [{ letra: 'a', posicao: 0 }])[0].offset).toBe(0)
    expect(pontosDeChamada(TEXTO, [{ letra: 'a', posicao: 4 }])[0].offset).toBe(TEXTO.length)
  })

  it('posição além do texto é limitada ao fim', () => {
    expect(pontosDeChamada(TEXTO, [{ letra: 'a', posicao: 99 }])[0].offset).toBe(TEXTO.length)
  })

  it('ignora notas sem ponto e mantém a ordem das que caem no mesmo lugar', () => {
    const pontos = pontosDeChamada(TEXTO, [
      { letra: 'b', posicao: 3 },
      { letra: 'a', posicao: 1 },
      { letra: 'c', posicao: 3 },
      { letra: 'd', posicao: null },
    ])
    expect(pontos.map((p) => p.letra)).toEqual(['a', 'b', 'c'])
  })

  it('sem chamadas, nada', () => {
    expect(pontosDeChamada(TEXTO, undefined)).toEqual([])
  })
})

describe('chamadasPorPalavra', () => {
  it('agrupa por palavra anterior, com -1 para antes da primeira', () => {
    const mapa = chamadasPorPalavra(4, [
      { letra: 'a', posicao: 0 },
      { letra: 'b', posicao: 3 },
      { letra: 'c', posicao: 3 },
    ])
    expect(mapa.get(-1)).toEqual(['a'])
    expect(mapa.get(2)).toEqual(['b', 'c'])
  })

  it('palavraAnterior limita aos extremos', () => {
    expect(palavraAnterior(-5, 4)).toBe(-1)
    expect(palavraAnterior(9, 4)).toBe(3)
  })
})

import { describe, expect, it } from 'vitest'
import { blocoDeRolagem, fracaoLida, refNoContexto, seletorDaPosicao } from './posicao-restauracao'

describe('seletorDaPosicao', () => {
  it('id de seção vira seletor de âncora da própria section', () => {
    expect(seletorDaPosicao({ tipo: 'secao', ref: 'texto' })).toBe('#texto')
    expect(seletorDaPosicao({ tipo: 'secao', ref: 'reflexao' })).toBe('#reflexao')
  })

  it('versículo e alvo de narração viram seletor por data-verse-id/data-fala-id', () => {
    expect(seletorDaPosicao({ tipo: 'versiculo', ref: '3:16' })).toBe(
      '[data-verse-id="3:16"], [data-fala-id="3:16"]',
    )
    expect(seletorDaPosicao({ tipo: 'narracao', ref: 'cabecalho-resenha' })).toBe(
      '[data-verse-id="cabecalho-resenha"], [data-fala-id="cabecalho-resenha"]',
    )
  })

  it('parágrafo em prosa (mesmo com tipo secao) usa o seletor por atributo', () => {
    expect(seletorDaPosicao({ tipo: 'secao', ref: 'contexto-2' })).toBe(
      '[data-verse-id="contexto-2"], [data-fala-id="contexto-2"]',
    )
  })
})

describe('refNoContexto', () => {
  it('detecta a seção colapsável do Contexto em todas as formas de ref', () => {
    expect(refNoContexto('contexto')).toBe(true)
    expect(refNoContexto('contexto-0')).toBe(true)
    expect(refNoContexto('cabecalho-contexto')).toBe(true)
    expect(refNoContexto('texto')).toBe(false)
    expect(refNoContexto('3:16')).toBe(false)
  })
})

describe('blocoDeRolagem', () => {
  it('seção alinha no topo, unidade fina centraliza', () => {
    expect(blocoDeRolagem({ tipo: 'secao', ref: 'resenha' })).toBe('start')
    expect(blocoDeRolagem({ tipo: 'versiculo', ref: '1:1' })).toBe('center')
    expect(blocoDeRolagem({ tipo: 'narracao', ref: 'resenha-0' })).toBe('center')
    // ref de parágrafo com tipo secao ainda é uma unidade fina
    expect(blocoDeRolagem({ tipo: 'secao', ref: 'resenha-1' })).toBe('center')
  })
})

describe('fracaoLida', () => {
  it('vai de 0 no topo a 1 no fim, com clamp', () => {
    expect(fracaoLida(0, 800, 4000)).toBe(0)
    expect(fracaoLida(3200, 800, 4000)).toBe(1)
    expect(fracaoLida(1600, 800, 4000)).toBe(0.5)
    expect(fracaoLida(-10, 800, 4000)).toBe(0)
    expect(fracaoLida(99999, 800, 4000)).toBe(1)
  })

  it('página menor que a viewport conta como lida', () => {
    expect(fracaoLida(0, 800, 600)).toBe(1)
    expect(fracaoLida(0, 800, 800)).toBe(1)
  })
})

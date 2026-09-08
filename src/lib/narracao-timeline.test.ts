import { describe, expect, it } from 'vitest'
import { indiceDaPalavra, indiceEm } from './narracao-timeline'
import type { AlvoAlinhado } from './alinhar-narracao'

const alvo = (id: string, inicio: number, fim: number): AlvoAlinhado => ({
  id,
  inicio,
  fim,
  palavras: [
    { inicio, fim: inicio + (fim - inicio) / 2 },
    { inicio: inicio + (fim - inicio) / 2, fim },
  ],
})

// Duas seções, com um vão entre elas (o cabeçalho falado da segunda).
const linha = [alvo('a', 0, 10), alvo('b', 10, 20), alvo('c', 30, 40)]

describe('indiceEm', () => {
  it('acha pela dica certa sem varrer', () => {
    expect(indiceEm(linha, 5, 0)).toBe(0)
  })

  it('avança um passo quando o tempo cruza para o próximo', () => {
    expect(indiceEm(linha, 12, 0)).toBe(1)
  })

  it('acha com dica errada (seek para frente)', () => {
    expect(indiceEm(linha, 35, 0)).toBe(2)
  })

  it('acha com dica errada (seek para trás)', () => {
    expect(indiceEm(linha, 1, 2)).toBe(0)
  })

  it('dica fora da faixa não quebra', () => {
    expect(indiceEm(linha, 5, 99)).toBe(0)
    expect(indiceEm(linha, 5, -3)).toBe(0)
  })

  it('vão entre seções não realça nada', () => {
    expect(indiceEm(linha, 25, 1)).toBe(-1)
  })

  it('antes do primeiro e depois do último não realça nada', () => {
    expect(indiceEm([alvo('a', 5, 10)], 1, 0)).toBe(-1)
    expect(indiceEm(linha, 100, 2)).toBe(-1)
  })

  it('a borda pertence ao alvo seguinte — [inicio, fim)', () => {
    expect(indiceEm(linha, 10, 0)).toBe(1)
  })

  it('alinhamento vazio devolve -1', () => {
    expect(indiceEm([], 3, 0)).toBe(-1)
  })
})

describe('indiceDaPalavra', () => {
  const a = alvo('a', 0, 10)

  it('primeira e segunda metades', () => {
    expect(indiceDaPalavra(a, 1, 0)).toBe(0)
    expect(indiceDaPalavra(a, 7, 0)).toBe(1)
  })

  it('seek para trás dentro do alvo', () => {
    expect(indiceDaPalavra(a, 1, 1)).toBe(0)
  })

  it('fora do alvo devolve -1', () => {
    expect(indiceDaPalavra(a, 50, 0)).toBe(-1)
  })
})

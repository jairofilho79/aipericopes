import { describe, it, expect } from 'vitest'
import { ordenarParaLeitura, atribuirSeq } from './aplicar-cortes.ts'

const p = (ordem: number, abbrev: string, c: number, v: number) => ({
  ordem,
  abbrev,
  capitulo_inicio: c,
  versiculo_inicio: v,
})
const n = (ordem: number, substitui: number, abbrev: string, c: number, v: number) => ({
  ...p(ordem, abbrev, c, v),
  substitui,
})

describe('ordenarParaLeitura', () => {
  it('põe as novas no lugar da que elas substituem, não no fim', () => {
    const existentes = [p(10, 'Gn', 1, 1), p(11, 'Gn', 4, 1), p(12, 'Gn', 6, 1)]
    const novas = [n(3000, 11, 'Gn', 4, 1), n(3001, 11, 'Gn', 5, 1)]
    expect(ordenarParaLeitura(existentes, novas).map((x) => x.ordem)).toEqual([10, 3000, 3001, 12])
  })

  it('ordena as novas de um mesmo bloco por capítulo:versículo, não pela ordem de chegada', () => {
    const existentes = [p(11, 'Gn', 4, 1)]
    // chegam fora de ordem de propósito
    const novas = [n(3002, 11, 'Gn', 5, 1), n(3000, 11, 'Gn', 4, 1), n(3001, 11, 'Gn', 4, 17)]
    expect(ordenarParaLeitura(existentes, novas).map((x) => x.ordem)).toEqual([3000, 3001, 3002])
  })

  it('nenhuma ordem existente muda de valor', () => {
    const existentes = [p(10, 'Gn', 1, 1), p(11, 'Gn', 4, 1), p(2646, 'Ap', 22, 1)]
    const novas = [n(3000, 11, 'Gn', 4, 1)]
    const saida = ordenarParaLeitura(existentes, novas)
    expect(saida.find((x) => x.ordem === 10)).toBeDefined()
    expect(saida.find((x) => x.ordem === 2646)).toBeDefined()
    expect(saida.map((x) => x.ordem)).not.toContain(11)
  })

  it('lança quando uma nova aponta para ordem que não existe', () => {
    expect(() => ordenarParaLeitura([p(10, 'Gn', 1, 1)], [n(3000, 999, 'Gn', 4, 1)])).toThrow(
      /não existem no catálogo: 999/,
    )
  })

  it('sem novas, devolve o catálogo intacto', () => {
    const existentes = [p(10, 'Gn', 1, 1), p(11, 'Gn', 4, 1)]
    expect(ordenarParaLeitura(existentes, [])).toEqual(existentes)
  })
})

describe('atribuirSeq', () => {
  it('numera denso a partir de zero, seguindo a posição', () => {
    const lista = [p(10, 'Gn', 1, 1), p(3000, 'Gn', 4, 1), p(12, 'Gn', 6, 1)]
    expect(atribuirSeq(lista).map((x) => ({ ordem: x.ordem, seq: x.seq }))).toEqual([
      { ordem: 10, seq: 0 },
      { ordem: 3000, seq: 1 },
      { ordem: 12, seq: 2 },
    ])
  })

  it('seq acompanha a posição mesmo com ordem não crescente', () => {
    // É o caso real depois do recorte: ordem 3000 entre ordens 1000.
    const seqs = atribuirSeq([p(1000, 'Sl', 1, 1), p(3000, 'Sl', 2, 1), p(1001, 'Sl', 3, 1)])
    expect(seqs.map((x) => x.seq)).toEqual([0, 1, 2])
    expect(seqs.every((x, i) => x.seq === i)).toBe(true)
  })
})

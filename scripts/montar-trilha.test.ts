import { describe, expect, it } from 'vitest'
import { camaPorPericope } from './montar-trilha'

const mapa = (pares: [number, string][]) => new Map(pares)

describe('camaPorPericope', () => {
  it('perícope isolada usa a primeira cama, mesmo tendo variante', () => {
    // A segunda cama existe para quebrar fila. Sem fila, não há o que quebrar —
    // e usar a variante aqui só tiraria previsibilidade de graça.
    const c = camaPorPericope([1, 2, 3], mapa([[1, 'juizo'], [2, 'consolo'], [3, 'juizo']]),
      new Set(['juizo']))
    expect([...c.values()]).toEqual(['juizo', 'consolo', 'juizo'])
  })

  it('alterna dentro da fila do mesmo registro', () => {
    const ordens = [1, 2, 3, 4, 5]
    const c = camaPorPericope(ordens, mapa(ordens.map((o) => [o, 'santuario'] as [number, string])),
      new Set(['santuario']))
    expect(ordens.map((o) => c.get(o))).toEqual(
      ['santuario', 'santuario-2', 'santuario', 'santuario-2', 'santuario'],
    )
  })

  it('registro sem variante não alterna, por mais longa que seja a fila', () => {
    const ordens = [1, 2, 3, 4]
    const c = camaPorPericope(ordens, mapa(ordens.map((o) => [o, 'louvor'] as [number, string])),
      new Set(['santuario']))
    expect(new Set(c.values())).toEqual(new Set(['louvor']))
  })

  it('a contagem reinicia a cada fila nova', () => {
    // Duas filas de Ensino separadas por uma perícope de outro registro: a
    // segunda fila recomeça na primeira cama. Se a contagem fosse global, a
    // cama de uma perícope dependeria de quantas vieram antes no acervo
    // inteiro — e mudaria sozinha quando qualquer vizinha fosse reclassificada.
    const ordens = [1, 2, 3, 4]
    const c = camaPorPericope(ordens,
      mapa([[1, 'ensino'], [2, 'ensino'], [3, 'tensao'], [4, 'ensino']]), new Set(['ensino']))
    expect(ordens.map((o) => c.get(o))).toEqual(['ensino', 'ensino-2', 'tensao', 'ensino'])
  })

  it('a ordem que vale é a de leitura, não a numérica', () => {
    const c = camaPorPericope([30, 10, 20],
      mapa([[10, 'juizo'], [20, 'juizo'], [30, 'juizo']]), new Set(['juizo']))
    expect([c.get(30), c.get(10), c.get(20)]).toEqual(['juizo', 'juizo-2', 'juizo'])
  })
})

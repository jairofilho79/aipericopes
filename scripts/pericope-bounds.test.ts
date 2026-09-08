import { describe, it, expect } from 'vitest'
import { resolveBounds } from './pericope-bounds.ts'

/** Molde de linha do dataset bruto, com a lista de versículos que manda. */
function row(start: string, end: string, verses: string[]) {
  return {
    Pericope: 'x',
    'Reference Start': start,
    'Reference End': end,
    Verses: verses.map((Reference) => ({ Reference, Text: '' })),
  }
}

describe('resolveBounds', () => {
  it('usa a lista de versículos, não os campos declarados', () => {
    // #90 do dataset: declara Exodus 7:1 mas o texto começa em 6:28.
    const r = row('Exodus 7:1', 'Exodus 7:7', [
      'Exodus 6:28',
      'Exodus 6:29',
      'Exodus 6:30',
      'Exodus 7:1',
      'Exodus 7:7',
    ])
    expect(resolveBounds(r)).toEqual({
      start: { livroEn: 'Exodus', capitulo: 6, versiculo: 28 },
      end: { livroEn: 'Exodus', capitulo: 7, versiculo: 7 },
      corrigido: true,
    })
  })

  it('corrige início declarado cedo demais, que gerava sobreposição', () => {
    // #266: declara Numbers 16:28, mas 16:28-37 pertencem à perícope anterior.
    const r = row('Numbers 16:28', 'Numbers 16:40', [
      'Numbers 16:38',
      'Numbers 16:39',
      'Numbers 16:40',
    ])
    expect(resolveBounds(r).start).toEqual({
      livroEn: 'Numbers',
      capitulo: 16,
      versiculo: 38,
    })
  })

  it('corrige referência que nem existe no livro', () => {
    // #2074: "John 18:41" não existe; a lista começa de fato em 19:1.
    const r = row('John 18:41', 'John 19:15', ['John 19:1', 'John 19:15'])
    expect(resolveBounds(r).start).toEqual({
      livroEn: 'John',
      capitulo: 19,
      versiculo: 1,
    })
  })

  it('não mexe quando declarado e real já batem', () => {
    const r = row('Genesis 1:1', 'Genesis 2:3', ['Genesis 1:1', 'Genesis 2:3'])
    expect(resolveBounds(r)).toEqual({
      start: { livroEn: 'Genesis', capitulo: 1, versiculo: 1 },
      end: { livroEn: 'Genesis', capitulo: 2, versiculo: 3 },
      corrigido: false,
    })
  })

  it('cai para os campos declarados quando não há lista de versículos', () => {
    const r = { Pericope: 'x', 'Reference Start': 'Ruth 1:1', 'Reference End': 'Ruth 1:5' }
    expect(resolveBounds(r)).toEqual({
      start: { livroEn: 'Ruth', capitulo: 1, versiculo: 1 },
      end: { livroEn: 'Ruth', capitulo: 1, versiculo: 5 },
      corrigido: false,
    })
  })
})

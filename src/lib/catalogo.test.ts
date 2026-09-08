// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { agruparLivros, rotuloContagem } from './catalogo'
import { BIBLE_BOOKS } from './bible-books'

describe('agruparLivros', () => {
  it('separa os dois testamentos e preserva a ordem canônica', () => {
    const g = agruparLivros(BIBLE_BOOKS)
    expect(g.map((x) => x.testament)).toEqual(['vt', 'nt'])
    expect(g[0].secoes[0].secao).toBe('Pentateuco')
    expect(g[0].secoes[0].livros[0].name).toBe('Gênesis')
  })

  it('testamento sem livro nenhum não vira grupo vazio', () => {
    const so = BIBLE_BOOKS.filter((b) => b.testament === 'nt')
    expect(agruparLivros(so).map((x) => x.testament)).toEqual(['nt'])
  })

  it('lista vazia não gera grupo', () => {
    expect(agruparLivros([])).toEqual([])
  })
})

describe('rotuloContagem', () => {
  const prog = { livro: 'Gênesis', total: 77, concluidas: 24, pct: 31 }

  it('"todos" mostra concluídas de total', () => {
    expect(rotuloContagem('todos', prog, 77)).toBe('24 de 77')
  })

  it('"nao-lidos" diz quanto resta', () => {
    expect(rotuloContagem('nao-lidos', prog, 53)).toBe('restam 53')
  })

  it('livro sem nada no recorte mostra 0, e não some', () => {
    expect(rotuloContagem('nao-lidos', prog, 0)).toBe('0')
    expect(rotuloContagem('lidos', prog, 0)).toBe('0')
  })

  it('"comecei" e "lidos" mostram só o número', () => {
    expect(rotuloContagem('comecei', prog, 3)).toBe('3')
    expect(rotuloContagem('lidos', prog, 24)).toBe('24')
  })

  it('livro ausente do progresso não quebra', () => {
    expect(rotuloContagem('todos', undefined, 0)).toBe('0 de 0')
  })
})

// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { agruparLivros, fraseContagem } from './catalogo'
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

describe('fraseContagem', () => {
  const prog = { livro: 'Gênesis', total: 77, concluidas: 24, pct: 31 }

  it('"todos" fala de leitura, não do recorte', () => {
    expect(fraseContagem('todos', prog, 77)).toBe('24 de 77 perícopes')
    expect(fraseContagem('todos', { ...prog, concluidas: 0 }, 77)).toBe('nenhuma lida ainda')
  })

  it('cada filtro tem a frase do que ele mostra', () => {
    expect(fraseContagem('nao-lidos', prog, 53)).toBe('restam 53 perícopes')
    expect(fraseContagem('comecei', prog, 3)).toBe('3 em andamento')
    expect(fraseContagem('lidos', prog, 24)).toBe('24 lidas')
  })

  it('livro zerado pelo recorte fala em vez de sumir da lista', () => {
    expect(fraseContagem('nao-lidos', prog, 0)).toBe('concluído')
    expect(fraseContagem('comecei', prog, 0)).toBe('nada em andamento')
    expect(fraseContagem('lidos', prog, 0)).toBe('nenhuma lida ainda')
  })

  it('singular não sai errado', () => {
    expect(fraseContagem('todos', { total: 1, concluidas: 1 }, 1)).toBe('1 de 1 perícope')
    expect(fraseContagem('nao-lidos', prog, 1)).toBe('resta 1 perícope')
    expect(fraseContagem('lidos', prog, 1)).toBe('1 lida')
  })

  it('livro ausente do progresso não quebra', () => {
    expect(fraseContagem('todos', undefined, 0)).toBe('nenhuma lida ainda')
  })

  it('aceita o formato mínimo de progresso — RegistroProgresso não tem `livro`', () => {
    // Prova em runtime do alargamento de tipo: CatalogoRegistros passa
    // RegistroProgresso (slug/total/concluidas/pct), não LivroProgresso.
    const progRegistro = { slug: 'lamento', total: 40, concluidas: 10, pct: 25 }
    expect(fraseContagem('todos', progRegistro, 40)).toBe('10 de 40 perícopes')
  })
})

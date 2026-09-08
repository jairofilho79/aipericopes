import { describe, expect, it } from 'vitest'
import { BIBLE_BOOKS } from './bible-books'
import { BLOCOS, abbrevsDoBloco, blocoPorId } from './blocos'

describe('BLOCOS', () => {
  it('cada section do cânon é reivindicada por exatamente um bloco', () => {
    const doCanon = new Set(BIBLE_BOOKS.map((b) => b.section))
    const reivindicadas = BLOCOS.flatMap((b) => [...b.sections])
    // Sem repetição: uma section em dois blocos duplicaria livros.
    expect(new Set(reivindicadas).size).toBe(reivindicadas.length)
    // Sem sobra e sem invenção.
    expect([...reivindicadas].sort()).toEqual([...doCanon].sort())
  })

  it('os blocos cobrem os 66 livros, sem repetir nenhum', () => {
    const cobertos = BLOCOS.flatMap((b) => [...abbrevsDoBloco(b.id)])
    expect(cobertos).toHaveLength(66)
    expect(new Set(cobertos).size).toBe(66)
  })

  it('Jó fica nos poéticos e João nos evangelhos', () => {
    // Derivar de BIBLE_BOOKS elimina a transcrição, que era o único jeito de
    // errar isto. O teste trava a propriedade caso alguém volte a escrever
    // abbrevs à mão aqui.
    expect(abbrevsDoBloco('poeticos').has('Jó')).toBe(true)
    expect(abbrevsDoBloco('poeticos').has('Jo')).toBe(false)
    expect(abbrevsDoBloco('evangelhos').has('Jo')).toBe(true)
    expect(abbrevsDoBloco('evangelhos').has('Jó')).toBe(false)
  })

  it('Atos entra com as cartas de Paulo, e Apocalipse com as gerais', () => {
    expect(abbrevsDoBloco('paulo').has('At')).toBe(true)
    expect(abbrevsDoBloco('paulo').size).toBe(14)
    expect(abbrevsDoBloco('hebreus-apocalipse').has('Ap')).toBe(true)
    expect(abbrevsDoBloco('hebreus-apocalipse').size).toBe(9)
  })

  it('tem ids únicos', () => {
    const ids = BLOCOS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('id desconhecido devolve undefined e conjunto vazio', () => {
    expect(blocoPorId('nao-existe')).toBeUndefined()
    expect(abbrevsDoBloco('nao-existe').size).toBe(0)
  })
})

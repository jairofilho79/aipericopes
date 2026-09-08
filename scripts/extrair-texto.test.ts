import { describe, it, expect } from 'vitest'
import { extrairTexto } from './extrair-texto.ts'
import type { LivroBlivre } from './blivre-fonte.ts'

const livro = (chapters: LivroBlivre['chapters']): LivroBlivre => ({
  abbrev: 'Sl',
  name: 'Salmos',
  chapters,
})

const versos = (...ts: string[]) => ts.map((t) => ({ t }))

describe('extrairTexto', () => {
  it('monta "Capítulo N" como cabeçalho e "V texto" por versículo', () => {
    const r = extrairTexto(livro([versos('um', 'dois', 'três')]), 1, 1, 1, 3)
    expect(r.texto).toBe('Capítulo 1\n1 um\n2 dois\n3 três')
    expect(r.versiculos).toBe(3)
    expect(r.avisos).toEqual([])
  })

  it('recorta a faixa dentro do capítulo', () => {
    const r = extrairTexto(livro([versos('um', 'dois', 'três', 'quatro')]), 1, 2, 1, 3)
    expect(r.texto).toBe('Capítulo 1\n2 dois\n3 três')
    expect(r.versiculos).toBe(2)
  })

  it('atravessa capítulos, com um cabeçalho por capítulo', () => {
    const r = extrairTexto(livro([versos('a', 'b'), versos('c', 'd')]), 1, 2, 2, 1)
    expect(r.texto).toBe('Capítulo 1\n2 b\nCapítulo 2\n1 c')
  })

  it('o sobrescrito do primeiro versículo vira campo, não linha de texto', () => {
    const l = livro([[{ t: 'O SENHOR é meu pastor.', e: 'Salmo de Davi' }, { t: 'Ele me faz deitar.' }]])
    const r = extrairTexto(l, 1, 1, 1, 2)
    expect(r.sobrescrito).toBe('Salmo de Davi')
    expect(r.texto).toBe('Capítulo 1\n1 O SENHOR é meu pastor.\n2 Ele me faz deitar.')
  })

  it('o rótulo estrutural fica na linha do versículo, como um narrador leria', () => {
    const l = livro([[{ t: 'primeiro' }, { t: 'Beije-me ele', r: 'Ela' }]])
    const r = extrairTexto(l, 1, 1, 1, 2)
    expect(r.sobrescrito).toBeUndefined()
    expect(r.texto).toBe('Capítulo 1\n1 primeiro\n2 Ela: Beije-me ele')
  })

  it('rótulo NA ABERTURA não sobe para o topo — "Álefe" não é título do Sl 119', () => {
    const l = livro([[{ t: 'Bem-aventurados são os puros', r: 'Álefe' }, { t: 'segundo' }]])
    const r = extrairTexto(l, 1, 1, 1, 2)
    expect(r.sobrescrito).toBeUndefined()
    expect(r.texto).toBe('Capítulo 1\n1 Álefe: Bem-aventurados são os puros\n2 segundo')
  })

  it('sobrescrito no MEIO da faixa fica na linha: o topo é da abertura', () => {
    const l = livro([[{ t: 'a' }], [{ t: 'Uivai, navios', e: 'Revelação sobre Tiro' }]])
    const r = extrairTexto(l, 1, 1, 2, 1)
    expect(r.sobrescrito).toBeUndefined()
    expect(r.texto).toBe('Capítulo 1\n1 a\nCapítulo 2\n1 Revelação sobre Tiro: Uivai, navios')
  })

  it('a epígrafe da abertura só conta se a faixa começa nela', () => {
    const l = livro([[{ t: 'O SENHOR é meu pastor.', e: 'Salmo de Davi' }, { t: 'Ele me faz deitar.' }]])
    const r = extrairTexto(l, 1, 2, 1, 2)
    expect(r.sobrescrito).toBeUndefined()
    expect(r.texto).toBe('Capítulo 1\n2 Ele me faz deitar.')
  })

  it('avisa quando o início passa do fim do capítulo — o furo silencioso', () => {
    // Era assim que Ap 12:18 sumia sem ninguém acusar: o laço não roda.
    const r = extrairTexto(livro([versos('a', 'b'), versos('c')]), 1, 3, 2, 1)
    expect(r.avisos).toEqual([
      'Salmos 1:3 — início além do fim do capítulo, que tem 2 versículos',
    ])
    expect(r.texto).toBe('Capítulo 2\n1 c')
  })

  it('avisa quando o versículo não existe', () => {
    const r = extrairTexto(livro([versos('a', 'b')]), 1, 1, 1, 4)
    expect(r.avisos).toEqual(['Salmos 1:3 ausente na fonte', 'Salmos 1:4 ausente na fonte'])
    expect(r.versiculos).toBe(2)
  })

  it('avisa quando o capítulo não existe', () => {
    const r = extrairTexto(livro([versos('a')]), 1, 1, 2, 1)
    expect(r.avisos).toEqual(['capítulo 2 ausente em Salmos'])
    expect(r.texto).toBe('Capítulo 1\n1 a')
  })
})

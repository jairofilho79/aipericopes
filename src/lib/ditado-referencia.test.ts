import { describe, expect, it } from 'vitest'
import { normalizarDitadoRef } from './ditado-referencia'
import { parseConsulta } from './consulta'

describe('normalizarDitadoRef', () => {
  it('tira a pontuação de fecho que pontuarFrase põe em toda frase', () => {
    expect(normalizarDitadoRef('Gênesis 3:15.')).toBe('Gênesis 3:15')
    expect(normalizarDitadoRef('Gênesis 3.15.')).toBe('Gênesis 3.15')
    expect(normalizarDitadoRef('Salmo 23?')).toBe('Salmo 23')
  })

  it('junta dois números seguidos em capítulo:versículo', () => {
    expect(normalizarDitadoRef('Gênesis 3 15.')).toBe('Gênesis 3:15')
    expect(normalizarDitadoRef('Salmo 119 105')).toBe('Salmo 119:105')
  })

  it('converte numeral por extenso em dígito', () => {
    expect(normalizarDitadoRef('Gênesis três quinze.')).toBe('Gênesis 3:15')
    expect(normalizarDitadoRef('João três dezesseis.')).toBe('João 3:16')
    expect(normalizarDitadoRef('Salmo cem.')).toBe('Salmo 100')
  })

  it('o "e" soma; sem ele, são dois números', () => {
    // É o que separa o Salmo 23 ("vinte e três") de Gênesis 3:15
    // ("três quinze") — sem essa distinção, 3 e 15 virariam 18.
    expect(normalizarDitadoRef('Salmo vinte e três.')).toBe('Salmo 23')
    expect(normalizarDitadoRef('Salmo cento e dezenove cento e cinco.')).toBe('Salmo 119:105')
    expect(normalizarDitadoRef('Apocalipse vinte e um dois.')).toBe('Apocalipse 21:2')
  })

  it('não depende de acento — o reconhecedor varia', () => {
    expect(normalizarDitadoRef('genesis tres quinze')).toBe('genesis 3:15')
  })

  it('descarta "capítulo" e "versículo" ditados por extenso', () => {
    expect(normalizarDitadoRef('Gênesis capítulo 3 versículo 15.')).toBe('Gênesis 3:15')
  })

  it('preserva o ordinal do nome do livro', () => {
    expect(normalizarDitadoRef('1 Coríntios 13.')).toBe('1 Coríntios 13')
  })

  it('"e" fora de número continua sendo palavra', () => {
    expect(normalizarDitadoRef('céu e terra.')).toBe('céu e terra')
  })

  it('texto que não é referência atravessa, só sem o ponto', () => {
    // O campo é o mesmo da busca livre: ditar "amor de Deus" tem que
    // continuar buscando no texto.
    expect(normalizarDitadoRef('Amor de Deus.')).toBe('Amor de Deus')
  })

  it('vazio e só pontuação devolvem vazio', () => {
    expect(normalizarDitadoRef('')).toBe('')
    expect(normalizarDitadoRef('  .  ')).toBe('')
  })
})

describe('normalizarDitadoRef + parseConsulta', () => {
  // O ponto inteiro do módulo: sem ele estas três frases caem em busca de
  // texto sem nenhum erro na tela.
  it.each([
    ['Gênesis três quinze.', 'Gênesis', 3, 15],
    ['Gênesis 3 15.', 'Gênesis', 3, 15],
    ['Salmos vinte e três.', 'Salmos', 23, null],
    ['João capítulo 3 versículo 16.', 'João', 3, 16],
  ])('"%s" resolve como referência', (ditado, livro, cap, ver) => {
    const c = parseConsulta(normalizarDitadoRef(ditado as string))
    expect(c.ref?.livro.name).toBe(livro)
    expect(c.ref?.cap).toBe(cap)
    expect(c.ref?.ver).toBe(ver)
  })

  it('sem normalizar, a mesma frase degrada para busca de texto', () => {
    const c = parseConsulta('Gênesis 3:15.')
    expect(c.ref).toBeNull()
    expect(c.buscarNoTexto).toBe(true)
  })

  it('limite conhecido: o nome do livro no singular não é do parser aqui', () => {
    // "Salmo 23" (singular) não casa o alias "salmos" em `casaPrefixo`
    // (`consulta.ts:36`) — o normalizador entrega o número certo, e a
    // consulta ainda cai em busca de texto. Consertar isso é mexer no
    // parser compartilhado; a dica do campo mostra "Salmos 23".
    expect(normalizarDitadoRef('Salmo vinte e três.')).toBe('Salmo 23')
    expect(parseConsulta('Salmo 23').ref).toBeNull()
  })
})

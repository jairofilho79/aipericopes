import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  carregarIntroducao,
  carregarManifestoIntroducao,
  obterPrimeiraPericopeDoLivro,
  urlAudioIntroducao,
} from './introducoes'

describe('introducoes lib', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('urlAudioIntroducao gera o caminho correto no R2/Worker', () => {
    expect(urlAudioIntroducao('genesis')).toBe('/api/audio/introducoes/genesis.m4a')
    expect(urlAudioIntroducao('exodo')).toBe('/api/audio/introducoes/exodo.m4a')
  })

  it('carregarIntroducao busca o JSON da introdução', async () => {
    const mockData = {
      livro: 'Gênesis',
      slug: 'genesis',
      abbrev: 'Gn',
      testamento: 'vt',
      titulo_canonico: 'O Primeiro Livro de Moisés chamado Gênesis',
      titulo_introducao: 'Introdução ao Livro de Gênesis',
      secoes: [
        {
          id: 'etimologia',
          subtitulo: 'O Portal das Escrituras e o Nome do Livro',
          texto: 'Na tradição hebraica...',
        },
      ],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    } as Response)

    const dados = await carregarIntroducao('teste-slug')
    expect(dados).toEqual(mockData)
  })

  it('carregarIntroducao retorna null em caso de erro 404 ou resposta não-JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      headers: new Headers(),
    } as Response)

    const dados = await carregarIntroducao('nao-existe-404')
    expect(dados).toBeNull()
  })

  it('obterPrimeiraPericopeDoLivro retorna a primeira perícope do livro pelo índice', async () => {
    const idxMock = [
      {
        ordem: 1,
        livro: 'Gênesis',
        abbrev: 'Gn',
        capitulo_inicio: 1,
        versiculo_inicio: 1,
        capitulo_fim: 2,
        versiculo_fim: 3,
        titulo_pericope_pt: 'A criação',
        minutos: 5,
        narrado: false,
        seq: 0,
      },
      {
        ordem: 2,
        livro: 'Gênesis',
        abbrev: 'Gn',
        capitulo_inicio: 2,
        versiculo_inicio: 4,
        capitulo_fim: 2,
        versiculo_fim: 25,
        titulo_pericope_pt: 'O jardim do Éden',
        minutos: 4,
        narrado: false,
        seq: 1,
      },
    ]

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => idxMock,
    } as Response)

    const primeira = await obterPrimeiraPericopeDoLivro('Gênesis')
    expect(primeira).not.toBeNull()
    expect(primeira?.livro).toBe('Gênesis')
    expect(primeira?.capitulo_inicio).toBe(1)
    expect(primeira?.ordem).toBe(1)
  })

  it('obterPrimeiraPericopeDoLivro funciona também com slug', async () => {
    const idxMock = [
      {
        ordem: 1,
        livro: 'Gênesis',
        abbrev: 'Gn',
        capitulo_inicio: 1,
        versiculo_inicio: 1,
        capitulo_fim: 2,
        versiculo_fim: 3,
        titulo_pericope_pt: 'A criação',
        minutos: 5,
        narrado: false,
        seq: 0,
      },
    ]

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => idxMock,
    } as Response)

    const primeira = await obterPrimeiraPericopeDoLivro('genesis')
    expect(primeira).not.toBeNull()
    expect(primeira?.livro).toBe('Gênesis')
  })

  it('carregarManifestoIntroducao retorna o manifesto se válido', async () => {
    const mockManifesto = {
      slug: 'genesis',
      dur_total: 120.5,
      unidades: [
        {
          i: 0,
          secao: 'etimologia',
          texto: 'Na tradição hebraica',
          inicio: 0,
          dur: 15,
        },
      ],
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockManifesto,
    } as Response)

    const res = await carregarManifestoIntroducao('genesis')
    expect(res).toEqual(mockManifesto)
  })
})
